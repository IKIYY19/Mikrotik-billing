/**
 * API Routes for: Branches, Agents, Vouchers, Monitoring, Auto-suspend
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multiStore = require('../db/multiFeatureStore');
const billing = require('../db/billingStore');

// ═══════════════════════════════════════
// BRANCHES
// ═══════════════════════════════════════
router.get('/branches', (req, res) => {
  const branchStats = multiStore.branches.map(b => {
    const customers = billing.store.customers.filter(c => c.branch_id === b.id).length;
    const routers = billing.store.routers ? billing.store.routers.filter(r => r.branch_id === b.id).length : 0;
    const revenue = billing.store.payments
      .filter(p => {
        const inv = billing.store.invoices.find(i => i.id === p.invoice_id);
        return inv && billing.store.customers.find(c => c.id === inv.customer_id)?.branch_id === b.id;
      })
      .reduce((sum, p) => sum + p.amount, 0);
    return { ...b, customer_count: customers, router_count: routers, revenue };
  });
  res.json(branchStats);
});

router.post('/branches', (req, res) => {
  const branch = { id: uuidv4(), ...req.body, created_at: new Date().toISOString(), status: 'active' };
  multiStore.branches.push(branch);
  res.status(201).json(branch);
});

// ═══════════════════════════════════════
// AGENTS/RESELLERS
// ═══════════════════════════════════════
router.get('/agents', (req, res) => {
  const agentStats = multiStore.agents.map(a => {
    const sold = multiStore.vouchers.filter(v => v.sold_by === a.id).length;
    const revenue = multiStore.vouchers.filter(v => v.sold_by === a.id).reduce((sum, v) => sum + v.price, 0);
    const commission = revenue * (a.commission_rate / 100);
    return { ...a, vouchers_sold: sold, voucher_revenue: revenue, commission_earned: commission };
  });
  res.json(agentStats);
});

router.post('/agents', (req, res) => {
  const agent = { id: uuidv4(), ...req.body, balance: 0, status: 'active', created_at: new Date().toISOString() };
  multiStore.agents.push(agent);
  res.status(201).json(agent);
});

router.put('/agents/:id', (req, res) => {
  const idx = multiStore.agents.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Agent not found' });
  multiStore.agents[idx] = { ...multiStore.agents[idx], ...req.body };
  res.json(multiStore.agents[idx]);
});

router.delete('/agents/:id', (req, res) => {
  const idx = multiStore.agents.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Agent not found' });
  multiStore.agents.splice(idx, 1);
  res.json({ message: 'Agent deleted' });
});

// ═══════════════════════════════════════
// VOUCHERS
// ═══════════════════════════════════════
router.get('/vouchers', (req, res) => {
  const { status, agent_id } = req.query;
  let filtered = [...multiStore.vouchers];
  if (status) filtered = filtered.filter(v => v.status === status);
  if (agent_id) filtered = filtered.filter(v => v.sold_by === agent_id);
  res.json(filtered);
});

router.post('/vouchers/generate', (req, res) => {
  const { count, plan_id, agent_id } = req.body;
  const plan = billing.store.service_plans.find(p => p.id === plan_id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const generated = [];
  for (let i = 0; i < (count || 1); i++) {
    const code = `VCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const voucher = {
      id: uuidv4(),
      code,
      plan_name: plan.name,
      plan_id: plan.id,
      duration_days: 30,
      price: plan.price,
      sold_by: agent_id || null,
      sold_to: '',
      status: agent_id ? 'sold' : 'available',
      redeemed_at: null,
      created_at: new Date().toISOString(),
    };
    multiStore.vouchers.push(voucher);
    generated.push(voucher);
  }

  // If agent specified, deduct from balance
  if (agent_id) {
    const agent = multiStore.agents.find(a => a.id === agent_id);
    if (agent) agent.balance -= generated.reduce((sum, v) => sum + v.price, 0);
  }

  res.json({ generated, total: generated.length });
});

router.post('/vouchers/redeem', (req, res) => {
  const { code, customer_id } = req.body;
  const voucher = multiStore.vouchers.find(v => v.code === code && v.status !== 'redeemed');

  if (!voucher) return res.status(404).json({ error: 'Invalid or already redeemed voucher' });

  voucher.status = 'redeemed';
  voucher.sold_to = customer_id || '';
  voucher.redeemed_at = new Date().toISOString();

  // Activate customer subscription
  const customer = billing.store.customers.find(c => c.id === customer_id);
  if (customer) {
    const plan = billing.store.service_plans.find(p => p.name === voucher.plan_name);
    billing.createSubscription({
      customer_id: customer_id,
      plan_id: plan?.id,
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
      billing_cycle: 'prepaid',
    });
  }

  res.json({ success: true, voucher });
});

// ═══════════════════════════════════════
// NETWORK MONITORING
// ═══════════════════════════════════════
router.get('/monitoring/dashboard', (req, res) => {
  // Refresh PPPoE sessions from current subscriptions
  multiStore.pppoeSessions.length = 0;
  billing.store.subscriptions.filter(s => s.pppoe_username && s.status === 'active').forEach(sub => {
    multiStore.pppoeSessions.push({
      id: uuidv4(),
      username: sub.pppoe_username,
      customer_name: sub.customer?.name || 'Unknown',
      plan_name: sub.plan?.name || 'Unknown',
      ip_address: `10.10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`,
      bytes_in: Math.floor(Math.random() * 5000000000),
      bytes_out: Math.floor(Math.random() * 10000000000),
      uptime_seconds: Math.floor(Math.random() * 86400 * 7),
      connected_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    });
  });

  const totalSessions = multiStore.pppoeSessions.length;
  const totalInGB = multiStore.pppoeSessions.reduce((s, p) => s + p.bytes_in, 0) / (1024 * 1024 * 1024);
  const totalOutGB = multiStore.pppoeSessions.reduce((s, p) => s + p.bytes_out, 0) / (1024 * 1024 * 1024);
  const branchMetrics = multiStore.branches.map(b => {
    const metrics = multiStore.deviceMetrics.filter(m => m.branch_id === b.id);
    const latest = metrics[metrics.length - 1] || {};
    return {
      branch: b,
      active_pppoe: latest.active_pppoe || 0,
      bandwidth_in: latest.bandwidth_in_mbps || 0,
      bandwidth_out: latest.bandwidth_out_mbps || 0,
      cpu: latest.cpu_usage || 0,
      memory: latest.memory_usage || 0,
      online_routers: latest.online_routers || 0,
      total_routers: latest.total_routers || 0,
    };
  });

  res.json({
    total_sessions: totalSessions,
    total_bandwidth_in_gb: totalInGB.toFixed(1),
    total_bandwidth_out_gb: totalOutGB.toFixed(1),
    branch_metrics: branchMetrics,
    sessions: multiStore.pppoeSessions,
    metrics_24h: multiStore.deviceMetrics.slice(-72),
  });
});

router.get('/monitoring/branch/:branchId', (req, res) => {
  const metrics = multiStore.deviceMetrics.filter(m => m.branch_id === req.params.branchId).slice(-24);
  res.json(metrics);
});

// ═══════════════════════════════════════
// AUTO-SUSPEND WITH GRACE PERIOD
// ═══════════════════════════════════════
router.get('/auto-suspend/config', (req, res) => {
  res.json(multiStore.graceConfig);
});

router.put('/auto-suspend/config', (req, res) => {
  Object.assign(multiStore.graceConfig, req.body);
  res.json(multiStore.graceConfig);
});

router.post('/auto-suspend/run', async (req, res) => {
  const { warn_days, throttle_days, suspend_days } = multiStore.graceConfig;
  const results = { warned: [], throttled: [], suspended: [] };

  // Find overdue invoices
  const overdueInvoices = billing.store.invoices.filter(i => i.status !== 'paid' && new Date(i.due_date) < new Date());

  for (const invoice of overdueInvoices) {
    const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (24 * 60 * 60 * 1000));
    const subs = billing.store.subscriptions.filter(s => s.customer_id === invoice.customer_id && s.status === 'active');

    for (const sub of subs) {
      if (daysOverdue >= suspend_days && sub.status === 'active') {
        sub.status = 'suspended';
        sub.updated_at = new Date().toISOString();
        results.suspended.push({ subscription_id: sub.id, customer: sub.customer?.name, days_overdue: daysOverdue });
      } else if (daysOverdue >= throttle_days && !sub.throttled) {
        sub.throttled = true;
        sub.throttle_speed = `${multiStore.graceConfig.throttle_speed_up}/${multiStore.graceConfig.throttle_speed_down}`;
        results.throttled.push({ subscription_id: sub.id, customer: sub.customer?.name, days_overdue: daysOverdue, throttle_speed: sub.throttle_speed });
      } else if (daysOverdue >= warn_days && !sub.warned) {
        sub.warned = true;
        results.warned.push({ subscription_id: sub.id, customer: sub.customer?.name, days_overdue: daysOverdue });
      }
    }
  }

  res.json({ success: true, results, config: multiStore.graceConfig });
});

// ═══════════════════════════════════════
// CUSTOMER BRANCH ASSIGNMENT
// ═══════════════════════════════════════
router.put('/customers/:id/branch', (req, res) => {
  const customer = billing.store.customers.find(c => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  customer.branch_id = req.body.branch_id || null;
  res.json(customer);
});

module.exports = router;
