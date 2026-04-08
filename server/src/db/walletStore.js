/**
 * Prepaid Wallet System
 * Customers top up wallet → auto-deducts daily → suspends when empty
 */

const { v4: uuidv4 } = require('uuid');

const walletStore = {
  wallets: [],
  transactions: [],
  daily_rate_config: {},
};

// Seed sample wallets
const seedWallets = () => {
  if (walletStore.wallets.length > 0) return;
  const billing = require('./billingStore');

  billing.store.customers.forEach(c => {
    walletStore.wallets.push({
      id: uuidv4(),
      customer_id: c.id,
      balance: 0,
      daily_rate: 0,
      auto_renew: false,
      status: 'inactive', // inactive, active, suspended, expired
      activated_at: null,
      expires_at: null,
      last_deduction: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });
};
seedWallets();

// ─── Top Up Wallet ───
async function topUp(customerId, amount, paymentMethod = 'mpesa', reference = '') {
  let wallet = walletStore.wallets.find(w => w.customer_id === customerId);
  if (!wallet) {
    wallet = {
      id: uuidv4(),
      customer_id: customerId,
      balance: 0,
      daily_rate: 0,
      auto_renew: false,
      status: 'inactive',
      activated_at: null,
      expires_at: null,
      last_deduction: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    walletStore.wallets.push(wallet);
  }

  wallet.balance += parseFloat(amount);
  wallet.updated_at = new Date().toISOString();

  // Record transaction
  const transaction = {
    id: uuidv4(),
    wallet_id: wallet.id,
    customer_id: customerId,
    type: 'credit',
    amount: parseFloat(amount),
    method: paymentMethod,
    reference,
    balance_after: wallet.balance,
    created_at: new Date().toISOString(),
  };
  walletStore.transactions.push(transaction);

  // Auto-activate if balance > 0
  if (wallet.balance > 0 && wallet.status === 'inactive') {
    const billing = require('./billingStore');
    const sub = billing.store.subscriptions.find(s => s.customer_id === customerId && s.plan_id);
    const plan = sub ? billing.store.service_plans.find(p => p.id === sub.plan_id) : null;
    const dailyRate = plan ? plan.price / 30 : 1;

    wallet.daily_rate = dailyRate;
    wallet.status = 'active';
    wallet.activated_at = new Date().toISOString();
    wallet.expires_at = new Date(Date.now() + (wallet.balance / dailyRate) * 24 * 60 * 60 * 1000).toISOString();
  }

  // Update expiry
  if (wallet.balance > 0 && wallet.daily_rate > 0) {
    const daysLeft = wallet.balance / wallet.daily_rate;
    wallet.expires_at = new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000).toISOString();

    // If was suspended, reactivate
    if (wallet.status === 'suspended') {
      wallet.status = 'active';
      const billing = require('./billingStore');
      const sub = billing.store.subscriptions.find(s => s.customer_id === customerId);
      if (sub && sub.status === 'suspended') {
        sub.status = 'active';
        sub.updated_at = new Date().toISOString();
      }
    }
  }

  return { wallet, transaction };
}

// ─── Daily Deduction (runs via cron) ───
function runDailyDeductions() {
  const results = { deducted: [], suspended: [] };
  const today = new Date().toISOString().split('T')[0];

  for (const wallet of walletStore.wallets) {
    if (wallet.status !== 'active' || wallet.daily_rate <= 0) continue;

    // Skip if already deducted today
    if (wallet.last_deduction === today) continue;

    if (wallet.balance >= wallet.daily_rate) {
      // Deduct daily rate
      wallet.balance -= wallet.daily_rate;
      wallet.last_deduction = today;
      wallet.updated_at = new Date().toISOString();

      walletStore.transactions.push({
        id: uuidv4(),
        wallet_id: wallet.id,
        customer_id: wallet.customer_id,
        type: 'debit',
        amount: wallet.daily_rate,
        method: 'daily_subscription',
        reference: `Daily deduction ${today}`,
        balance_after: wallet.balance,
        created_at: new Date().toISOString(),
      });

      results.deducted.push({
        customer_id: wallet.customer_id,
        amount: wallet.daily_rate,
        balance: wallet.balance,
      });
    } else {
      // Insufficient balance - suspend
      wallet.status = 'suspended';
      wallet.updated_at = new Date().toISOString();

      walletStore.transactions.push({
        id: uuidv4(),
        wallet_id: wallet.id,
        customer_id: wallet.customer_id,
        type: 'suspension',
        amount: 0,
        method: 'insufficient_balance',
        reference: `Suspended - balance ${wallet.balance.toFixed(2)} < daily rate ${wallet.daily_rate.toFixed(2)}`,
        balance_after: wallet.balance,
        created_at: new Date().toISOString(),
      });

      // Suspend subscription
      const billing = require('./billingStore');
      const sub = billing.store.subscriptions.find(s => s.customer_id === wallet.customer_id);
      if (sub && sub.status === 'active') {
        sub.status = 'suspended';
        sub.updated_at = new Date().toISOString();
      }

      results.suspended.push({
        customer_id: wallet.customer_id,
        balance: wallet.balance,
        daily_rate: wallet.daily_rate,
      });
    }
  }

  return results;
}

// ─── Get Wallet ───
function getWallet(customerId) {
  return walletStore.wallets.find(w => w.customer_id === customerId) || null;
}

// ─── Get Transactions ───
function getTransactions(customerId, limit = 20) {
  return walletStore.transactions
    .filter(t => t.customer_id === customerId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

// ─── Get All Wallets ───
function getAllWallets() {
  const billing = require('./billingStore');
  return walletStore.wallets.map(w => {
    const customer = billing.store.customers.find(c => c.id === w.customer_id);
    return { ...w, customer_name: customer?.name, customer_phone: customer?.phone };
  });
}

// ─── Set Daily Rate ───
function setDailyRate(customerId, rate) {
  const wallet = walletStore.wallets.find(w => w.customer_id === customerId);
  if (wallet) {
    wallet.daily_rate = parseFloat(rate);
    wallet.updated_at = new Date().toISOString();
    if (wallet.balance > 0 && wallet.status === 'inactive') {
      wallet.status = 'active';
      wallet.activated_at = new Date().toISOString();
      wallet.expires_at = new Date(Date.now() + (wallet.balance / wallet.daily_rate) * 24 * 60 * 60 * 1000).toISOString();
    }
    return wallet;
  }
  return null;
}

// ─── Auto-set rates from plans ───
function autoSetRatesFromPlans() {
  const billing = require('./billingStore');
  for (const wallet of walletStore.wallets) {
    if (wallet.daily_rate > 0) continue;
    const sub = billing.store.subscriptions.find(s => s.customer_id === wallet.customer_id);
    const plan = sub ? billing.store.service_plans.find(p => p.id === sub.plan_id) : null;
    if (plan) {
      wallet.daily_rate = plan.price / 30;
      if (wallet.balance > 0) {
        wallet.status = 'active';
        wallet.activated_at = wallet.activated_at || new Date().toISOString();
        wallet.expires_at = new Date(Date.now() + (wallet.balance / wallet.daily_rate) * 24 * 60 * 60 * 1000).toISOString();
      }
      wallet.updated_at = new Date().toISOString();
    }
  }
}

module.exports = {
  walletStore,
  topUp,
  runDailyDeductions,
  getWallet,
  getTransactions,
  getAllWallets,
  setDailyRate,
  autoSetRatesFromPlans,
};
