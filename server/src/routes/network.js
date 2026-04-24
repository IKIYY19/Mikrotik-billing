const express = require('express');
const router = express.Router();

// Helper: get MikroTik connection
async function getMikrotikConnection(connectionId) {
  const db = global.db || require('../db/memory');
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32';

  const result = await db.query('SELECT * FROM mikrotik_connections WHERE id = $1', [connectionId]);
  if (result.rows.length === 0) throw new Error('Connection not found');

  const device = result.rows[0];
  const [ivHex, authTagHex, encrypted] = device.password_encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  device.password = decrypted;

  return device;
}

// Helper: execute MikroTik command
async function executeCommand(device, command, args = {}) {
  try {
    const MikroNode = require('mikronode');
    const mikrotik = new MikroNode(device.ip_address, { port: device.api_port || 8728 });
    const connection = await mikrotik.connect(device.username, device.password);
    const close = connection.closeOnDone(true);
    const chan = connection.openChannel();
    chan.write(command, args);
    const result = await chan.done;
    close();
    return result;
  } catch (error) {
    throw new Error(`MikroTik API error: ${error.message}`);
  }
}

// Helper: get all from MikroTik path
async function getFromMikrotik(device, path) {
  try {
    const MikroNode = require('mikronode');
    const mikrotik = new MikroNode(device.ip_address, { port: device.api_port || 8728 });
    const connection = await mikrotik.connect(device.username, device.password);
    const close = connection.closeOnDone(true);
    const chan = connection.openChannel();
    chan.write(path + '/print', { '.proplist': '.id,name,comment,disabled' });
    const result = await chan.done;
    close();
    return result;
  } catch (error) {
    console.error(`MikroTik get error: ${error.message}`);
    return [];
  }
}

// ═══════════════════════════════════════
// PPPoE ROUTES
// ═══════════════════════════════════════

