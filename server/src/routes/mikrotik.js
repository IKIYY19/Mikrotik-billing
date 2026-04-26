const express = require('express');
const router = express.Router();
const db = global.db || require('../db/memory');
const { v4: uuidv4 } = require('uuid');

// Simple encryption for demo - use proper encryption in production
const crypto = require('crypto');
const algorithm = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Get all connections
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, ip_address, api_port, ssh_port, username, connection_type, use_tunnel, tunnel_host, tunnel_port, tunnel_username, is_online, last_seen, created_at, updated_at FROM mikrotik_connections');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create connection
router.post('/', async (req, res) => {
  try {
    const { name, ip_address, api_port, ssh_port, username, password, connection_type, use_tunnel, tunnel_host, tunnel_port, tunnel_username, tunnel_password } = req.body;
    const id = uuidv4();
    const encryptedPassword = encrypt(password);
    const encryptedTunnelPassword = use_tunnel && tunnel_password ? encrypt(tunnel_password) : null;

    const result = await db.query(
      `INSERT INTO mikrotik_connections (id, name, ip_address, api_port, ssh_port, username, password_encrypted, connection_type, use_tunnel, tunnel_host, tunnel_port, tunnel_username, tunnel_password_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, name, ip_address, api_port, ssh_port, username, connection_type, use_tunnel, tunnel_host, tunnel_port, tunnel_username, created_at`,
      [id, name, ip_address, api_port || 8728, ssh_port || 22, username, encryptedPassword, connection_type || 'api', use_tunnel || false, tunnel_host, tunnel_port || 22, tunnel_username, encryptedTunnelPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test connection
router.post('/test', async (req, res) => {
  try {
    const { ip_address, api_port, ssh_port, username, password, connection_type, use_tunnel, tunnel_host, tunnel_port, tunnel_username, tunnel_password } = req.body;

    if (connection_type === 'ssh') {
      // Test SSH connection
      const MikroTikSSHService = require('../services/mikrotikSSH');
      const sshService = MikroTikSSHService;

      try {
        if (use_tunnel) {
          // For SSH tunnel, we would need to establish the tunnel first
          // This is a simplified version - in production you'd use a proper SSH tunnel library
          return res.json({ success: false, message: 'SSH tunneling requires additional setup. Please use VPN or direct SSH access.' });
        }

        const connection = await sshService.createConnection({
          host: ip_address,
          port: ssh_port || 22,
          username,
          password,
        });

        const testResult = await sshService.testConnection(connection.id);
        await sshService.removeConnection(connection.id);

        if (testResult.success) {
          res.json({ success: true, message: 'SSH connection successful', data: testResult.data });
        } else {
          res.json({ success: false, message: testResult.error });
        }
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    } else {
      // Test API connection
      const MikroNode = require('mikronode');
      const device = new MikroNode(ip_address, { port: api_port || 8728 });

      try {
        const conn = await device.connect(username, password);
        const close = conn.closeOnDone(true);
        res.json({ success: true, message: 'API connection successful' });
        close();
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Push script to device
router.post('/push', async (req, res) => {
  try {
    const { connection_id, script, dry_run } = req.body;

    // Get connection details
    const conn = await db.query('SELECT * FROM mikrotik_connections WHERE id = $1', [connection_id]);
    if (conn.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const device = conn.rows[0];
    const password = decrypt(device.password_encrypted);

    if (dry_run) {
      return res.json({ 
        success: true, 
        message: 'Dry run - script would be executed',
        script_length: script.length,
        lines: script.split('\n').length 
      });
    }

    // Execute script
    const MikroNode = require('mikronode');
    const mikrotik = new MikroNode(device.ip_address, { port: device.api_port });

    try {
      const connection = await mikrotik.connect(device.username, password);
      const close = connection.closeOnDone(true);
      
      const chan = connection.openChannel();
      chan.write('/system/script/add', {
        name: `config-builder-${Date.now()}`,
        source: script,
      });
      
      const result = await chan.done;
      close();
      
      res.json({ success: true, message: 'Script pushed successfully', result });
    } catch (error) {
      res.json({ success: false, message: error.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete connection
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM mikrotik_connections WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check connectivity for a specific connection
router.post('/:id/check', async (req, res) => {
  try {
    const { id } = req.params;
    const routerConnectivityService = require('../services/routerConnectivity');
    await routerConnectivityService.checkConnectionNow(id);
    
    // Get updated connection status
    const result = await db.query(
      'SELECT id, name, ip_address, is_online, last_seen FROM mikrotik_connections WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    res.json({ success: true, connection: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disable alert routes - foreign key constraints causing black screen
/*
// Get alerts for a specific connection
router.get('/:id/alerts', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM alerts WHERE connection_id = $1';
    const params = [id];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all alerts (admin view)
router.get('/alerts/all', async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    
    let query = 'SELECT a.*, mc.name as connection_name, mc.ip_address FROM alerts a LEFT JOIN mikrotik_connections mc ON a.connection_id = mc.id WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND a.status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY a.created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge an alert
router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    const result = await db.query(
      'UPDATE alerts SET status = $1, acknowledged_by = $2, acknowledged_at = $3 WHERE id = $4 RETURNING *',
      ['acknowledged', userId, new Date().toISOString(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve an alert
router.post('/alerts/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'UPDATE alerts SET status = $1, resolved_at = $2 WHERE id = $3 RETURNING *',
      ['resolved', new Date().toISOString(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
*/

module.exports = router;
