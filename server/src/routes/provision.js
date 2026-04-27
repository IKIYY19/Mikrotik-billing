const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const provisionStore = require('../db/provisionStore');
const memoryDb = require('../db/memory');

function getDb() {
  return global.db || memoryDb;
}

function getServerBaseUrl(req, explicitBaseUrl) {
  return explicitBaseUrl || process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
}

function buildProvisionCommand(serverUrl, token, method = 'script', delay = 0) {
  const cleanBaseUrl = serverUrl.replace(/\/$/, '');
  const scriptUrl = `${cleanBaseUrl}/mikrotik/provision/${token}`;
  const fetchScript = provisionStore.buildFetchCommand(scriptUrl, 'provision.rsc', true);
  const delaySec = parseInt(delay, 10) || 0;
  const delayCommand = delaySec > 0 ? `; :delay ${delaySec}s` : '';

  switch (method) {
    case 'fetch':
      return fetchScript;
    case 'inline':
      return `${fetchScript}${delayCommand}; /import file-name=provision.rsc; /file remove provision.rsc`;
    case 'script':
    case 'import':
    default:
      return `${fetchScript}${delayCommand}; /import file-name=provision.rsc`;
  }
}

// GET /mikrotik/provision/:token - Router downloads its config
router.get('/provision/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get('User-Agent') || 'unknown';

    // Find router by token
    const result = await getDb().query('SELECT * FROM routers WHERE provision_token = $1', [token]);
    
    if (result.rows.length === 0) {
      await getDb().query(
        'INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [uuidv4(), token, null, ip, ua, 'script_fetch', 'failed', 'Invalid token']
      );
      return res.status(404).type('text/plain').send('# ERROR: Invalid provisioning token');
    }

    const routerData = result.rows[0];

    // Log the fetch
    await getDb().query(
      'INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [uuidv4(), token, routerData.id, ip, ua, 'script_fetch', 'success', `Router: ${routerData.name}`]
    );

    // Generate the provisioning script
    const script = provisionStore.generateProvisionScript(routerData, {
      callbackBaseUrl: getServerBaseUrl(req),
    });

    // Log the event
    await getDb().query(
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
    const result = await getDb().query('SELECT * FROM routers WHERE provision_token = $1', [token]);
    
    if (result.rows.length === 0) {
      return res.type('text/plain').send('# ERROR: Invalid token');
    }

    const routerData = result.rows[0];

    // Mark as provisioned
    await getDb().query(
      `UPDATE routers
       SET provision_status = $1,
           last_provisioned_at = CURRENT_TIMESTAMP,
           provision_attempts = COALESCE(provision_attempts, 0) + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      ['provisioned', routerData.id]
    );

    // Log callback
    await getDb().query(
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
    const { method = 'import', baseUrl, delay = 0 } = req.query;

    // Find router
    const result = await getDb().query('SELECT * FROM routers WHERE id = $1', [routerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Router not found' });
    }

    const router = result.rows[0];
    const serverUrl = getServerBaseUrl(req, baseUrl);
    const token = router.provision_token;
    const command = buildProvisionCommand(serverUrl, token, method, delay);

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
    const { method = 'import', baseUrl, delay = 0 } = req.body;

    // Find router
    const result = await getDb().query('SELECT * FROM routers WHERE id = $1', [routerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Router not found' });
    }

    const newToken = provisionStore.generateToken();
    const updateResult = await getDb().query(
      `UPDATE routers
       SET provision_token = $1,
           provision_status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, provision_token`,
      [newToken, 'pending', routerId]
    );
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Router not found' });
    }

    const serverUrl = getServerBaseUrl(req, baseUrl);
    const token = updateResult.rows[0].provision_token;
    const command = buildProvisionCommand(serverUrl, token, method, delay);

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
