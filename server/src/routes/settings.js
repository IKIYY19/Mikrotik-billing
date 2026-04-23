/**
 * Settings API Routes
 * Stores application-wide settings
 */

const express = require('express');
const router = express.Router();

// In-memory settings store (in production, use database)
const settingsStore = {
  company_name: '',
  company_logo: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  city: '',
  country: '',
  timezone: 'Africa/Nairobi',
  currency: 'KES',
  currency_symbol: 'KES',
  date_format: 'DD/MM/YYYY',
  invoice_prefix: 'INV-',
  invoice_start_number: '1001',
  payment_terms: '14',
  tax_rate: '16',
};

// Default permissions (can be overridden via API)
const permissionsStore = {
  admin: ['*'],
  staff: ['billing:read', 'billing:write', 'customers:read', 'customers:write', 'reports:read'],
  technician: ['network:read', 'network:write', 'monitoring:read', 'devices:read', 'devices:write'],
  reseller: ['customers:read', 'customers:write', 'billing:read', 'invoices:write'],
  customer: ['own:read', 'billing:read', 'tickets:write'],
};

// Feature access by role
const featureAccessStore = {
  admin: [
    'dashboard', 'topology', 'router-linking', 'devices', 'templates', 'mikrotik-api', 'integrations', 'settings',
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet', 'sms', 'whatsapp',
    'network-map', 'monitoring', 'agents', 'auto-suspend', 'reports', 'analytics', 'pppoe', 'hotspot',
    'vouchers', 'network-services', 'olt', 'radius', 'tickets', 'captive-portal', 'bandwidth', 'resellers',
    'backups', 'inventory', 'users',
  ],
  staff: [
    'dashboard', 'topology', 'router-linking',
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet', 'sms', 'whatsapp',
    'network-map', 'monitoring', 'reports', 'analytics', 'pppoe', 'hotspot', 'vouchers', 'tickets',
  ],
  technician: [
    'dashboard', 'devices', 'templates',
    'monitoring', 'bandwidth',
  ],
  reseller: [
    'dashboard',
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet',
  ],
  customer: [],
};

// Payment gateway settings
const paymentGatewayStore = {
  mpesa: {
    enabled: false,
    consumer_key: '',
    consumer_secret: '',
    passkey: '',
    shortcode: '',
    environment: 'sandbox', // sandbox or production
  },
  stripe: {
    enabled: false,
    publishable_key: '',
    secret_key: '',
    webhook_secret: '',
  },
  paypal: {
    enabled: false,
    client_id: '',
    client_secret: '',
    mode: 'sandbox', // sandbox or live
  },
};

// Bank paybill settings - Kenyan banks
const bankPaybillStore = {
  enabled: false,
  banks: [
    {
      name: 'Equity Bank',
      paybill: '247247',
      account_number: '',
      enabled: true,
    },
    {
      name: 'KCB Bank',
      paybill: '522522',
      account_number: '',
      enabled: true,
    },
    {
      name: 'Co-operative Bank',
      paybill: '400200',
      account_number: '',
      enabled: true,
    },
    {
      name: 'Standard Chartered',
      paybill: '320320',
      account_number: '',
      enabled: false,
    },
    {
      name: 'Absa Bank',
      paybill: '303030',
      account_number: '',
      enabled: false,
    },
    {
      name: 'NCBA Bank',
      paybill: '880200',
      account_number: '',
      enabled: false,
    },
    {
      name: 'Diamond Trust Bank',
      paybill: '444444',
      account_number: '',
      enabled: false,
    },
    {
      name: 'I&M Bank',
      paybill: '545500',
      account_number: '',
      enabled: false,
    },
  ],
};

// Get settings
router.get('/', (req, res) => {
  res.json(settingsStore);
});

// Update settings
router.put('/', (req, res) => {
  Object.assign(settingsStore, req.body);
  res.json(settingsStore);
});

// Get permissions
router.get('/permissions', (req, res) => {
  res.json(featureAccessStore);
});

// Update permissions
router.put('/permissions', (req, res) => {
  Object.assign(featureAccessStore, req.body);
  res.json(featureAccessStore);
});

// Get payment gateway settings
router.get('/payment-gateways', (req, res) => {
  res.json(paymentGatewayStore);
});

// Update payment gateway settings
router.put('/payment-gateways', (req, res) => {
  Object.assign(paymentGatewayStore, req.body);
  res.json(paymentGatewayStore);
});

// Get bank paybill settings
router.get('/bank-paybills', (req, res) => {
  res.json(bankPaybillStore);
});

// Update bank paybill settings
router.put('/bank-paybills', (req, res) => {
  Object.assign(bankPaybillStore, req.body);
  res.json(bankPaybillStore);
});

// Export the stores for use in other modules
module.exports = router;
module.exports.paymentGatewayStore = paymentGatewayStore;
module.exports.bankPaybillStore = bankPaybillStore;
module.exports.settingsStore = settingsStore;
