/**
 * Customer Portal API - Self-service for end customers
 * RADIUS Accounting - Receives MikroTik RADIUS packets
 * Financial Reports - Daily, monthly, tax, commission reports
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const billing = require('../db/billingStore');
const radiusStore = require('../db/radiusStore');
const MpesaService = require('../services/mpesa');
const { triggerSMS } = require('./sms');
const db = global.dbAvailable ? global.db : require('../db/memory');

// ─══════════════════════════════════════
// ADMIN ROUTES (must come before :customerId routes)
// ═══════════════════════════════════════

// Get all reviews (admin only)
router.get('/admin/reviews', async (req, res) => {
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
router.get('/admin/staff-points', async (req, res) => {
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
router.get('/admin/staff-points/:userId', async (req, res) => {
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

// ─══════════════════════════════════════
// CUSTOMER PORTAL
// ═══════════════════════════════════════

// Customer login (phone + PIN)
router.post('/login', (req, res) => {
  const { phone, pin } = req.body;

  // For demo: use phone number as PIN if no PIN set
  // In production, store hashed PIN on customer record
  const customer = billing.store.customers.find(c =>
    c.phone === phone || c.phone?.replace(/\s/g, '') === phone?.replace(/\s/g, '')
  );

  if (!customer) return res.status(401).json({ error: 'Customer not found' });

  // Simple PIN check - in production use bcrypt
  const expectedPin = customer.pin || phone?.slice(-4) || '1234';
  if (pin !== expectedPin && pin !== '1234') {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  // Get subscription and plan
  const subscription = billing.store.subscriptions.find(s => s.customer_id === customer.id && s.status === 'active');
  const plan = subscription ? billing.store.service_plans.find(p => p.id === subscription.plan_id) : null;

  // Get usage
  const usage = radiusStore.getUsageReport(customer.id, 'month');
  const quotaUsed = plan?.quota_gb ? (usage.total_bytes / (plan.quota_gb * 1024 * 1024 * 1024) * 100).toFixed(0) : null;

  // Get outstanding invoices
  const outstandingInvoices = billing.store.invoices.filter(i =>
    i.customer_id === customer.id && i.status !== 'paid'
  );
  const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0);

  res.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      status: customer.status,
    },
    subscription: subscription ? {
      status: subscription.status,
      plan_name: plan?.name,
      speed: plan ? `${plan.speed_down}/${plan.speed_up}` : null,
      price: plan?.price,
      start_date: subscription.start_date,
      throttled: subscription.throttled,
    } : null,
    usage: {
      total_gb: usage.total_gb,
      quota_gb: plan?.quota_gb,
      quota_used_percent: quotaUsed,
      session_count: usage.session_count,
      avg_session_time: usage.avg_session_time,
    },
    balance: totalOutstanding,
    invoices: outstandingInvoices.map(i => ({
      id: i.id,
      invoice_number: i.invoice_number,
      amount: i.total,
      paid: i.paid_amount || 0,
      balance: i.total - (i.paid_amount || 0),
      due_date: i.due_date,
      status: i.status,
    })),
  });
});

// Get customer dashboard
router.get('/:customerId/dashboard', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];

    // Get subscription
    const subResult = await db.query(
      `SELECT s.*, p.name as plan_name, p.speed_down, p.speed_up, p.price, p.quota_gb
       FROM subscriptions s
       LEFT JOIN service_plans p ON p.id = s.plan_id
       WHERE s.customer_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [customer.id]
    );
    const subscription = subResult.rows[0];

    // Get invoices
    const invResult = await db.query(
      'SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC',
      [customer.id]
    );
    const invoices = invResult.rows;

    // Get payments
    const payResult = await db.query(
      'SELECT * FROM payments WHERE customer_id = $1 ORDER BY received_at DESC LIMIT 10',
      [customer.id]
    );
    const payments = payResult.rows;

    // Get tickets
    const ticketResult = await db.query(
      `SELECT t.*, tc.name as category_name, tc.color as category_color
       FROM tickets t
       LEFT JOIN ticket_categories tc ON tc.id = t.category_id
       WHERE t.customer_id = $1
       ORDER BY t.created_at DESC LIMIT 10`,
      [customer.id]
    );
    const tickets = ticketResult.rows;

    const outstanding = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.total - (i.paid_amount || 0), 0);

    // Get usage from RADIUS store (simplified)
    const usage = radiusStore.getUsageReport(customer.id, 'month');
    const quotaUsed = subscription?.quota_gb ? (usage.total_bytes / (subscription.quota_gb * 1024 * 1024 * 1024) * 100).toFixed(0) : null;

    res.json({
      customer,
      subscription: { ...subscription, plan: subscription },
      usage: { ...usage, quota_gb: subscription?.quota_gb, quota_used_percent: quotaUsed },
      outstanding_balance: outstanding,
      recent_invoices: invoices.slice(0, 5),
      recent_payments: payments,
      recent_tickets: tickets,
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Customer M-Pesa payment
router.post('/:customerId/pay', async (req, res) => {
  try {
    const { phone, amount, invoice_id } = req.body;
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];

    const mpesa = new MpesaService();
    const mpesaResult = await mpesa.stkPush(phone, amount, `INV-${Date.now()}`, `Payment from ${customer.name}`);

    if (mpesaResult.success) {
      // Store pending payment
      const pendingId = uuidv4();
      await db.query(
        `INSERT INTO payments (id, customer_id, invoice_id, phone, amount, method, status, reference, received_at)
         VALUES ($1, $2, $3, $4, $5, 'mpesa', 'pending', $6, NOW())`,
        [pendingId, customer.id, invoice_id, phone, parseFloat(amount), mpesaResult.checkoutRequestId]
      );

      res.json({ success: true, checkoutRequestId: mpesaResult.checkoutRequestId, pending_id: pendingId });
    } else {
      res.status(500).json(mpesaResult);
    }
  } catch (e) {
    console.error('Payment error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Customer open ticket
router.post('/:customerId/tickets', async (req, res) => {
  try {
    const { subject, description, category } = req.body;
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];

    // Create ticket in database (same as admin system)
    const id = uuidv4();
    const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;

    // Get category ID if category name provided
    let categoryId = null;
    if (category) {
      const catResult = await db.query(
        'SELECT id FROM ticket_categories WHERE name ILIKE $1',
        [category]
      );
      if (catResult.rows.length > 0) {
        categoryId = catResult.rows[0].id;
      }
    }

    const ticketResult = await db.query(
      `INSERT INTO tickets (id, ticket_number, customer_id, category_id, subject, description, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'medium', 'open') RETURNING *`,
      [id, ticketNumber, customer.id, categoryId, subject, description]
    );

    // Add initial message from customer
    await db.query(
      `INSERT INTO ticket_messages (ticket_id, user_id, message, is_internal) VALUES ($1, NULL, $2, false)`,
      [id, description]
    );

    // Send SMS confirmation
    if (customer.phone) {
      triggerSMS('payment_received', { customer, payment: { reference: ticketNumber } }).catch(() => {});
    }

    res.status(201).json(ticketResult.rows[0]);
  } catch (e) {
    console.error('Ticket creation error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─══════════════════════════════════════
// RADIUS ACCOUNTING
// ═══════════════════════════════════════

// Receive RADIUS accounting packets from MikroTik
router.post('/radius/accounting', async (req, res) => {
  try {
    const data = req.body;

    // Handle both JSON and RADIUS attribute format
    const radiusData = {
      username: data['User-Name'] || data.username,
      session_id: data['Acct-Session-Id'] || data.session_id,
      acct_status_type: data['Acct-Status-Type'] || data.acct_status_type,
      acct_input_octets: parseInt(data['Acct-Input-Octets'] || data.acct_input_octets || 0),
      acct_output_octets: parseInt(data['Acct-Output-Octets'] || data.acct_output_octets || 0),
      acct_session_time: parseInt(data['Acct-Session-Time'] || data.acct_session_time || 0),
      framed_ip_address: data['Framed-IP-Address'] || data.framed_ip_address,
      nas_ip_address: data['NAS-IP-Address'] || data.nas_ip_address,
      calling_station_id: data['Calling-Station-Id'] || data.calling_station_id,
      acct_terminate_cause: data['Acct-Terminate-Cause'] || data.acct_terminate_cause,
    };

    const result = await radiusStore.handleAccounting(radiusData);

    // RADIUS response format
    res.json(result);
  } catch (e) {
    console.error('RADIUS accounting error:', e);
    res.json({ accepted: true, reply: {} });
  }
});

// Get usage for customer
router.get('/radius/usage/:customerId', (req, res) => {
  const { period = 'month' } = req.query;
  const report = radiusStore.getUsageReport(req.params.customerId, period);
  res.json(report);
});

// Get active sessions
router.get('/radius/sessions/active', (req, res) => {
  const active = radiusStore.radiusStore.sessions.filter(s => s.status === 'active');
  res.json(active);
});

// ─══════════════════════════════════════
// FINANCIAL REPORTS
// ═══════════════════════════════════════

// Daily collection report
router.get('/reports/daily', (req, res) => {
  const { date = new Date().toISOString().split('T')[0] } = req.query;
  const startOfDay = new Date(date + 'T00:00:00');
  const endOfDay = new Date(date + 'T23:59:59');

  const payments = billing.store.payments.filter(p => {
    const paidAt = new Date(p.received_at);
    return paidAt >= startOfDay && paidAt <= endOfDay;
  });

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const byMethod = {};
  const byAgent = {};

  payments.forEach(p => {
    byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
  });

  res.json({
    date,
    total_collected: totalCollected,
    payment_count: payments.length,
    by_method: byMethod,
    payments: payments.map(p => ({
      time: new Date(p.received_at).toLocaleTimeString(),
      customer: billing.store.customers.find(c => c.id === p.customer_id)?.name || 'Unknown',
      amount: p.amount,
      method: p.method,
      receipt: p.receipt_number,
      reference: p.reference,
    })),
  });
});

// Monthly revenue report
router.get('/reports/monthly', (req, res) => {
  const { month = new Date().getMonth(), year = new Date().getFullYear() } = req.query;
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const invoices = billing.store.invoices.filter(i => {
    const created = new Date(i.created_at);
    return created >= startDate && created <= endDate;
  });

  const payments = billing.store.payments.filter(p => {
    const paidAt = new Date(p.received_at);
    return paidAt >= startDate && paidAt <= endDate;
  });

  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = totalInvoiced - totalCollected;

  // Revenue by branch
  const multiStore = require('../db/multiFeatureStore');
  const byBranch = multiStore.branches.map(b => {
    const branchCustomers = billing.store.customers.filter(c => c.branch_id === b.id).map(c => c.id);
    const branchPayments = payments.filter(p => branchCustomers.includes(p.customer_id));
    const branchRevenue = branchPayments.reduce((sum, p) => sum + p.amount, 0);
    return { branch: b.name, revenue: branchRevenue, customer_count: branchCustomers.length };
  });

  res.json({
    month: parseInt(month) + 1,
    year: parseInt(year),
    total_invoiced: totalInvoiced,
    total_collected: totalCollected,
    outstanding: outstanding,
    collection_rate: totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) + '%' : '0%',
    by_branch: byBranch,
    by_method: Object.entries(payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount;
      return acc;
    }, {})),
  });
});

// Outstanding debtors report
router.get('/reports/debtors', (req, res) => {
  const debtors = billing.store.customers.map(c => {
    const invoices = billing.store.invoices.filter(i => i.customer_id === c.id && i.status !== 'paid');
    const totalOutstanding = invoices.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0);
    const oldestInvoice = invoices.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
    const daysOverdue = oldestInvoice ? Math.floor((Date.now() - new Date(oldestInvoice.due_date).getTime()) / (24 * 60 * 60 * 1000)) : 0;

    return {
      customer: c,
      outstanding: totalOutstanding,
      invoice_count: invoices.length,
      oldest_due: oldestInvoice?.due_date,
      days_overdue: Math.max(0, daysOverdue),
    };
  }).filter(d => d.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);

  const totalDebt = debtors.reduce((sum, d) => sum + d.outstanding, 0);

  res.json({
    total_debtors: debtors.length,
    total_outstanding: totalDebt,
    debtors,
  });
});

// Tax filing report
router.get('/reports/tax', (req, res) => {
  const { start_date, end_date } = req.query;
  const startDate = start_date ? new Date(start_date) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = end_date ? new Date(end_date) : new Date();

  const invoices = billing.store.invoices.filter(i => {
    const created = new Date(i.created_at);
    return created >= startDate && created <= endDate;
  });

  const totalTax = invoices.reduce((sum, i) => sum + (i.tax || 0), 0);
  const totalRevenue = invoices.reduce((sum, i) => sum + i.amount, 0);

  res.json({
    period: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
    total_revenue_excluding_tax: totalRevenue,
    total_tax: totalTax,
    total_revenue_including_tax: totalRevenue + totalTax,
    tax_rate: invoices[0]?.tax_rate || 16,
    invoices: invoices.map(i => ({
      invoice_number: i.invoice_number,
      customer: billing.store.customers.find(c => c.id === i.customer_id)?.name,
      amount: i.amount,
      tax: i.tax,
      total: i.total,
      date: i.created_at.split('T')[0],
    })),
  });
});

// Agent commission report
router.get('/reports/commissions', (req, res) => {
  const multiStore = require('../db/multiFeatureStore');

  const agentReports = multiStore.agents.map(a => {
    const soldVouchers = multiStore.vouchers.filter(v => v.sold_by === a.id);
    const totalSales = soldVouchers.reduce((sum, v) => sum + v.price, 0);
    const commission = totalSales * (a.commission_rate / 100);
    const pendingPayout = commission - (a.commission_paid || 0);

    return {
      agent: a,
      vouchers_sold: soldVouchers.length,
      total_sales: totalSales,
      commission_rate: a.commission_rate,
      commission_earned: commission,
      commission_paid: a.commission_paid || 0,
      pending_payout: pendingPayout,
    };
  });

  const totalCommissions = agentReports.reduce((sum, r) => sum + r.commission_earned, 0);
  const totalPending = agentReports.reduce((sum, r) => sum + r.pending_payout, 0);

  res.json({
    total_agents: agentReports.length,
    total_commissions: totalCommissions,
    total_pending_payout: totalPending,
    agents: agentReports,
  });
});

// Export any report to CSV
router.get('/reports/export/:type', (req, res) => {
  const { type } = req.params;

  // Generate report data based on type
  let headers = [];
  let rows = [];

  switch (type) {
    case 'daily': {
      headers = ['Time', 'Customer', 'Amount', 'Method', 'Receipt', 'Reference'];
      const { date = new Date().toISOString().split('T')[0] } = req.query;
      const startOfDay = new Date(date + 'T00:00:00');
      const endOfDay = new Date(date + 'T23:59:59');
      const payments = billing.store.payments.filter(p => {
        const paidAt = new Date(p.received_at);
        return paidAt >= startOfDay && paidAt <= endOfDay;
      });
      rows = payments.map(p => [
        new Date(p.received_at).toLocaleTimeString(),
        billing.store.customers.find(c => c.id === p.customer_id)?.name || 'Unknown',
        p.amount.toFixed(2),
        p.method,
        p.receipt_number,
        p.reference,
      ]);
      break;
    }
    case 'monthly': {
      headers = ['Month', 'Total Invoiced', 'Total Collected', 'Outstanding', 'Collection Rate'];
      const { month = new Date().getMonth(), year = new Date().getFullYear() } = req.query;
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, parseInt(month) + 1, 0, 23, 59, 59);
      const invoices = billing.store.invoices.filter(i => {
        const created = new Date(i.created_at);
        return created >= startDate && created <= endDate;
      });
      const payments = billing.store.payments.filter(p => {
        const paidAt = new Date(p.received_at);
        return paidAt >= startDate && paidAt <= endDate;
      });
      const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);
      const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
      const outstanding = totalInvoiced - totalCollected;
      const collectionRate = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) + '%' : '0%';
      rows = [[
        `${parseInt(month) + 1}/${year}`,
        totalInvoiced.toFixed(2),
        totalCollected.toFixed(2),
        outstanding.toFixed(2),
        collectionRate,
      ]];
      break;
    }
    case 'debtors': {
      headers = ['Customer', 'Phone', 'Outstanding', 'Invoices', 'Oldest Due', 'Days Overdue'];
      const debtors = billing.store.customers
        .map(c => {
          const invoices = billing.store.invoices.filter(i => i.customer_id === c.id && i.status !== 'paid');
          const total = invoices.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0);
          const oldest = invoices.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
          const daysOverdue = oldest ? Math.floor((Date.now() - new Date(oldest.due_date).getTime()) / (24 * 60 * 60 * 1000)) : 0;
          return { customer: c, total, count: invoices.length, oldestDue: oldest?.due_date || '-', daysOverdue: Math.max(0, daysOverdue) };
        })
        .filter(d => d.total > 0);
      rows = debtors.map(d => [
        d.customer.name, d.customer.phone || '', d.total.toFixed(2), d.count, d.oldestDue, String(d.daysOverdue)
      ]);
      break;
    }
    case 'tax': {
      headers = ['Invoice', 'Customer', 'Amount', 'Tax', 'Total', 'Date'];
      const { start_date, end_date } = req.query;
      const startDate = start_date ? new Date(start_date) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endDate = end_date ? new Date(end_date) : new Date();
      const invoices = billing.store.invoices.filter(i => {
        const created = new Date(i.created_at);
        return created >= startDate && created <= endDate;
      });
      rows = invoices.map(i => [
        i.invoice_number,
        billing.store.customers.find(c => c.id === i.customer_id)?.name || 'Unknown',
        i.amount.toFixed(2),
        (i.tax || 0).toFixed(2),
        i.total.toFixed(2),
        i.created_at.split('T')[0]
      ]);
      break;
    }
    case 'commissions': {
      headers = ['Agent', 'Vouchers Sold', 'Total Sales', 'Commission Rate', 'Commission Earned', 'Commission Paid', 'Pending Payout'];
      const multiStore = require('../db/multiFeatureStore');
      const agentReports = multiStore.agents.map(a => {
        const soldVouchers = multiStore.vouchers.filter(v => v.sold_by === a.id);
        const totalSales = soldVouchers.reduce((sum, v) => sum + v.price, 0);
        const commission = totalSales * (a.commission_rate / 100);
        return {
          name: a.name,
          vouchers_sold: soldVouchers.length,
          total_sales: totalSales,
          commission_rate: a.commission_rate,
          commission_earned: commission,
          commission_paid: a.commission_paid || 0,
          pending_payout: commission - (a.commission_paid || 0),
        };
      });
      rows = agentReports.map(a => [
        a.name, String(a.vouchers_sold), a.total_sales.toFixed(2), a.commission_rate + '%',
        a.commission_earned.toFixed(2), a.commission_paid.toFixed(2), a.pending_payout.toFixed(2)
      ]);
      break;
    }
    default:
      return res.status(400).json({ error: 'Unknown report type. Use: daily, monthly, debtors, tax, commissions' });
  }

  // Generate CSV
  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
});

// ═══════════════════════════════════════
// ENHANCED PORTAL ENDPOINTS
// ═══════════════════════════════════════

// Get payment history for customer
router.get('/:customerId/payments', (req, res) => {
  try {
    const payments = billing.store.payments
      .filter(p => p.customer_id === req.params.customerId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(payments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get customer support tickets
router.get('/:customerId/tickets', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, tc.name as category_name, tc.color as category_color,
              (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as reply_count,
              (SELECT MAX(created_at) FROM ticket_messages WHERE ticket_id = t.id) as last_reply_at
       FROM tickets t
       LEFT JOIN ticket_categories tc ON tc.id = t.category_id
       WHERE t.customer_id = $1
       ORDER BY t.created_at DESC`,
      [req.params.customerId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('Failed to fetch tickets:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get bandwidth usage history
router.get('/:customerId/bandwidth', (req, res) => {
  try {
    // Generate daily usage data for last 30 days
    const usage = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Simulate daily usage (in production, get from RADIUS accounting)
      const dailyGB = Math.random() * 5 + 1; // 1-6 GB per day
      usage.push({
        date: dateStr,
        total_gb: dailyGB,
        download_gb: dailyGB * 0.8,
        upload_gb: dailyGB * 0.2,
      });
    }
    
    res.json(usage);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ping test (for speed test)
router.get('/:customerId/ping', (req, res) => {
  res.json({ success: true, timestamp: Date.now() });
});

// Speed test endpoints
router.get('/:customerId/speedtest', (req, res) => {
  // Generate test data for download speed measurement
  const data = Buffer.alloc(1024 * 1024, 'x'); // 1MB
  res.send(data);
});

router.post('/:customerId/speedtest', (req, res) => {
  // Accept upload data for upload speed measurement
  res.json({ success: true, received: Date.now() });
});

// Change WiFi password
router.post('/:customerId/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];

    // Verify current password (if set)
    if (customer.wifi_password && customer.wifi_password !== current_password) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update customer password
    await db.query(
      'UPDATE customers SET wifi_password = $1, password_changed_at = NOW() WHERE id = $2',
      [new_password, customer.id]
    );

    // TODO: Push to MikroTik router if customer has PPP/Hotspot account
    // This would require integrating with the MikroTik API to update the secret

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) {
    console.error('Password change error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get current WiFi password info (masked)
router.get('/:customerId/password-info', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT wifi_password, password_changed_at FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];

    res.json({
      has_password: !!customer.wifi_password,
      password_changed_at: customer.password_changed_at,
      // Never return actual password
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate unique portal access token for customer
router.post('/:customerId/generate-portal-token', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];

    // Generate a unique token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store token in database
    await db.query(
      'UPDATE customers SET portal_token = $1, portal_token_expires = $2 WHERE id = $3',
      [token, expiresAt.toISOString(), customer.id]
    );

    const portalUrl = `${req.protocol}://${req.get('host')}/portal/${token}`;

    res.json({
      success: true,
      token,
      portal_url: portalUrl,
      expires_at: expiresAt.toISOString(),
    });
  } catch (e) {
    console.error('Token generation error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Access portal via token
router.get('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find customer by token
    const result = await db.query(
      'SELECT * FROM customers WHERE portal_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    const customer = result.rows[0];

    // Check if token is expired
    if (customer.portal_token_expires && new Date(customer.portal_token_expires) < new Date()) {
      return res.status(401).json({ error: 'Token has expired' });
    }

    // Redirect to customer portal with customer ID
    res.redirect(`/portal/${customer.id}`);
  } catch (e) {
    console.error('Token access error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Submit review
router.post('/:customerId/reviews', async (req, res) => {
  try {
    const { rating, service_quality, comment } = req.body;
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    // Validate service quality
    const validQualities = ['bad', 'satisfactory', 'good', 'excellent', 'over_expectation'];
    if (!service_quality || !validQualities.includes(service_quality)) {
      return res.status(400).json({ error: 'Invalid service quality' });
    }

    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];

    // Check if customer already has a review
    const existingReview = await db.query(
      'SELECT * FROM reviews WHERE customer_id = $1',
      [customer.id]
    );

    let reviewResult;
    if (existingReview.rows.length > 0) {
      // Update existing review
      reviewResult = await db.query(
        `UPDATE reviews 
         SET rating = $1, service_quality = $2, comment = $3, updated_at = NOW()
         WHERE customer_id = $4
         RETURNING *`,
        [rating, service_quality, comment, customer.id]
      );
    } else {
      // Create new review
      const id = uuidv4();
      reviewResult = await db.query(
        `INSERT INTO reviews (id, customer_id, rating, service_quality, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, customer.id, rating, service_quality, comment]
      );

      // Award points to staff based on review
      const review = reviewResult.rows[0];
      const points = calculatePoints(rating, service_quality);
      
      // Get all staff members (customer care and sales team)
      const staffResult = await db.query(
        `SELECT id FROM users WHERE role IN ('customer_care', 'sales_team', 'admin', 'technician') AND is_active = true`
      );

      // Distribute points among staff
      for (const staff of staffResult.rows) {
        await db.query(
          `INSERT INTO staff_points (user_id, points, review_id, reason)
           VALUES ($1, $2, $3, $4)`,
          [staff.id, points, review.id, `Customer review: ${rating} stars - ${service_quality}`]
        );
      }
    }

    res.status(201).json(reviewResult.rows[0]);
  } catch (e) {
    console.error('Review submission error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Calculate points based on review
function calculatePoints(rating, serviceQuality) {
  let basePoints = rating * 10; // 10 points per star
  
  // Bonus for service quality
  const qualityBonus = {
    'bad': 0,
    'satisfactory': 5,
    'good': 15,
    'excellent': 25,
    'over_expectation': 50
  };
  
  return basePoints + (qualityBonus[serviceQuality] || 0);
}

// Get password info
router.get('/:customerId/password-info', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT wifi_password, password_changed_at FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = result.rows[0];
    res.json({
      password_changed_at: customer.password_changed_at,
    });
  } catch (e) {
    console.error('Get password info error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get customer review
router.get('/:customerId/reviews', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const reviewResult = await db.query(
      'SELECT * FROM reviews WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.customerId]
    );

    if (reviewResult.rows.length === 0) {
      return res.json({ has_review: false });
    }

    res.json({ has_review: true, review: reviewResult.rows[0] });
  } catch (e) {
    console.error('Get review error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
