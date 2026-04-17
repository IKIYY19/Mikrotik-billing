const express = require('express');
const router = express.Router();
const db = global.dbAvailable ? global.db : require('../db/memory');
const { v4: uuidv4 } = require('uuid');
const { resellerValidation } = require('../middleware/validation');
const logger = require('../utils/logger');

// ═══════════════════════════════════════
// RESELLERS
// ═══════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*,
              (SELECT COUNT(*) FROM customers WHERE reseller_id = r.id) as customer_count,
              (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN customers c ON c.id = p.customer_id WHERE c.reseller_id = r.id) as total_revenue
       FROM resellers r ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// CAPTIVE PORTALS
// ═══════════════════════════════════════
router.get('/captive-portals', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM captive_portals ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/captive-portals', async (req, res) => {
  try {
    const { name, elements, styles, hotspot_profile, connection_id } = req.body;
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO captive_portals (id, name, elements, styles, hotspot_profile, connection_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, name, JSON.stringify(elements), JSON.stringify(styles), hotspot_profile, connection_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/captive-portals/push', async (req, res) => {
  try {
    const { connection_id, html, profile } = req.body;
    if (!connection_id) return res.status(400).json({ error: 'Connection ID required' });

    // Get connection
    const connResult = await db.query('SELECT * FROM mikrotik_connections WHERE id = $1', [connection_id]);
    if (connResult.rows.length === 0) return res.status(404).json({ error: 'Connection not found' });

    // In production, would use mikronode to push HTML to /ip/hotspot/www
    // For now, just save and return success
    res.json({ success: true, message: 'Portal HTML ready for deployment. Connect MikroTik API to auto-push.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM resellers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', resellerValidation, async (req, res) => {
  try {
    const { name, company, email, phone, commission_rate, credit_limit, status } = req.body;
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO resellers (id, name, company, email, phone, commission_rate, credit_limit, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, name, company, email, phone, commission_rate || 10, credit_limit || 0, status || 'active']
    );
    logger.info('Reseller created', { id, name, email });
    res.status(201).json(result.rows[0]);
  } catch (e) { 
    logger.error('Failed to create reseller', { error: e.message });
    res.status(500).json({ error: e.message }); 
  }
});

router.put('/:id', [...resellerValidation.slice(0, -1)], async (req, res) => {
  try {
    const { name, company, email, phone, commission_rate, credit_limit, status } = req.body;
    const result = await db.query(
      `UPDATE resellers SET name = COALESCE($1, name), company = COALESCE($2, company),
       email = COALESCE($3, email), phone = COALESCE($4, phone), commission_rate = COALESCE($5, commission_rate),
       credit_limit = COALESCE($6, credit_limit), status = COALESCE($7, status)
       WHERE id = $8 RETURNING *`,
      [name, company, email, phone, commission_rate, credit_limit, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logger.info('Reseller updated', { id: req.params.id });
    res.json(result.rows[0]);
  } catch (e) { 
    logger.error('Failed to update reseller', { error: e.message });
    res.status(500).json({ error: e.message }); 
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM resellers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
