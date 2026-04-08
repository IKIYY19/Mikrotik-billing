const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const provisionStore = require('../db/provisionStore');

const db = provisionStore;

// GET all devices
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let result;
    if (project_id) {
      result = await db.query('SELECT * FROM routers WHERE project_id = $1 ORDER BY created_at DESC', [project_id]);
    } else {
      result = await db.query('SELECT * FROM routers ORDER BY created_at DESC', []);
    }
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single device
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM routers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET device provision logs
router.get('/:id/logs', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM provision_logs WHERE router_id = $1 ORDER BY created_at DESC LIMIT 50', [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET provision script preview
router.get('/:id/script', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM routers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found' });
    const script = provisionStore.generateProvisionScript(result.rows[0]);
    res.json({ script });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE device
router.post('/', async (req, res) => {
  try {
    const {
      project_id, name, identity, model, mac_address, ip_address,
      wan_interface, lan_interface, dns_servers, ntp_servers,
      radius_server, radius_secret, radius_port,
      hotspot_enabled, pppoe_enabled, pppoe_interface, pppoe_service_name,
      mgmt_port, notes,
    } = req.body;

    const id = uuidv4();
    const token = provisionStore.generateToken();

    const result = await db.query(
      `INSERT INTO routers (id, project_id, name, identity, model, mac_address, ip_address,
       wan_interface, lan_interface, provision_token, provision_status,
       dns_servers, ntp_servers, radius_server, radius_secret, radius_port,
       hotspot_enabled, pppoe_enabled, pppoe_interface, pppoe_service_name,
       mgmt_port, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [id, project_id, name, identity || name, model || '', mac_address || '', ip_address || '',
       wan_interface || 'ether1', lan_interface || 'bridge1', token, 'pending',
       dns_servers || ['8.8.8.8', '8.8.4.4'], ntp_servers || ['pool.ntp.org'],
       radius_server || '', radius_secret || '', radius_port || 1812,
       hotspot_enabled || false, pppoe_enabled || false, pppoe_interface || '', pppoe_service_name || '',
       mgmt_port || 8728, notes || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE device
router.put('/:id', async (req, res) => {
  try {
    const {
      name, identity, model, mac_address, ip_address,
      wan_interface, lan_interface, dns_servers, ntp_servers,
      radius_server, radius_secret, radius_port,
      hotspot_enabled, pppoe_enabled, pppoe_interface, pppoe_service_name,
      mgmt_port, notes,
    } = req.body;

    const existing = await db.query('SELECT * FROM routers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Device not found' });

    const r = existing.rows[0];
    const result = await db.query(
      `UPDATE routers SET
        name = COALESCE($1, name), identity = COALESCE($2, identity),
        model = COALESCE($3, model), mac_address = COALESCE($4, mac_address),
        ip_address = COALESCE($5, ip_address), wan_interface = COALESCE($6, wan_interface),
        lan_interface = COALESCE($7, lan_interface), dns_servers = COALESCE($8, dns_servers),
        ntp_servers = COALESCE($9, ntp_servers), radius_server = COALESCE($10, radius_server),
        radius_secret = COALESCE($11, radius_secret), radius_port = COALESCE($12, radius_port),
        hotspot_enabled = COALESCE($13, hotspot_enabled), pppoe_enabled = COALESCE($14, pppoe_enabled),
        pppoe_interface = COALESCE($15, pppoe_interface), pppoe_service_name = COALESCE($16, pppoe_service_name),
        mgmt_port = COALESCE($17, mgmt_port), notes = COALESCE($18, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $19 RETURNING *`,
      [name || r.name, identity || r.identity, model || r.model, mac_address || r.mac_address,
       ip_address || r.ip_address, wan_interface || r.wan_interface, lan_interface || r.lan_interface,
       dns_servers || r.dns_servers, ntp_servers || r.ntp_servers,
       radius_server !== undefined ? radius_server : r.radius_server,
       radius_secret !== undefined ? radius_secret : r.radius_secret,
       radius_port || r.radius_port,
       hotspot_enabled !== undefined ? hotspot_enabled : r.hotspot_enabled,
       pppoe_enabled !== undefined ? pppoe_enabled : r.pppoe_enabled,
       pppoe_interface || r.pppoe_interface, pppoe_service_name || r.pppoe_service_name,
       mgmt_port || r.mgmt_port, notes !== undefined ? notes : r.notes,
       req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REGENERATE token
router.post('/:id/regenerate-token', async (req, res) => {
  try {
    const router = provisionStore._regenerateToken(req.params.id);
    if (!router) return res.status(404).json({ error: 'Device not found' });
    res.json({ id: router.id, provision_token: router.provision_token, provision_status: router.provision_status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE device
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM routers WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found' });
    res.json({ message: 'Device deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
