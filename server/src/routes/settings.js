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

module.exports = router;
