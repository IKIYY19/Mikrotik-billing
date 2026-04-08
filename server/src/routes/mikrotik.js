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
    const result = await db.query('SELECT id, name, ip_address, api_port, username, created_at, updated_at FROM mikrotik_connections');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create connection
router.post('/', async (req, res) => {
  try {
    const { name, ip_address, api_port, username, password } = req.body;
    const id = uuidv4();
    const encryptedPassword = encrypt(password);

    const result = await db.query(
      `INSERT INTO mikrotik_connections (id, name, ip_address, api_port, username, password_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, ip_address, api_port, username, created_at`,
      [id, name, ip_address, api_port || 8728, username, encryptedPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test connection
router.post('/test', async (req, res) => {
  try {
    const { ip_address, api_port, username, password } = req.body;

    // Try to connect using mikronode
    const MikroNode = require('mikronode');
    const device = new MikroNode(ip_address, { port: api_port || 8728 });

    try {
      const conn = await device.connect(username, password);
      const close = conn.closeOnDone(true);
      res.json({ success: true, message: 'Connection successful' });
      close();
    } catch (error) {
      res.json({ success: false, message: error.message });
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

module.exports = router;
