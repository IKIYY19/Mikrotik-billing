/**
 * Captive Portal Builder
 * Create and manage hotspot captive portal pages and configurations
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const getDb = () => global.dbAvailable ? global.db : require('../db/memory');

// ─── PORTAL TEMPLATES ───

// Get all portal templates
router.get('/templates', async (req, res) => {
  try {
    if (!global.db) {
      return res.json([]);
    }

    const result = await getDb().query(
      `SELECT pt.*,
        (SELECT COUNT(*) FROM mikrotik_connections WHERE captive_portal_template_id = pt.id) as usage_count
       FROM captive_portal_templates pt
       ORDER BY pt.name ASC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get portal template by ID
router.get('/templates/:id', async (req, res) => {
  try {
    const result = await getDb().query(
      'SELECT * FROM captive_portal_templates WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal template not found' });
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create portal template
router.post('/templates', async (req, res) => {
  try {
    const {
      name,
      description,
      theme,
      logo_url,
      background_image,
      primary_color,
      secondary_color,
      custom_css,
      custom_html,
      login_method,
      show_pricing,
      show_terms,
      terms_text,
      welcome_message
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!global.db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const id = uuidv4();
    const result = await getDb().query(
      `INSERT INTO captive_portal_templates (id, name, description, theme, logo_url, background_image, primary_color, secondary_color, custom_css, custom_html, login_method, show_pricing, show_terms, terms_text, welcome_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        id,
        name,
        description || '',
        theme || 'default',
        logo_url || '',
        background_image || '',
        primary_color || '#3b82f6',
        secondary_color || '#1e40af',
        custom_css || '',
        custom_html || '',
        login_method || 'voucher',
        show_pricing || false,
        show_terms || false,
        terms_text || '',
        welcome_message || 'Welcome to our WiFi'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error('Portal template creation error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update portal template
router.put('/templates/:id', async (req, res) => {
  try {
    const {
      name,
      description,
      theme,
      logo_url,
      background_image,
      primary_color,
      secondary_color,
      custom_css,
      custom_html,
      login_method,
      show_pricing,
      show_terms,
      terms_text,
      welcome_message
    } = req.body || {};

    if (!global.db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const result = await getDb().query(
      `UPDATE captive_portal_templates
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           theme = COALESCE($3, theme),
           logo_url = COALESCE($4, logo_url),
           background_image = COALESCE($5, background_image),
           primary_color = COALESCE($6, primary_color),
           secondary_color = COALESCE($7, secondary_color),
           custom_css = COALESCE($8, custom_css),
           custom_html = COALESCE($9, custom_html),
           login_method = COALESCE($10, login_method),
           show_pricing = COALESCE($11, show_pricing),
           show_terms = COALESCE($12, show_terms),
           terms_text = COALESCE($13, terms_text),
           welcome_message = COALESCE($14, welcome_message),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $15 RETURNING *`,
      [
        name,
        description,
        theme,
        logo_url,
        background_image,
        primary_color,
        secondary_color,
        custom_css,
        custom_html,
        login_method,
        show_pricing,
        show_terms,
        terms_text,
        welcome_message,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal template not found' });
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete portal template
router.delete('/templates/:id', async (req, res) => {
  try {
    if (!global.db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Check if template is in use
    const checkResult = await getDb().query(
      'SELECT COUNT(*) FROM mikrotik_connections WHERE captive_portal_template_id = $1',
      [req.params.id]
    );

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete portal template that is in use' });
    }

    const result = await getDb().query(
      'DELETE FROM captive_portal_templates WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal template not found' });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate portal HTML for a template
router.get('/templates/:id/preview', async (req, res) => {
  try {
    const result = await getDb().query(
      'SELECT * FROM captive_portal_templates WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal template not found' });
    }

    const template = result.rows[0];
    const html = generatePortalHTML(template);

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate MikroTik hotspot login page script
router.get('/templates/:id/mikrotik-script', async (req, res) => {
  try {
    const result = await getDb().query(
      'SELECT * FROM captive_portal_templates WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal template not found' });
    }

    const template = result.rows[0];
    const script = generateMikrotikScript(template);

    res.set('Content-Type', 'text/plain');
    res.set('Content-Disposition', 'attachment; filename="hotspot-login.rsc"');
    res.send(script);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper function to generate portal HTML
function generatePortalHTML(template) {
  const colors = {
    primary: template.primary_color || '#3b82f6',
    secondary: template.secondary_color || '#1e40af'
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hotspot Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${template.background_image ? `url(${template.background_image}) center/cover` : '#f3f4f6'};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      max-width: 400px;
      width: 90%;
    }
    .logo {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .logo img {
      max-width: 120px;
      max-height: 60px;
    }
    h1 {
      text-align: center;
      color: #1f2937;
      margin-bottom: 0.5rem;
    }
    .welcome {
      text-align: center;
      color: #6b7280;
      margin-bottom: 1.5rem;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #374151;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      font-size: 1rem;
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: ${colors.primary};
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: ${colors.secondary};
    }
    .terms {
      margin-top: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }
    ${template.custom_css || ''}
  </style>
</head>
<body>
  <div class="login-container">
    ${template.logo_url ? `<div class="logo"><img src="${template.logo_url}" alt="Logo"></div>` : ''}
    <h1>WiFi Login</h1>
    <p class="welcome">${template.welcome_message || 'Welcome to our WiFi'}</p>
    <form action="$(link-login-only)" method="post">
      <input type="hidden" name="dst" value="$(link-orig)">
      <input type="hidden" name="popup" value="true">
      <div class="form-group">
        <label>Username / Voucher</label>
        <input type="text" name="username" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password">
      </div>
      <button type="submit">Login</button>
      ${template.show_terms ? `<div class="terms">${template.terms_text || 'By logging in, you agree to our terms of service.'}</div>` : ''}
    </form>
  </div>
  ${template.custom_html || ''}
</body>
</html>`;
}

// Helper function to generate MikroTik script
function generateMikrotikScript(template) {
  return `# Hotspot Login Page Configuration
# Generated by MikroTik Billing System

/ip hotspot profile set default
  login-option=cookie
  http-cookie-lifetime=1d

/ip hotspot walled-garden
  add dst-host=www.google.com

# Copy this HTML to your hotspot login.html file
# or use the preview endpoint to get the full HTML`;
}

module.exports = router;