// Get PPPoE secrets
router.get('/pppoe/secrets', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ppp/secret');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create PPPoE secret
router.post('/pppoe/secrets', async (req, res) => {
  try {
    const { connection_id, name, password, service, profile, rate_limit, comment } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const args = { name, password, service: service || 'pppoe' };
    if (profile) args.profile = profile;
    if (rate_limit) args['rate-limit'] = rate_limit;
    if (comment) args.comment = comment;

    await executeCommand(device, '/ppp/secret/add', args);
    res.json({ success: true, message: 'PPPoE secret created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete PPPoE secret
router.delete('/pppoe/secrets/:name', async (req, res) => {
  try {
    const { connection_id } = req.query;
    const { name } = req.params;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    await executeCommand(device, '/ppp/secret/remove', { 'numbers': name });
    res.json({ success: true, message: 'PPPoE secret deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle PPPoE secret
router.post('/pppoe/secrets/:name/toggle', async (req, res) => {
  try {
    const { connection_id } = req.query;
    const { name } = req.params;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    // Find the secret to get current disabled status
    const secrets = await getFromMikrotik(device, '/ppp/secret');
    const secret = secrets.find(s => s.name === name);
    const isDisabled = secret?.disabled === 'true' || secret?.disabled === 'yes';

    await executeCommand(device, `/ppp/secret/set`, { 'numbers': name, 'disabled': isDisabled ? 'no' : 'yes' });
    res.json({ success: true, message: `PPPoE secret ${isDisabled ? 'enabled' : 'disabled'}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get PPPoE profiles
router.get('/pppoe/profiles', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ppp/profile');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create PPPoE profile
router.post('/pppoe/profiles', async (req, res) => {
  try {
    const { connection_id, name, local_address, remote_address, rate_limit, dns_server } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const args = { name };
    if (local_address) args['local-address'] = local_address;
    if (remote_address) args['remote-address'] = remote_address;
    if (rate_limit) args['rate-limit'] = rate_limit;
    if (dns_server) args['dns-server'] = dns_server;

    await executeCommand(device, '/ppp/profile/add', args);
    res.json({ success: true, message: 'PPPoE profile created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete PPPoE profile
router.delete('/pppoe/profiles/:name', async (req, res) => {
  try {
    const { connection_id } = req.query;
    const { name } = req.params;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    await executeCommand(device, '/ppp/profile/remove', { 'numbers': name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get PPPoE active sessions
router.get('/pppoe/active', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ppp/active');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Kick PPPoE user
router.post('/pppoe/active/:name/kick', async (req, res) => {
  try {
    const { connection_id } = req.query;
    const { name } = req.params;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    await executeCommand(device, '/ppp/active/remove', { 'numbers': name });
    res.json({ success: true, message: 'User disconnected' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// HOTSPOT ROUTES
// ═══════════════════════════════════════

// Get Hotspot users
router.get('/hotspot/users', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ip/hotspot/user');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create Hotspot user
router.post('/hotspot/users', async (req, res) => {
  try {
    const { connection_id, name, password, profile, disabled, comment, limit_bytes_total, rate_limit } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const args = { name, password };
    if (profile) args.profile = profile;
    if (disabled) args.disabled = disabled;
    if (comment) args.comment = comment;
    if (limit_bytes_total) args['limit-bytes-total'] = limit_bytes_total;
    if (rate_limit) args['rate-limit'] = rate_limit;

    await executeCommand(device, '/ip/hotspot/user/add', args);
    res.json({ success: true, message: 'Hotspot user created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete Hotspot user
router.delete('/hotspot/users/:name', async (req, res) => {
  try {
    const { connection_id } = req.query;
    const { name } = req.params;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    await executeCommand(device, '/ip/hotspot/user/remove', { 'numbers': name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle Hotspot user
router.post('/hotspot/users/:name/toggle', async (req, res) => {
  try {
    const { connection_id } = req.query;
    const { name } = req.params;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const users = await getFromMikrotik(device, '/ip/hotspot/user');
    const user = users.find(u => u.name === name);
    const isDisabled = user?.disabled === 'true' || user?.disabled === 'yes';

    await executeCommand(device, '/ip/hotspot/user/set', { 'numbers': name, 'disabled': isDisabled ? 'no' : 'yes' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get Hotspot profiles
router.get('/hotspot/profiles', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ip/hotspot/profile');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create Hotspot profile
router.post('/hotspot/profiles', async (req, res) => {
  try {
    const { connection_id, name, rate_limit, shared_users, session_timeout, idle_timeout, login_by, advertising } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const args = { name };
    if (rate_limit) args['rate-limit'] = rate_limit;
    if (shared_users) args['shared-users'] = shared_users;
    if (session_timeout) args['session-timeout'] = session_timeout;
    if (idle_timeout) args['idle-timeout'] = idle_timeout;
    if (login_by) args['login-by'] = login_by;
    if (advertising) args.advertising = advertising;

    await executeCommand(device, '/ip/hotspot/profile/add', args);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete Hotspot profile
router.delete('/hotspot/profiles/:name', async (req, res) => {
  try {
    const { connection_id } = req.query;
    const { name } = req.params;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    await executeCommand(device, '/ip/hotspot/profile/remove', { 'numbers': name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get Hotspot active sessions
router.get('/hotspot/active', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ip/hotspot/active');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Kick Hotspot user
router.post('/hotspot/active/:address/kick', async (req, res) => {
  try {
    const { connection_id } = req.query;
    const { address } = req.params;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    await executeCommand(device, '/ip/hotspot/active/remove', { 'numbers': address });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get Hotspot vouchers
router.get('/vouchers', async (req, res) => {
  try {
    const db = global.db || require('../db/memory');
    const result = await db.query('SELECT * FROM hotspot_vouchers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create Hotspot vouchers (batch)
router.post('/vouchers', async (req, res) => {
  try {
    const { vouchers, connection_id } = req.body;
    const db = global.db || require('../db/memory');
    const { v4: uuidv4 } = require('uuid');

    for (const v of vouchers) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO hotspot_vouchers (id, username, password, profile, valid_for, rate_limit, data_limit, price, company_name, connection_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, v.username, v.password, v.profile, v.valid_for, v.rate_limit, v.data_limit, v.price, v.company_name, v.connection_id || connection_id, new Date().toISOString()]
      );
    }

    // Push to Mikrotik if connection selected
    if (connection_id && vouchers.length > 0) {
      const device = await getMikrotikConnection(connection_id);
      for (const v of vouchers) {
        const args = { name: v.username, password: v.password };
        if (v.profile) args.profile = v.profile;
        if (v.rate_limit) args['rate-limit'] = v.rate_limit;
        if (v.comment) args.comment = v.comment;
        try { await executeCommand(device, '/ip/hotspot/user/add', args); } catch (e) { console.error(`Failed to create user ${v.username}:`, e.message); }
      }
    }

    res.json({ success: true, count: vouchers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete voucher
router.delete('/vouchers/:id', async (req, res) => {
  try {
    const db = global.db || require('../db/memory');
    await db.query('DELETE FROM hotspot_vouchers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// NETWORK SERVICES ROUTES
// ═══════════════════════════════════════

// Get Simple Queues
router.get('/network/queues', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/queue/simple');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create Simple Queue
router.post('/network/queues', async (req, res) => {
  try {
    const { connection_id, name, target, max_limit, priority, parent, comment } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const args = { name };
    if (target) args.target = target;
    if (max_limit) args['max-limit'] = max_limit;
    if (priority) args.priority = priority;
    if (parent) args.parent = parent;
    if (comment) args.comment = comment;

    await executeCommand(device, '/queue/simple/add', args);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete queue
router.delete('/network/queues/:name', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    await executeCommand(device, '/queue/simple/remove', { 'numbers': req.params.name });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle queue
router.post('/network/queues/:name/toggle', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const queues = await getFromMikrotik(device, '/queue/simple');
    const queue = queues.find(q => q.name === req.params.name);
    const isDisabled = queue?.disabled === 'true' || queue?.disabled === 'yes';

    await executeCommand(device, '/queue/simple/set', { 'numbers': req.params.name, 'disabled': isDisabled ? 'no' : 'yes' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get DHCP Leases
router.get('/network/dhcp-leases', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ip/dhcp-server/lease');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get DHCP Networks
router.get('/network/dhcp-networks', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ip/dhcp-server/network');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get DHCP Servers
router.get('/network/dhcp-servers', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ip/dhcp-server');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get DNS Settings
router.get('/network/dns', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json(null);

    const device = await getMikrotikConnection(connection_id);
    const MikroNode = require('mikronode');
    const mikrotik = new MikroNode(device.ip_address, { port: device.api_port || 8728 });
    const connection = await mikrotik.connect(device.username, device.password);
    const close = connection.closeOnDone(true);
    const chan = connection.openChannel();
    chan.write('/ip/dns/print');
    const result = await chan.done;
    close();
    res.json(Array.isArray(result) && result.length > 0 ? result[0] : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get Firewall rules
router.get('/network/firewall', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json([]);

    const device = await getMikrotikConnection(connection_id);
    const result = await getFromMikrotik(device, '/ip/firewall/filter');
    res.json(Array.isArray(result) ? result : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create Firewall rule
router.post('/network/firewall', async (req, res) => {
  try {
    const { connection_id, chain, action, src_address, dst_address, protocol, dst_port, comment } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const args = { chain: chain || 'forward', action };
    if (src_address) args['src-address'] = src_address;
    if (dst_address) args['dst-address'] = dst_address;
    if (protocol) args.protocol = protocol;
    if (dst_port) args['dst-port'] = dst_port;
    if (comment) args.comment = comment;

    await executeCommand(device, '/ip/firewall/filter/add', args);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete Firewall rule
router.delete('/network/firewall/:id', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    await executeCommand(device, '/ip/firewall/filter/remove', { 'numbers': req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle Firewall rule
router.post('/network/firewall/:id/toggle', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    const device = await getMikrotikConnection(connection_id);
    const rules = await getFromMikrotik(device, '/ip/firewall/filter');
    const rule = rules.find(r => r['.id'] === req.params.id || r.id === req.params.id);
    const isDisabled = rule?.disabled === 'true' || rule?.disabled === 'yes';

    await executeCommand(device, '/ip/firewall/filter/set', { 'numbers': req.params.id, 'disabled': isDisabled ? 'no' : 'yes' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// WIREGUARD ROUTES
// ═══════════════════════════════════════

// Create WireGuard interface
router.post('/network/wireguard/interface', async (req, res) => {
  try {
    const { connection_id, name, 'private-key': privateKey, 'listen-port': listenPort, mtu } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });
    if (!name) return res.status(400).json({ error: 'Interface name is required' });

    const device = await getMikrotikConnection(connection_id);
    const args = { name };
    if (privateKey) args['private-key'] = privateKey;
    if (listenPort) args['listen-port'] = listenPort;
    if (mtu) args.mtu = mtu;

    await executeCommand(device, '/interface wireguard add', args);
    res.json({ success: true, message: 'WireGuard interface created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create WireGuard peer
router.post('/network/wireguard/peer', async (req, res) => {
  try {
    const { connection_id, interface: interfaceName, 'public-key': publicKey, 'allowed-address': allowedAddress, endpoint } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });
    if (!publicKey) return res.status(400).json({ error: 'Public key is required' });

    const device = await getMikrotikConnection(connection_id);
    const args = { 'public-key': publicKey };
    if (interfaceName) args.interface = interfaceName;
    if (allowedAddress) args['allowed-address'] = allowedAddress;
    if (endpoint) args.endpoint = endpoint;

    await executeCommand(device, '/interface wireguard peers add', args);
    res.json({ success: true, message: 'WireGuard peer added' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
