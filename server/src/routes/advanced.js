/**
 * API Routes for: Prepaid Wallet, Map View, Auto Backup
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const walletStore = require('../db/walletStore');
const backupStore = require('../db/backupStore');
const billing = require('../db/billingStore');
const { triggerMessage } = require('./sms');

// ═══════════════════════════════════════
// PREPAID WALLET
// ═══════════════════════════════════════

router.get('/wallet/all', (req, res) => {
  walletStore.autoSetRatesFromPlans();
  res.json(walletStore.getAllWallets());
});

router.get('/wallet/:customerId', (req, res) => {
  const wallet = walletStore.getWallet(req.params.customerId);
  const transactions = walletStore.getTransactions(req.params.customerId);

  if (!wallet) {
    // Create wallet if doesn't exist
    const newWallet = walletStore.topUp(req.params.customerId, 0);
    return res.json({ wallet: newWallet.wallet, transactions: [] });
  }

  res.json({ wallet, transactions });
});

router.post('/wallet/:customerId/topup', async (req, res) => {
  const { amount, method = 'mpesa', reference } = req.body;
  if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const result = await walletStore.topUp(req.params.customerId, parseFloat(amount), method, reference);

  // Send confirmation SMS/WhatsApp
  const customer = billing.store.customers.find(c => c.id === req.params.customerId);
  if (customer?.phone) {
    triggerMessage('payment_received', {
      customer,
      payment: { reference: reference || result.transaction.id },
      invoice: { total: amount, paid_amount: amount },
    }).catch(() => {});
  }

  res.json(result);
});

router.post('/wallet/:customerId/set-rate', (req, res) => {
  const { daily_rate } = req.body;
  if (!daily_rate || parseFloat(daily_rate) <= 0) return res.status(400).json({ error: 'Invalid rate' });

  const wallet = walletStore.setDailyRate(req.params.customerId, parseFloat(daily_rate));
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  res.json(wallet);
});

router.post('/wallet/daily-run', async (req, res) => {
  const results = walletStore.runDailyDeductions();
  res.json(results);
});

// ═══════════════════════════════════════
// MAP / GIS
// ═══════════════════════════════════════

router.get('/map/data', (req, res) => {
  const multiStore = require('../db/multiFeatureStore');

  const branches = multiStore.branches.map(b => ({
    id: b.id,
    name: b.name,
    type: 'branch',
    lat: b.lat || (-1.2921 + Math.random() * 0.5), // Default Kenya coords
    lng: b.lng || (36.8219 + Math.random() * 0.5),
    city: b.city,
    status: b.status,
    active_pppoe: Math.floor(Math.random() * 50) + 10,
    online_routers: Math.floor(Math.random() * 3) + 1,
    total_routers: 3,
  }));

  const customers = billing.store.customers.map(c => {
    const sub = billing.store.subscriptions.find(s => s.customer_id === c.id && s.status === 'active');
    const wallet = walletStore.getWallet(c.id);
    const isSuspended = sub?.status === 'suspended' || wallet?.status === 'suspended';
    const isThrottled = sub?.throttled;

    return {
      id: c.id,
      name: c.name,
      type: 'customer',
      lat: c.lat || (-1.2 + Math.random() * 0.8),
      lng: c.lng || (36.7 + Math.random() * 0.6),
      status: isSuspended ? 'suspended' : isThrottled ? 'throttled' : 'active',
      phone: c.phone,
      plan: sub?.plan ? billing.store.service_plans.find(p => p.id === sub.plan_id)?.name : null,
      branch_id: c.branch_id,
    };
  });

  res.json({ branches, customers, center: [-1.2921, 36.8219], zoom: 10 });
});

router.put('/map/customer/:id', (req, res) => {
  const customer = billing.store.customers.find(c => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  if (req.body.lat !== undefined) customer.lat = req.body.lat;
  if (req.body.lng !== undefined) customer.lng = req.body.lng;

  res.json(customer);
});

// ═══════════════════════════════════════
// AUTO BACKUP
// ═══════════════════════════════════════

router.get('/backup/schedules', (req, res) => {
  res.json(backupStore.getAllSchedules());
});

router.get('/backup/schedules/:id', (req, res) => {
  const schedule = backupStore.getSchedule(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json(schedule);
});

router.post('/backup/schedules', (req, res) => {
  const schedule = backupStore.createSchedule(req.body);
  res.status(201).json(schedule);
});

router.put('/backup/schedules/:id', (req, res) => {
  const schedule = backupStore.updateSchedule(req.params.id, req.body);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json(schedule);
});

router.delete('/backup/schedules/:id', (req, res) => {
  const schedule = backupStore.deleteSchedule(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json({ message: 'Schedule deleted' });
});

router.post('/backup/schedules/:id/run', async (req, res) => {
  const result = await backupStore.runBackup(req.params.id);
  res.json(result);
});

router.post('/backup/run-all', async (req, res) => {
  const results = await backupStore.runAllBackups();
  res.json(results);
});

router.get('/backup/backups', (req, res) => {
  const backups = backupStore.getBackups(req.query.schedule_id, parseInt(req.query.limit) || 50);
  res.json(backups);
});

router.get('/backup/backups/:id', (req, res) => {
  const content = backupStore.getBackupContent(req.params.id);
  if (!content) return res.status(404).json({ error: 'Backup not found' });
  res.json(content);
});

module.exports = router;
