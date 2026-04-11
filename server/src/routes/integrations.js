/**
 * Integrations API Routes
 * Manage external service integrations (SMS, Payments, etc.)
 */

const express = require('express');
const router = express.Router();
const db = global.db || require('../db/memory');
const { encryptObject, decryptObject } = require('../utils/encryption');

// ─── GET ALL INTEGRATIONS ───
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM integrations ORDER BY category, display_name'
    );

    // Decrypt sensitive config data before sending
    const integrations = result.rows.map(integration => ({
      ...integration,
      config_data: decryptObject(integration.config_data),
    }));

    res.json(integrations);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// ─── GET SINGLE INTEGRATION ───
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM integrations WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integration = {
      ...result.rows[0],
      config_data: decryptObject(result.rows[0].config_data),
    };

    res.json(integration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── UPDATE INTEGRATION ───
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { config_data, is_active } = req.body;

    if (!config_data) {
      return res.status(400).json({ error: 'config_data is required' });
    }

    // Encrypt sensitive data before storing
    const encryptedConfig = encryptObject(config_data);

    const result = await db.query(
      `UPDATE integrations 
       SET config_data = $1, is_active = COALESCE($2, is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(encryptedConfig), is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integration = {
      ...result.rows[0],
      config_data: decryptObject(result.rows[0].config_data),
    };

    res.json({
      message: 'Integration updated successfully',
      integration,
    });
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// ─── TEST CONNECTION ───
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM integrations WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integration = result.rows[0];
    const config = decryptObject(integration.config_data);

    let testResult;

    switch (integration.service_name) {
      case 'africas_talking':
        testResult = await testAfricasTalking(config);
        break;
      case 'mpesa':
        testResult = await testMpesa(config);
        break;
      case 'whatsapp':
        testResult = await testWhatsApp(config);
        break;
      case 'sendgrid':
        testResult = await testSendGrid(config);
        break;
      case 'twilio':
        testResult = await testTwilio(config);
        break;
      case 'stripe':
        testResult = await testStripe(config);
        break;
      case 'slack':
        testResult = await testSlack(config);
        break;
      case 'discord':
        testResult = await testDiscord(config);
        break;
      default:
        testResult = { success: false, message: 'Unknown service' };
    }

    // Update last test status
    await db.query(
      `UPDATE integrations 
       SET last_tested = CURRENT_TIMESTAMP, last_test_status = $1, last_test_message = $2
       WHERE id = $3`,
      [testResult.success ? 'success' : 'error', testResult.message, id]
    );

    res.json({
      success: testResult.success,
      message: testResult.message,
      details: testResult.details,
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: 'Test failed' });
  }
});

// ─── TEST FUNCTIONS FOR EACH SERVICE ───

async function testAfricasTalking(config) {
  try {
    if (!config.api_key) {
      return { success: false, message: 'API key is required' };
    }

    const response = await fetch('https://api.sandbox.africastalking.com/version1/message', {
      method: 'GET',
      headers: {
        'ApiKey': config.api_key,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      return { success: true, message: 'Africa\'s Talking connected successfully' };
    }
    return { success: false, message: 'Invalid API key or service unavailable' };
  } catch (error) {
    return { success: false, message: 'Connection failed: ' + error.message };
  }
}

async function testMpesa(config) {
  try {
    if (!config.consumer_key || !config.consumer_secret) {
      return { success: false, message: 'Consumer key and secret are required' };
    }

    const auth = Buffer.from(`${config.consumer_key}:${config.consumer_secret}`).toString('base64');
    const response = await fetch(`https://${config.environment || 'sandbox'}.api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (response.ok) {
      return { success: true, message: 'M-Pesa authentication successful' };
    }
    return { success: false, message: 'Invalid consumer key or secret' };
  } catch (error) {
    return { success: false, message: 'Connection failed: ' + error.message };
  }
}

async function testWhatsApp(config) {
  try {
    if (!config.access_token) {
      return { success: false, message: 'Access token is required' };
    }

    const response = await fetch('https://graph.facebook.com/v17.0/me/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
      },
    });

    if (response.ok) {
      return { success: true, message: 'WhatsApp Business API connected successfully' };
    }
    return { success: false, message: 'Invalid access token' };
  } catch (error) {
    return { success: false, message: 'Connection failed: ' + error.message };
  }
}

async function testSendGrid(config) {
  try {
    if (!config.api_key) {
      return { success: false, message: 'API key is required' };
    }

    const response = await fetch('https://api.sendgrid.com/v3/user/settings/enforced_tls', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
      },
    });

    if (response.ok) {
      return { success: true, message: 'SendGrid connected successfully' };
    }
    return { success: false, message: 'Invalid API key' };
  } catch (error) {
    return { success: false, message: 'Connection failed: ' + error.message };
  }
}

async function testTwilio(config) {
  try {
    if (!config.account_sid || !config.auth_token) {
      return { success: false, message: 'Account SID and Auth Token are required' };
    }

    const auth = Buffer.from(`${config.account_sid}:${config.auth_token}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (response.ok) {
      return { success: true, message: 'Twilio connected successfully' };
    }
    return { success: false, message: 'Invalid credentials' };
  } catch (error) {
    return { success: false, message: 'Connection failed: ' + error.message };
  }
}

async function testStripe(config) {
  try {
    if (!config.secret_key) {
      return { success: false, message: 'Secret key is required' };
    }

    const response = await fetch('https://api.stripe.com/v1/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.secret_key}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        success: true, 
        message: 'Stripe connected successfully',
        details: `Available: ${(data.available[0]?.amount / 100).toFixed(2)} ${config.currency || 'usd'}`
      };
    }
    return { success: false, message: 'Invalid secret key' };
  } catch (error) {
    return { success: false, message: 'Connection failed: ' + error.message };
  }
}

async function testSlack(config) {
  try {
    if (!config.webhook_url) {
      return { success: false, message: 'Webhook URL is required' };
    }

    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '🔔 Test connection from MikroTik Billing' }),
    });

    if (response.ok) {
      return { success: true, message: 'Slack webhook sent successfully' };
    }
    return { success: false, message: 'Invalid webhook URL' };
  } catch (error) {
    return { success: false, message: 'Connection failed: ' + error.message };
  }
}

async function testDiscord(config) {
  try {
    if (!config.webhook_url) {
      return { success: false, message: 'Webhook URL is required' };
    }

    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '🔔 Test connection from MikroTik Billing' }),
    });

    if (response.ok || response.status === 204) {
      return { success: true, message: 'Discord webhook sent successfully' };
    }
    return { success: false, message: 'Invalid webhook URL' };
  } catch (error) {
    return { success: false, message: 'Connection failed: ' + error.message };
  }
}

module.exports = router;
