const express = require('express');
const router = express.Router();
const billing = require('../services/billingData');
const PPPoEProvisioner = require('../utils/pppoeProvisioner');
const { triggerSMS } = require('./sms');
const db = global.dbAvailable ? global.db : require('../db/memory');

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await billing.getDashboardStats();
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════
router.get('/customers', async (req, res) => {
  try {
    res.json(await billing.listCustomers());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await billing.getCustomerDetail(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/customers', async (req, res) => {
  try {
    const customer = await billing.createCustomer(req.body);
    // Generate portal URL
    const portalUrl = `${req.protocol}://${req.get('host')}/portal/${customer.portal_token}`;
    res.status(201).json({ ...customer, portal_url: portalUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/customers/:id', async (req, res) => {
  try {
    const customer = await billing.updateCustomer(req.params.id, req.body);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/customers/:id', async (req, res) => {
  try {
    const customer = await billing.deleteCustomer(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generate/regenerate portal URL for customer
router.post('/customers/:id/portal-url', async (req, res) => {
  try {
    const db = global.dbAvailable ? global.db : require('../db/memory');
    const { v4: uuidv4 } = require('uuid');
    
    const newToken = uuidv4();
    const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await db.query(
      `UPDATE customers 
       SET portal_token = $1, portal_token_expires = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, email, phone, portal_username, portal_token, portal_token_expires`,
      [newToken, tokenExpires, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customer = result.rows[0];
    const portalUrl = `${req.protocol}://${req.get('host')}/portal/${customer.portal_token}`;
    
    res.json({
      portal_url: portalUrl,
      portal_token: customer.portal_token,
      portal_token_expires: customer.portal_token_expires,
      portal_username: customer.portal_username || customer.email || customer.phone
    });
  } catch (e) {
    console.error('Generate portal URL error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get customer portal info
router.get('/customers/:id/portal-info', async (req, res) => {
  try {
    const db = global.dbAvailable ? global.db : require('../db/memory');
    
    const result = await db.query(
      `SELECT id, name, email, phone, portal_username, portal_token, portal_token_expires 
       FROM customers 
       WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customer = result.rows[0];
    const portalUrl = customer.portal_token ? `${req.protocol}://${req.get('host')}/portal/${customer.portal_token}` : null;
    
    res.json({
      portal_url: portalUrl,
      portal_token: customer.portal_token,
      portal_token_expires: customer.portal_token_expires,
      portal_username: customer.portal_username || customer.email || customer.phone
    });
  } catch (e) {
    console.error('Get portal info error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// SERVICE PLANS
// ═══════════════════════════════════════
router.get('/plans', async (req, res) => {
  try {
    res.json(await billing.listPlans());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/plans', async (req, res) => {
  try {
    const plan = await billing.createPlan(req.body);
    res.status(201).json(plan);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/plans/:id', async (req, res) => {
  try {
    const plan = await billing.updatePlan(req.params.id, req.body);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    const plan = await billing.deletePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ message: 'Plan deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════
router.get('/subscriptions', async (req, res) => {
  try {
    res.json(await billing.listSubscriptions());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/subscriptions', async (req, res) => {
  try {
    const sub = await billing.createSubscription(req.body);
    
    // Auto-generate first invoice
    const plan = sub.plan || await billing.getPlanById(sub.plan_id);
    if (plan) {
      await billing.createInvoice({
        customer_id: sub.customer_id,
        subscription_id: sub.id,
        amount: plan.price,
        tax: plan.price * 0.16,
        notes: `First invoice for ${plan.name}`,
      });
    }

    // Generate MikroTik provision script if PPPoE credentials provided
    let provisionScript = null;
    if (sub.auto_provision && sub.pppoe_username) {
      const customer = sub.customer || await billing.getCustomerById(sub.customer_id);
      provisionScript = PPPoEProvisioner.generateProvisioningScript('activate', { ...sub, customer, plan });
    }

    res.status(201).json({ ...sub, provision_script: provisionScript });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/subscriptions/:id', async (req, res) => {
  try {
    const sub = await billing.updateSubscription(req.params.id, req.body);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json(sub);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/subscriptions/:id/toggle', async (req, res) => {
  try {
    const sub = await billing.toggleSubscriptionStatus(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    // Generate MikroTik provisioning script
    const customer = sub.customer || await billing.getCustomerById(sub.customer_id);
    const plan = sub.plan || await billing.getPlanById(sub.plan_id);
    const action = sub.status === 'active' ? 'activate_existing' : 'suspend';
    const provisionScript = sub.pppoe_username
      ? PPPoEProvisioner.generateProvisioningScript(action, { ...sub, customer, plan })
      : null;

    // Send SMS notification
    if (customer?.phone) {
      triggerSMS(sub.status === 'active' ? 'service_restored' : 'service_suspended', {
        customer, sub, plan, invoice: null, payment: null,
      }).catch(e => console.error('SMS error:', e.message));
    }

    res.json({ ...sub, provision_script: provisionScript });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/subscriptions/:id', async (req, res) => {
  try {
    const deleted = await billing.deleteSubscription(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════
router.get('/invoices', async (req, res) => {
  try {
    const invoices = await billing.listInvoices();
    res.json(invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/invoices', async (req, res) => {
  try {
    const invoice = await billing.createInvoice(req.body);
    
    // Send SMS notification
    const customer = invoice.customer || await billing.getCustomerById(invoice.customer_id);
    if (customer?.phone) {
      triggerSMS('invoice_due_soon', { customer, invoice }).catch(e => console.error('SMS error:', e.message));
    }
    
    res.status(201).json(invoice);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/invoices/:id', async (req, res) => {
  try {
    const invoice = await billing.updateInvoice(req.params.id, req.body);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/invoices/generate-monthly', async (req, res) => {
  try {
    const created = await billing.generateMonthlyInvoices();
    res.json({ message: `Generated ${created.length} invoices`, invoices: created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════
router.get('/payments', async (req, res) => {
  try {
    const payments = await billing.listPayments();
    res.json(payments.sort((a, b) => new Date(b.received_at) - new Date(a.received_at)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payments', async (req, res) => {
  try {
    const payment = await billing.createPayment(req.body);
    
    // Send SMS confirmation
    const customer = payment.customer || await billing.getCustomerById(payment.customer_id);
    const invoice = payment.invoice || await billing.getInvoiceById(payment.invoice_id);
    if (customer?.phone) {
      triggerSMS('payment_received', { customer, invoice, payment }).catch(e => console.error('SMS error:', e.message));
    }
    
    res.status(201).json(payment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
// REAL-TIME ONLINE STATUS
// ═══════════════════════════════════════
router.get('/customers/online-status', async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id) return res.json({ online: {}, pppoe: [], hotspot: [], total: 0 });

    // Get MikroTik connection
    const db = global.db || require('../db/memory');
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32';

    const connResult = await db.query('SELECT * FROM mikrotik_connections WHERE id = $1', [connection_id]);
    if (connResult.rows.length === 0) return res.json({ online: {}, pppoe: [], hotspot: [], total: 0 });

    const device = connResult.rows[0];
    const [ivHex, authTagHex, encrypted] = device.password_encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    decipher.setAuthTag(authTag);
    let password = decipher.update(encrypted, 'hex', 'utf8');
    password += decipher.final('utf8');

    // Fetch active PPPoE and Hotspot sessions
    const MikroNode = require('mikronode');
    const mikrotik = new MikroNode(device.ip_address, { port: device.api_port || 8728 });
    const connection = await mikrotik.connect(device.username, password);
    const close = connection.closeOnDone(true);

    // Get PPPoE active sessions
    const pppoeChan = connection.openChannel();
    pppoeChan.write('/ppp/active/print');
    const pppoeActive = await pppoeChan.done;

    // Get Hotspot active sessions
    const hotspotChan = connection.openChannel();
    hotspotChan.write('/ip/hotspot/active/print');
    const hotspotActive = await hotspotChan.done;

    // Get PPPoE secrets to map username → customer
    const secretsChan = connection.openChannel();
    secretsChan.write('/ppp/secret/print', { '.proplist': 'name,comment' });
    await secretsChan.done;

    close();

    // Build online map: customer_id → session info
    const onlineMap = {};
    const pppoeOnline = [];
    const hotspotOnline = [];

    // Match PPPoE sessions to billing customers
    const allCustomers = await billing.listCustomers();
    const allSubscriptions = await billing.listSubscriptions();

    for (const session of (Array.isArray(pppoeActive) ? pppoeActive : [])) {
      const username = session.name || session.user;
      if (!username) continue;

      // Find subscription with this PPPoE username
      const sub = allSubscriptions.find(s => s.pppoe_username === username);
      if (sub) {
        onlineMap[sub.customer_id] = {
          type: 'pppoe',
          username,
          address: session.address,
          uptime: session.uptime,
          encoding: session.encoding,
          connected_at: new Date().toISOString(),
        };
        pppoeOnline.push({
          customer_id: sub.customer_id,
          customer_name: allCustomers.find(c => c.id === sub.customer_id)?.name || 'Unknown',
          username,
          address: session.address,
          uptime: session.uptime,
          encoding: session.encoding,
        });
      }
    }

    // Match Hotspot sessions to billing customers
    for (const session of (Array.isArray(hotspotActive) ? hotspotActive : [])) {
      const username = session.user;
      if (!username) continue;

      // Try to find customer by hotspot username match in subscriptions or custom field
      const sub = allSubscriptions.find(s => s.hotspot_username === username);
      if (sub) {
        const customerId = sub.customer_id;
        if (!onlineMap[customerId]) { // Don't override PPPoE if already online
          onlineMap[customerId] = {
            type: 'hotspot',
            username,
            address: session.address,
            uptime: session.uptime,
            mac: session['mac-address'],
            bytes_in: session['bytes-in'],
            bytes_out: session['bytes-out'],
            connected_at: new Date().toISOString(),
          };
          hotspotOnline.push({
            customer_id: customerId,
            customer_name: allCustomers.find(c => c.id === customerId)?.name || 'Unknown',
            username,
            address: session.address,
            uptime: session.uptime,
            mac: session['mac-address'],
            bytes_in: session['bytes-in'],
            bytes_out: session['bytes-out'],
          });
        }
      }
    }

    res.json({
      online: onlineMap,
      pppoe: pppoeOnline,
      hotspot: hotspotOnline,
      total: pppoeOnline.length + hotspotOnline.length,
    });
  } catch (e) {
    console.error('Online status error:', e);
    res.json({ online: {}, pppoe: [], hotspot: [], total: 0, error: e.message });
  }
});

// ═══════════════════════════════════════
// USAGE
// ═══════════════════════════════════════
router.get('/usage/:customerId', async (req, res) => {
  try {
    const records = await billing.listUsageRecords({
      customerId: req.params.customerId,
      limit: 100,
    });
    res.json(records);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/usage/record', async (req, res) => {
  try {
    const record = await billing.recordUsage(req.body);
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get aggregated usage history for bandwidth graphs
router.get('/usage/history', async (req, res) => {
  try {
    const { time_range = '1h', customer_id = '', connection_id = '' } = req.query;

    // Determine time window and grouping
    const now = new Date();
    let startTime, groupBy;
    switch (time_range) {
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        groupBy = '5m';
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        groupBy = '15m';
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = '1h';
        break;
      default: // 1h
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        groupBy = '1m';
    }

    // Get all usage records within the time window
    const records = await billing.listUsageRecords({
      customerId: customer_id || undefined,
      startTime,
      endTime: now,
      limit: 5000,
    });

    // If connection_id specified, get PPPoE sessions from MikroTik for real-time data
    let pppoeSessions = [];
    let pppoeBandwidth = { total_in: 0, total_out: 0 };

    if (connection_id) {
      try {
        const db = global.db || require('../db/memory');
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32';

        const connResult = await db.query('SELECT * FROM mikrotik_connections WHERE id = $1', [connection_id]);
        if (connResult.rows.length > 0) {
          const device = connResult.rows[0];
          const [ivHex, authTagHex, encrypted] = device.password_encrypted.split(':');
          const iv = Buffer.from(ivHex, 'hex');
          const authTag = Buffer.from(authTagHex, 'hex');
          const decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
          decipher.setAuthTag(authTag);
          let password = decipher.update(encrypted, 'hex', 'utf8');
          password += decipher.final('utf8');

          const MikroNode = require('mikronode');
          const mikrotik = new MikroNode(device.ip_address, { port: device.api_port || 8728 });
          const connection = await mikrotik.connect(device.username, password);
          const close = connection.closeOnDone(true);

          const pppoeChan = connection.openChannel();
          pppoeChan.write('/ppp/active/print');
          pppoeSessions = await pppoeChan.done;
          close();

          // Calculate total bandwidth from PPPoE sessions
          for (const session of (Array.isArray(pppoeSessions) ? pppoeSessions : [])) {
            const bytesIn = parseBytes(session['bytes-in'] || session.bytes_in);
            const bytesOut = parseBytes(session['bytes-out'] || session.bytes_out);
            pppoeBandwidth.total_in += bytesIn;
            pppoeBandwidth.total_out += bytesOut;
          }
        }
      } catch (e) {
        console.warn('[Billing] Failed to get PPPoE data:', e.message);
      }
    }

    // Aggregate records by time bucket
    const aggregated = aggregateByTimeRange(records, startTime, now, groupBy);

    // If no historical data, use current PPPoE session data to populate latest point
    if (aggregated.length === 0 && pppoeSessions.length > 0) {
      aggregated.push({
        time: now.toISOString(),
        download: pppoeBandwidth.total_out,
        upload: pppoeBandwidth.total_in,
        total: pppoeBandwidth.total_in + pppoeBandwidth.total_out,
        sessions: pppoeSessions.length,
      });
    }

    res.json({
      data: aggregated,
      time_range: time_range,
      group_by: groupBy,
      total_sessions: pppoeSessions.length,
      total_bandwidth_in: pppoeBandwidth.total_in,
      total_bandwidth_out: pppoeBandwidth.total_out,
    });
  } catch (e) {
    console.error('[Billing] Usage history error:', e);
    res.status(500).json({ error: e.message, data: [] });
  }
});

// Helper: parse MikroTik bytes string to integer
function parseBytes(bytesStr) {
  if (!bytesStr) return 0;
  const str = String(bytesStr);
  if (/^\d+$/.test(str)) return parseInt(str);
  const match = str.match(/^([\d.]+)\s*([KMGTP]i?B)?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase().replace('ib', '');
  const multipliers = { '': 1, k: 1024, m: 1048576, g: 1073741824, t: 1099511627776, p: 1125899906842624 };
  return Math.round(value * (multipliers[unit] || 1));
}

// Helper: aggregate usage records into time buckets
function aggregateByTimeRange(records, startTime, endTime, groupBy) {
  const buckets = [];
  let current = new Date(startTime);

  // Determine bucket size in milliseconds
  let bucketSize;
  switch (groupBy) {
    case '1m': bucketSize = 60 * 1000; break;
    case '5m': bucketSize = 5 * 60 * 1000; break;
    case '15m': bucketSize = 15 * 60 * 1000; break;
    case '1h': bucketSize = 60 * 60 * 1000; break;
    default: bucketSize = 60 * 1000;
  }

  while (current < endTime) {
    const bucketEnd = new Date(current.getTime() + bucketSize);
    const bucketRecords = records.filter(r => {
      const t = new Date(r.recorded_at);
      return t >= current && t < bucketEnd;
    });

    const download = bucketRecords.reduce((sum, r) => sum + (parseInt(r.bytes_out) || 0), 0);
    const upload = bucketRecords.reduce((sum, r) => sum + (parseInt(r.bytes_in) || 0), 0);
    const uniqueSessions = new Set(bucketRecords.map(r => r.session_id).filter(Boolean)).size;

    buckets.push({
      time: current.toISOString(),
      download,
      upload,
      total: download + upload,
      sessions: Math.max(uniqueSessions, bucketRecords.length),
    });

    current = bucketEnd;
  }

  return buckets;
}

// ═══════════════════════════════════════
// REVIEWS (Admin)
// ═══════════════════════════════════════

// Get all reviews (admin only)
router.get('/reviews', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       FROM reviews r
       LEFT JOIN customers c ON c.id = r.customer_id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (e) {
    console.error('Get all reviews error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get staff points leaderboard
router.get('/staff-points', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, COALESCE(SUM(sp.points), 0) as total_points
       FROM users u
       LEFT JOIN staff_points sp ON sp.user_id = u.id
       WHERE u.role IN ('customer_care', 'sales_team', 'admin', 'technician')
       GROUP BY u.id, u.name, u.email, u.role
       ORDER BY total_points DESC`
    );
    res.json(result.rows);
  } catch (e) {
    console.error('Get staff points error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get staff point history
router.get('/staff-points/:userId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sp.*, r.rating, r.service_quality, c.name as customer_name
       FROM staff_points sp
       LEFT JOIN reviews r ON r.id = sp.review_id
       LEFT JOIN customers c ON c.id = r.customer_id
       WHERE sp.user_id = $1
       ORDER BY sp.created_at DESC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('Get staff point history error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
