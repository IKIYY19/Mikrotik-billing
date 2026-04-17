/**
 * Payment Gateways - Kenyan payment methods
 * M-Pesa, Airtel Money, Bank Transfer, Card (via local gateways)
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const MpesaService = require('../services/mpesa');
const billing = require('../db/billingStore');

// Initialize M-Pesa (sandbox mode by default)
const mpesa = new MpesaService({
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  shortcode: process.env.MPESA_SHORTCODE || '174379',
  passkey: process.env.MPESA_PASSKEY || '',
  callbackUrl: process.env.MPESA_CALLBACK_URL || '',
});

// In-memory storage for pending payments (use DB in production)
const pendingPayments = {};

// ═══════════════════════════════════════
// GENERIC PAYMENTS API
// ═══════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const payments = billing.store.payments.map((payment) => {
      const customer = billing.store.customers.find((item) => item.id === payment.customer_id) || null;
      const invoice = billing.store.invoices.find((item) => item.id === payment.invoice_id) || null;
      return { ...payment, customer, invoice };
    });

    res.json(payments.sort((a, b) => new Date(b.received_at) - new Date(a.received_at)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customer_id, amount, method, reference, invoice_id, notes } = req.body || {};

    if (!customer_id || amount === undefined || amount === null) {
      return res.status(400).json({ error: 'customer_id and amount are required' });
    }

    const payment = await billing.createPayment({
      customer_id,
      amount: parseFloat(amount),
      method: method || 'cash',
      reference,
      invoice_id,
      notes,
    });

    res.status(201).json(payment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// PAYMENT METHODS CONFIG
// ═══════════════════════════════════════
router.get('/methods', (req, res) => {
  res.json({
    methods: [
      {
        id: 'mpesa_stk',
        name: 'M-Pesa (STK Push)',
        icon: '📱',
        description: 'Pay via M-Pesa - instant prompt on your phone',
        min: 1,
        max: 150000,
        fee: 0,
        enabled: true,
      },
      {
        id: 'mpesa_paybill',
        name: 'M-Pesa Paybill',
        icon: '🏦',
        description: 'Send to Paybill: 123456, Account: your invoice number',
        min: 1,
        max: 70000,
        fee: 0,
        enabled: true,
        paybill: process.env.MPESA_PAYBILL || '123456',
      },
      {
        id: 'airtel_money',
        name: 'Airtel Money',
        icon: '📲',
        description: 'Pay via Airtel Money',
        min: 1,
        max: 50000,
        fee: 0,
        enabled: false,
      },
      {
        id: 'bank_transfer',
        name: 'Bank Transfer (EFT/RTGS)',
        icon: '🏛️',
        description: 'Direct bank transfer',
        min: 100,
        max: 10000000,
        fee: 0,
        enabled: true,
        bank_details: {
          bank_name: process.env.BANK_NAME || 'Example Bank',
          account_name: process.env.BANK_ACCOUNT_NAME || 'Your Company Ltd',
          account_number: process.env.BANK_ACCOUNT_NUMBER || '0123456789',
          branch: process.env.BANK_BRANCH || 'Nairobi',
          swift_code: process.env.BANK_SWIFT || 'EXKEKENA',
        },
      },
      {
        id: 'card',
        name: 'Visa/Mastercard',
        icon: '💳',
        description: 'Pay via card (processed by Pesapal/DPO)',
        min: 10,
        max: 500000,
        fee: 2.9,
        enabled: false,
      },
      {
        id: 'cash',
        name: 'Cash',
        icon: '💵',
        description: 'Pay cash at our office',
        min: 0,
        max: 1000000,
        fee: 0,
        enabled: true,
      },
    ],
  });
});

// ═══════════════════════════════════════
// M-PESA STK PUSH
// ═══════════════════════════════════════
router.post('/mpesa/stk', async (req, res) => {
  try {
    const { phone, amount, invoice_id, customer_id } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'phone and amount required' });
    }

    const invoice = invoice_id ? billing.store.invoices.find(i => i.id === invoice_id) : null;
    const accountRef = invoice?.invoice_number || `INV-${Date.now()}`;
    const description = `Payment for ${accountRef}`;

    // In sandbox mode, simulate STK push
    if (!process.env.MPESA_CONSUMER_KEY) {
      const checkoutId = `sandbox-${uuidv4()}`;
      pendingPayments[checkoutId] = {
        id: uuidv4(),
        invoice_id,
        customer_id,
        phone,
        amount: parseFloat(amount),
        method: 'mpesa_stk',
        status: 'pending',
        checkoutRequestId: checkoutId,
        created_at: new Date().toISOString(),
      };

      return res.json({
        success: true,
        checkoutRequestId: checkoutId,
        message: 'STK Push sent (sandbox mode)',
        phone: mpesa.formatPhone(phone),
        amount: parseFloat(amount),
        instructions: 'Enter M-Pesa PIN 1234 to confirm payment',
      });
    }

    // Production STK Push
    const result = await mpesa.stkPush(phone, amount, accountRef, description);

    if (result.success) {
      pendingPayments[result.checkoutRequestId] = {
        id: uuidv4(),
        invoice_id,
        customer_id,
        phone,
        amount: parseFloat(amount),
        method: 'mpesa_stk',
        status: 'pending',
        checkoutRequestId: result.checkoutRequestId,
        created_at: new Date().toISOString(),
      };
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// CHECK STK STATUS
// ═══════════════════════════════════════
router.post('/mpesa/stk/check', async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;

    const pending = pendingPayments[checkoutRequestId];
    if (!pending) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // In sandbox mode, simulate payment confirmation
    if (!process.env.MPESA_CONSUMER_KEY) {
      const mpesaReceipt = `QKH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      pending.status = 'completed';
      pending.mpesaReceipt = mpesaReceipt;
      pending.completed_at = new Date().toISOString();

      // Record payment
      const payment = await billing.createPayment({
        invoice_id: pending.invoice_id,
        customer_id: pending.customer_id,
        amount: pending.amount,
        method: 'mpesa_stk',
        reference: mpesaReceipt,
        notes: `M-Pesa STK Push - ${pending.phone}`,
      });

      return res.json({
        success: true,
        status: 'completed',
        mpesaReceipt,
        amount: pending.amount,
        payment,
      });
    }

    // Production status check
    const result = await mpesa.checkStkStatus(checkoutRequestId);

    if (result.success && result.mpesaReceipt) {
      pending.status = 'completed';
      pending.mpesaReceipt = result.mpesaReceipt;
      pending.completed_at = new Date().toISOString();

      const payment = await billing.createPayment({
        invoice_id: pending.invoice_id,
        customer_id: pending.customer_id,
        amount: pending.amount,
        method: 'mpesa_stk',
        reference: result.mpesaReceipt,
        notes: `M-Pesa STK Push - ${result.phone}`,
      });

      res.json({ success: true, status: 'completed', mpesaReceipt: result.mpesaReceipt, payment });
    } else {
      res.json({ success: false, status: 'pending', message: result.description || 'Waiting for payment' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// M-PESA PAYBILL CONFIRMATION
// ═══════════════════════════════════════
router.post('/mpesa/paybill/confirm', async (req, res) => {
  try {
    const { phone, receipt, amount, invoice_id, customer_id } = req.body;

    const payment = await billing.createPayment({
      invoice_id,
      customer_id,
      amount: parseFloat(amount),
      method: 'mpesa_paybill',
      reference: receipt,
      notes: `M-Pesa Paybill - ${phone}`,
    });

    res.json({ success: true, payment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// M-PESA CALLBACK (from Safaricom)
// ═══════════════════════════════════════
router.post('/mpesa/callback', async (req, res) => {
  try {
    const callback = req.body;

    // Parse callback data
    const body = callback.Body?.stkCallback;
    if (!body) {
      return res.json({ ResultCode: 0, ResultDesc: 'Success' });
    }

    const checkoutRequestId = body.CheckoutRequestID;
    const pending = pendingPayments[checkoutRequestId];

    if (body.ResultCode === 0 && pending) {
      // Payment successful
      const result = body.CallbackMetadata?.Item || [];
      const mpesaReceipt = result.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const amount = result.find(i => i.Name === 'Amount')?.Value;

      pending.status = 'completed';
      pending.mpesaReceipt = mpesaReceipt;
      pending.completed_at = new Date().toISOString();

      await billing.createPayment({
        invoice_id: pending.invoice_id,
        customer_id: pending.customer_id,
        amount: amount || pending.amount,
        method: 'mpesa_stk',
        reference: mpesaReceipt,
        notes: `M-Pesa STK Push - ${pending.phone}`,
      });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (e) {
    console.error('M-Pesa callback error:', e);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

// ═══════════════════════════════════════
// BANK TRANSFER DETAILS
// ═══════════════════════════════════════
router.get('/bank-details', (req, res) => {
  res.json({
    bank_name: process.env.BANK_NAME || 'Equity Bank Kenya',
    account_name: process.env.BANK_ACCOUNT_NAME || 'Your ISP Company Ltd',
    account_number: process.env.BANK_ACCOUNT_NUMBER || '0123456789012',
    branch: process.env.BANK_BRANCH || 'Kimathi Street, Nairobi',
    swift_code: process.env.BANK_SWIFT || 'EQBLKENA',
    reference_format: 'Use your invoice number as reference',
    instructions: [
      'Transfer the exact invoice amount',
      'Use your invoice number as the reference',
      'Payment will be confirmed within 2-4 hours during business hours',
      'Send confirmation screenshot to our WhatsApp',
    ],
  });
});

module.exports = router;
