const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const provisionStore = require('../db/provisionStore');

const db = provisionStore;

// GET /mikrotik/provision/:token - Router downloads its config
router.get('/provision/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get('User-Agent') || 'unknown';

    // Find router by token
    const result = await db.query('SELECT * FROM routers WHERE provision_token = $1', [token]);
    
    if (result.rows.length === 0) {
      await db.query(
        'INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [uuidv4(), token, null, ip, ua, 'script_fetch', 'failed', 'Invalid token']
      );
      return res.status(404).type('text/plain').send('# ERROR: Invalid provisioning token');
    }

    const routerData = result.rows[0];

    // Log the fetch
    await db.query(
      'INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [uuidv4(), token, routerData.id, ip, ua, 'script_fetch', 'success', `Router: ${routerData.name}`]
    );

    // Generate the provisioning script
    const script = provisionStore.generateProvisionScript(routerData);

    // Log the event
    await db.query(
      'INSERT INTO provision_events (id, router_id, event_type, script_content) VALUES ($1, $2, $3, $4)',
      [uuidv4(), routerData.id, 'script_generated', script]
    );

    res.type('text/plain').send(script);
  } catch (error) {
    console.error('Provision error:', error);
    res.status(500).type('text/plain').send('# ERROR: Internal server error');
  }
});

// GET /mikrotik/provision/callback/:token - Router confirms provision
router.get('/provision/callback/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get('User-Agent') || 'unknown';

    // Find router
    const result = await db.query('SELECT * FROM routers WHERE provision_token = $1', [token]);
    
    if (result.rows.length === 0) {
      return res.type('text/plain').send('# ERROR: Invalid token');
    }

    const routerData = result.rows[0];

    // Mark as provisioned
    provisionStore._updateRouterStatus(routerData.id, 'provisioned');

    // Log callback
    await db.query(
      'INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [uuidv4(), token, routerData.id, ip, ua, 'callback', 'success', 'Router confirmed provisioning']
    );

    res.type('text/plain').send('# OK: Router marked as provisioned');
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).type('text/plain').send('# ERROR: Internal server error');
  }
});

// GET /mikrotik/provision/command/:routerId - Generate one-line provision command
router.get('/provision/command/:routerId', async (req, res) => {
  try {
    const { routerId } = req.params;
    const { method = 'import', baseUrl, useHttp } = req.query;

    // Find router
    const result = await db.query('SELECT * FROM routers WHERE id = $1', [routerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Router not found' });
    }

    const router = result.rows[0];
    const allowHttp = process.env.ALLOW_HTTP_PROVISION === 'true' || useHttp === 'true';
    const protocol = allowHttp ? 'http' : (baseUrl ? (baseUrl.startsWith('http') ? baseUrl.split('://')[0] : req.protocol) : req.protocol);
    const host = baseUrl ? baseUrl.replace(/https?:\/\//, '') : req.get('host');
    const serverUrl = protocol + '://' + host;
    const token = router.provision_token;

    let command;

    switch (method) {
      case 'import':
        // Import method - fetches and imports directly
        command = `/import file-name=provision.rsc \\\n  url="${serverUrl}/mikrotik/provision/${token}"`;
        break;
      
      case 'script':
        // Script method - fetches to file then runs
        command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc; \\\n  /import file-name=provision.rsc`;
        break;
      
      case 'fetch':
        // Fetch only - manual import
        command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc`;
        break;
      
      case 'inline':
        // Inline execution (for smaller configs)
        command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc; \\\n  /import file-name=provision.rsc; \\\n  /file remove provision.rsc`;
        break;
      
      default:
        command = `/import file-name=provision.rsc url="${serverUrl}/mikrotik/provision/${token}"`;
    }

    res.json({
      success: true,
      routerId,
      token,
      method,
      command,
      serverUrl,
      copyText: command.replace(/\\\n/g, ' '),
    });
  } catch (error) {
    console.error('Command generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /mikrotik/provision/command/:routerId - Regenerate token and get new command
router.post('/provision/command/:routerId', async (req, res) => {
  try {
    const { routerId } = req.params;
    const { method = 'import', baseUrl, useHttp } = req.body;

    // Find router
    const result = await db.query('SELECT * FROM routers WHERE id = $1', [routerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Router not found' });
    }

    // Regenerate token
    const router = provisionStore._regenerateToken(routerId);
    
    const allowHttp = process.env.ALLOW_HTTP_PROVISION === 'true' || useHttp === 'true';
    const protocol = allowHttp ? 'http' : (baseUrl ? (baseUrl.startsWith('http') ? baseUrl.split('://')[0] : req.protocol) : req.protocol);
    const host = baseUrl ? baseUrl.replace(/https?:\/\//, '') : req.get('host');
    const serverUrl = protocol + '://' + host;
    const token = router.provision_token;

    let command;

    switch (method) {
      case 'import':
        command = `/import file-name=provision.rsc url="${serverUrl}/mikrotik/provision/${token}"`;
        break;
      
      case 'script':
        command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc; /import file-name=provision.rsc`;
        break;
      
      case 'fetch':
        command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc`;
        break;
      
      case 'inline':
        command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc; /import file-name=provision.rsc; /file remove provision.rsc`;
        break;
      
      default:
        command = `/import file-name=provision.rsc url="${serverUrl}/mikrotik/provision/${token}"`;
    }

    res.json({
      success: true,
      routerId,
      token,
      method,
      command,
      serverUrl,
      copyText: command.replace(/\\\n/g, ' '),
      message: 'Token regenerated',
    });
  } catch (error) {
    console.error('Command regeneration error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
