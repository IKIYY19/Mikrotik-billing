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

// Get settings
router.get('/', (req, res) => {
  res.json(settingsStore);
});

// Update settings
router.put('/', (req, res) => {
  Object.assign(settingsStore, req.body);
  res.json(settingsStore);
});

module.exports = router;
