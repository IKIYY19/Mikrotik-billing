/**
 * Payment Gateways - Kenyan payment methods
 * M-Pesa, Airtel Money, Bank Transfer, Card (via local gateways)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const MpesaService = require('../services/mpesa');
const stripeService = require('../services/stripe');
const paypalService = require('../services/paypal');
const flutterwaveService = require('../services/flutterwave');
const billing = require('../services/billingData');
const paymentSessions = require('../services/paymentSessions');
const { paymentLimiter } = require('../middleware/rateLimiter');
const notificationService = require('../services/notificationService');
const { decryptObject } = require('../utils/encryption');
const alertSystem = require('../services/alertSystem');
const autoProvision = require('../services/autoProvision');

const router = express.Router();
const isProductionEnv = process.env.NODE_ENV === 'production';

// Import settings store for payment gateway config
const settingsRoutes = require('./settings');

async function getBankPaybills() {
  try {
    if (settingsRoutes.bankPaybillStore?.enabled) {
      return settingsRoutes.bankPaybillStore.banks.filter(bank => bank.enabled);
    }
    return [];
  } catch (error) {
    console.error('Error fetching bank paybills:', error);
    return [];
  }
}

async function getIntegrationConfig(serviceName) {
  try {
    // First try to get from settings store
    if (serviceName === 'mpesa' && settingsRoutes.paymentGatewayStore?.mpesa?.enabled) {
      return settingsRoutes.paymentGatewayStore.mpesa;
    }
    if (serviceName === 'stripe' && settingsRoutes.paymentGatewayStore?.stripe?.enabled) {
      return settingsRoutes.paymentGatewayStore.stripe;
    }
    if (serviceName === 'paypal' && settingsRoutes.paymentGatewayStore?.paypal?.enabled) {
      return settingsRoutes.paymentGatewayStore.paypal;
    }

    // Fallback to database if available
    if (!global.db) {return null;}
    const result = await global.db.query(
      'SELECT config_data, is_active FROM integrations WHERE service_name = $1 AND is_active = true LIMIT 1',
      [serviceName]
    );
    if (result.rows.length === 0) {return null;}
    const decrypted = decryptObject(result.rows[0].config_data);
    return decrypted;
  } catch (error) {
    console.error('Error fetching integration config:', error);
    return null;
  }
}

async function getMpesaService() {
  const integrationConfig = await getIntegrationConfig('mpesa');
  if (integrationConfig && integrationConfig.enabled) {
    return new MpesaService({
      consumerKey: integrationConfig.consumer_key,
      consumerSecret: integrationConfig.consumer_secret,
      shortcode: integrationConfig.shortcode || '174379',
      passkey: integrationConfig.passkey,
      callbackUrl: integrationConfig.callback_url,
      environment: integrationConfig.environment || 'sandbox',
    });
  }
  return new MpesaService({
    consumerKey: process.env.MPESA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    passkey: process.env.MPESA_PASSKEY || '',
    callbackUrl: process.env.MPESA_CALLBACK_URL || '',
    environment: process.env.MPESA_ENVIRONMENT,
  });
}

async function isMpesaConfigured() {
  const config = await getIntegrationConfig('mpesa');
  if (config && config.enabled) {
    return Boolean(config.consumer_key && config.consumer_secret && config.passkey);
  }
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_PASSKEY &&
    process.env.MPESA_CALLBACK_URL
  );
}

async function isStripeConfigured() {
  const config = await getIntegrationConfig('stripe');
  if (config && config.enabled) {
    return Boolean(config.secret_key);
  }
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function isPaypalConfigured() {
  const config = await getIntegrationConfig('paypal');
  if (config && config.enabled) {
    return Boolean(config.client_id && config.client_secret);
  }
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function ensureWebhookSecretConfigured(provider) {
  if (!isProductionEnv) {return true;}
  if (provider === 'stripe') {
    return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  }
  if (provider === 'paypal') {
    return Boolean(process.env.PAYPAL_WEBHOOK_ID);
  }
  if (provider === 'flutterwave') {
    return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
  }
  return false;
}

const flutterwaveConfigured = Boolean(process.env.FLUTTERWAVE_SECRET_KEY);

router.use(paymentLimiter);

async function getCustomerAndInvoice(customerId, invoiceId) {
  const invoice = invoiceId ? await billing.getInvoiceById(invoiceId) : null;
  const resolvedCustomerId = customerId || invoice?.customer_id || null;
  const customer = resolvedCustomerId ? await billing.getCustomerById(resolvedCustomerId) : null;
  return {
    customer,
    invoice,
    customerId: resolvedCustomerId,
  };
}

async function finalizeSessionPayment(session, mpesaReceipt, phone) {
  if (session.payment_id) {
    return billing.getPaymentById(session.payment_id);
  }

  const payment = await billing.createPayment({
    invoice_id: session.invoice_id,
    customer_id: session.customer_id,
    amount: session.amount,
    method: session.method || 'mpesa_stk',
    reference: mpesaReceipt,
    gateway_transaction_id: session.checkout_request_id || session.checkoutRequestId,
    notes: `M-Pesa STK Push - ${phone || session.phone}`,
  });

  await paymentSessions.markCompleted(session.checkout_request_id || session.checkoutRequestId, {
    payment_id: payment.id,
    mpesaReceipt,
  });

  const customer = payment.customer || await billing.getCustomerById(payment.customer_id);
  const invoice = payment.invoice || await billing.getInvoiceById(payment.invoice_id);
  if (customer?.phone) {
    notificationService.triggerSMS('payment_received', { customer, invoice, payment }).catch((error) => {
      console.error('SMS error:', error.message);
    });
  }

  autoProvision.autoProvisionOnPayment(payment).catch(err => console.error('Auto-provision error:', err.message));
  
  // Send Telegram alert
  if (invoice?.invoice_number) {
    alertSystem.sendPaymentReceived(
      payment.customer_id,
      payment.amount,
      invoice.invoice_number,
      payment.reference
    ).catch((error) => {
      console.error('Telegram alert error:', error.message);
    });
  }

  return payment;
}

// ═══════════════════════════════════════
// GENERIC PAYMENTS API
// ═══════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const payments = await billing.listPayments();
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

    const customer = payment.customer || await billing.getCustomerById(payment.customer_id);
    const invoice = payment.invoice || await billing.getInvoiceById(payment.invoice_id);
    if (customer?.phone) {
      notificationService.triggerSMS('payment_received', { customer, invoice, payment }).catch((error) => {
        console.error('SMS error:', error.message);
      });
    }

    autoProvision.autoProvisionOnPayment(payment).catch(err => console.error('Auto-provision error:', err.message));

    res.status(201).json(payment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Refund a payment
router.post('/:id/refund', async (req, res) => {
  try {
    const { amount, reason, reference } = req.body || {};
    const paymentId = req.params.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Refund amount must be greater than 0' });
    }

    if (!global.db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Get payment details
    const paymentResult = await global.db.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    // Check if refund amount exceeds payment amount
    const alreadyRefunded = payment.refund_amount || 0;
    const availableForRefund = payment.amount - alreadyRefunded;

    if (amount > availableForRefund) {
      return res.status(400).json({ error: `Refund amount exceeds available amount. Available: ${availableForRefund}` });
    }

    // Update payment with refund
    const newRefundAmount = alreadyRefunded + parseFloat(amount);
    await global.db.query(
      `UPDATE payments
       SET refund_amount = $1, refund_reference = $2, notes = COALESCE(notes, '') || ' Refund: ' || $3
       WHERE id = $4 RETURNING *`,
      [newRefundAmount, reference || '', reason || '', paymentId]
    );

    // If full refund, update invoice status back to pending
    if (newRefundAmount >= payment.amount && payment.invoice_id) {
      await global.db.query(
        `UPDATE invoices SET status = 'pending' WHERE id = $1`,
        [payment.invoice_id]
      );
    }

    res.json({ success: true, refund_amount: newRefundAmount, message: 'Refund processed successfully' });
  } catch (e) {
    console.error('Refund error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// PAYMENT METHODS CONFIG
// ═══════════════════════════════════════
router.get('/methods', async (req, res) => {
  const mpesaEnabled = await isMpesaConfigured();
  const stripeEnabled = await isStripeConfigured();
  const paypalEnabled = await isPaypalConfigured();
  const bankPaybills = await getBankPaybills();

  const methods = [
    {
      id: 'mpesa_stk',
      name: 'M-Pesa (STK Push)',
      icon: '📱',
      description: 'Pay via M-Pesa - instant prompt on your phone',
      min: 1,
      max: 150000,
      fee: 0,
      enabled: mpesaEnabled || !isProductionEnv,
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
  ];

  // Add bank paybills
  bankPaybills.forEach((bank, index) => {
    methods.push({
      id: `bank_paybill_${index}`,
      name: `${bank.name} Paybill`,
      icon: '🏦',
      description: `Pay via ${bank.name} Paybill: ${bank.paybill}`,
      min: 1,
      max: 150000,
      fee: 0,
      enabled: true,
      paybill: bank.paybill,
      account_number: bank.account_number,
      bank_name: bank.name,
      type: 'bank_paybill',
    });
  });

  methods.push(
    {
      id: 'stripe',
      name: 'Credit/Debit Card (Stripe)',
      icon: '💳',
      description: 'Pay securely with Visa, Mastercard, Amex',
      min: 1,
      max: 1000000,
      fee: 2.9,
      enabled: stripeEnabled || !isProductionEnv,
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: '🅿️',
      description: 'Pay with your PayPal account',
      min: 1,
      max: 1000000,
      fee: 3.4,
      enabled: paypalEnabled || !isProductionEnv,
    },
    {
      id: 'flutterwave',
      name: 'Flutterwave',
      icon: '🌍',
      description: 'Mobile money, card, bank transfer across Africa',
      min: 1,
      max: 1000000,
      fee: 1.4,
      enabled: flutterwaveConfigured || !isProductionEnv,
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
      id: 'cash',
      name: 'Cash',
      icon: '💵',
      description: 'Pay cash at our office',
      min: 0,
      max: 1000000,
      fee: 0,
      enabled: true,
    }
  );

  res.json({ methods });
});

// ═══════════════════════════════════════
// M-PESA STK PUSH (Production only)
// ═══════════════════════════════════════
router.post('/mpesa/stk', async (req, res) => {
  try {
    const { phone, amount, invoice_id, customer_id } = req.body;
    if (!phone || !amount) {return res.status(400).json({ error: 'phone and amount required' });}

    const { customer, invoice, customerId } = await getCustomerAndInvoice(customer_id, invoice_id);
    if (!customerId) {return res.status(404).json({ error: 'Customer not found' });}

    const mpesaConfigured = await isMpesaConfigured();
    if (!mpesaConfigured) {
      return res.status(503).json({
        success: false,
        error: 'M-Pesa is not configured. Add your Daraja Consumer Key, Secret, Shortcode, Passkey, and Callback URL in Integrations → M-Pesa.',
      });
    }

    const accountRef = invoice?.invoice_number || `INV-${Date.now()}`;
    const description = invoice ? `Payment for ${invoice.invoice_number}` : 'ISP Payment';

    const mpesaService = await getMpesaService();
    const result = await mpesaService.stkPush(phone, amount, accountRef, description);

    if (result.success) {
      await paymentSessions.savePending({
        id: uuidv4(),
        invoice_id,
        customer_id: customerId,
        phone,
        amount: parseFloat(amount),
        method: 'mpesa_stk',
        status: 'pending',
        checkoutRequestId: result.checkoutRequestId,
        provider_response: result,
      });
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// CHECK STK STATUS (Production only)
// ═══════════════════════════════════════
router.post('/mpesa/stk/check', async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;

    const pending = await paymentSessions.findByCheckoutRequestId(checkoutRequestId);
    if (!pending) {
      return res.status(404).json({ error: 'Payment session not found' });
    }

    // Already finalised — return cached result
    if (pending.payment_id) {
      const payment = await billing.getPaymentById(pending.payment_id);
      return res.json({
        success: true,
        status: 'completed',
        mpesaReceipt: pending.mpesa_receipt || pending.mpesaReceipt || payment?.reference,
        payment,
      });
    }

    const mpesaConfigured = await isMpesaConfigured();
    if (!mpesaConfigured) {
      return res.status(503).json({
        success: false,
        error: 'M-Pesa is not configured.',
      });
    }

    // Query Safaricom for real status
    const mpesaService = await getMpesaService();
    const result = await mpesaService.checkStkStatus(checkoutRequestId);

    if (result.success && result.mpesaReceipt) {
      const payment = await finalizeSessionPayment(pending, result.mpesaReceipt, result.phone || pending.phone);
      return res.json({
        success: true,
        status: 'completed',
        mpesaReceipt: result.mpesaReceipt,
        payment,
      });
    }

    if (result.resultCode && result.resultCode !== '0') {
      await paymentSessions.markFailed(checkoutRequestId, {
        status: 'failed',
        provider_response: result,
      });
      return res.json({
        success: false,
        status: 'failed',
        message: result.description || 'Payment was cancelled or declined.',
      });
    }

    return res.json({
      success: false,
      status: pending.status || 'pending',
      message: result.description || result.message || 'Waiting for customer to enter PIN...',
    });
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
    const { customer, invoice, customerId } = await getCustomerAndInvoice(customer_id, invoice_id);

    const payment = await billing.createPayment({
      invoice_id,
      customer_id: customerId,
      amount: parseFloat(amount),
      method: 'mpesa_paybill',
      reference: receipt,
      notes: `M-Pesa Paybill - ${phone}`,
    });

    if (customer?.phone) {
      notificationService.triggerSMS('payment_received', { customer, invoice, payment }).catch((error) => {
        console.error('SMS error:', error.message);
      });
    }

    res.json({ success: true, payment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// BANK PAYBILL CONFIRMATION
// ═══════════════════════════════════════
router.post('/bank-paybill/confirm', async (req, res) => {
  try {
    const { bank_name, paybill, account_number, receipt, amount, invoice_id, customer_id } = req.body;
    const { customer, invoice, customerId } = await getCustomerAndInvoice(customer_id, invoice_id);

    const payment = await billing.createPayment({
      invoice_id,
      customer_id: customerId,
      amount: parseFloat(amount),
      method: 'bank_paybill',
      reference: receipt,
      notes: `${bank_name} Paybill - Paybill: ${paybill}, Account: ${account_number}`,
    });

    if (customer?.phone) {
      notificationService.triggerSMS('payment_received', { customer, invoice, payment }).catch((error) => {
        console.error('SMS error:', error.message);
      });
    }

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
    const pending = await paymentSessions.findByCheckoutRequestId(checkoutRequestId);

    if (body.ResultCode === 0 && pending) {
      const resultItems = body.CallbackMetadata?.Item || [];
      const mpesaReceipt = resultItems.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
      const amount = resultItems.find((item) => item.Name === 'Amount')?.Value;

      if (!pending.payment_id) {
        const payment = await billing.createPayment({
          invoice_id: pending.invoice_id,
          customer_id: pending.customer_id,
          amount: amount || pending.amount,
          method: 'mpesa_stk',
          reference: mpesaReceipt,
          gateway_transaction_id: checkoutRequestId,
          notes: `M-Pesa STK Push - ${pending.phone}`,
        });

        await paymentSessions.markCompleted(checkoutRequestId, {
          payment_id: payment.id,
          mpesaReceipt,
          provider_response: callback,
        });

        const customer = payment.customer || await billing.getCustomerById(payment.customer_id);
        const invoice = payment.invoice || await billing.getInvoiceById(payment.invoice_id);
        if (customer?.phone) {
          notificationService.triggerSMS('payment_received', { customer, invoice, payment }).catch((error) => {
            console.error('SMS error:', error.message);
          });
        }

        autoProvision.autoProvisionOnPayment(payment).catch(err => console.error('Auto-provision error:', err.message));
      }
    } else if (pending) {
      await paymentSessions.markFailed(checkoutRequestId, {
        status: 'failed',
        provider_response: callback,
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

// ═══════════════════════════════════════
// STRIPE PAYMENT INTENT
// ═══════════════════════════════════════
router.post('/stripe/create-intent', async (req, res) => {
  try {
    const { amount, customer_id, invoice_id, description, metadata } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const stripeConfigured = await isStripeConfigured();
    if (!stripeConfigured && isProductionEnv) {
      return res.status(503).json({ error: 'Stripe is not configured for production' });
    }

    const result = await stripeService.createPaymentIntent({
      amount: parseFloat(amount),
      customer_id,
      invoice_id,
      description,
      metadata,
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// STRIPE WEBHOOK
// ═══════════════════════════════════════
router.post('/stripe/webhook', async (req, res) => {
  if (!ensureWebhookSecretConfigured('stripe')) {
    return res.status(503).json({ error: 'Stripe webhook secret is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  const payload = req.body;

  const event = stripeService.verifyWebhookSignature(payload, signature);
  if (!event) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    const result = await stripeService.handleWebhook(event);
    res.json(result);
  } catch (e) {
    console.error('Stripe webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// PAYPAL CREATE ORDER
// ═══════════════════════════════════════
router.post('/paypal/create-order', async (req, res) => {
  try {
    const { amount, currency, customer_id, invoice_id, description, redirect_url, metadata } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    const paypalConfigured = await isPaypalConfigured();
    if (!paypalConfigured && isProductionEnv) {
      return res.status(503).json({ error: 'PayPal is not configured for production' });
    }

    const result = await paypalService.createOrder({
      amount: parseFloat(amount),
      currency: currency || 'USD',
      customer_id,
      invoice_id,
      description,
      redirect_url,
      metadata,
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// PAYPAL CAPTURE PAYMENT
// ═══════════════════════════════════════
router.post('/paypal/capture', async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const result = await paypalService.capturePayment(orderId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// PAYPAL WEBHOOK
// ═══════════════════════════════════════
router.post('/paypal/webhook', async (req, res) => {
  if (!ensureWebhookSecretConfigured('paypal')) {
    return res.status(503).json({ error: 'PayPal webhook ID is not configured' });
  }

  const headers = req.headers;
  const body = req.body;

  if (!paypalService.verifyWebhook(headers, body)) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    const result = await paypalService.handleWebhook(body);
    res.json(result);
  } catch (e) {
    console.error('PayPal webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// FLUTTERWAVE CREATE PAYMENT LINK
// ═══════════════════════════════════════
router.post('/flutterwave/create-link', async (req, res) => {
  try {
    const { amount, currency, customer_id, invoice_id, description, redirect_url, metadata } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount is required' });
    }

    if (!flutterwaveConfigured && isProductionEnv) {
      return res.status(503).json({ error: 'Flutterwave is not configured for production' });
    }

    const result = await flutterwaveService.createPaymentLink({
      amount: parseFloat(amount),
      currency: currency || 'KES',
      customer_id,
      invoice_id,
      description,
      redirect_url,
      metadata,
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// FLUTTERWAVE VERIFY TRANSACTION
// ═══════════════════════════════════════
router.post('/flutterwave/verify', async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId is required' });
    }

    const result = await flutterwaveService.verifyTransaction(transactionId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// FLUTTERWAVE WEBHOOK
// ═══════════════════════════════════════
router.post('/flutterwave/webhook', async (req, res) => {
  if (!ensureWebhookSecretConfigured('flutterwave')) {
    return res.status(503).json({ error: 'Flutterwave webhook secret is not configured' });
  }

  const headers = req.headers;
  const body = req.body;

  if (!flutterwaveService.verifyWebhookSignature(headers, body)) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    const result = await flutterwaveService.handleWebhook(body);
    res.json(result);
  } catch (e) {
    console.error('Flutterwave webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// M-PESA C2B PAYBILL — AUTO-RECONCILIATION (Production)
// Customers pay directly to Paybill; Safaricom sends a callback here.
// Account Reference = Invoice Number (e.g. "INV-2024-001")
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /payments/mpesa/c2b/register
 * Registers the C2B confirmation and validation URLs with Safaricom.
 * Call this once when you configure your Paybill shortcode.
 */
router.post('/mpesa/c2b/register', async (req, res) => {
  try {
    if (!(await isMpesaConfigured())) {
      return res.status(503).json({ error: 'M-Pesa not configured. Set MPESA env vars or configure in Integrations.' });
    }
    const mpesa = await getMpesaService();
    const baseUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
    const confirmationUrl = `${baseUrl}/api/payments/mpesa/c2b/confirmation`;
    const validationUrl = `${baseUrl}/api/payments/mpesa/c2b/validation`;
    const result = await mpesa.registerC2BUrl({ ValidationURL: validationUrl, ConfirmationURL: confirmationUrl });
    res.json({ success: true, confirmation_url: confirmationUrl, validation_url: validationUrl, safaricom_response: result });
  } catch (e) {
    console.error('[C2B Register] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/** POST /payments/mpesa/c2b/validation — Safaricom pre-validation (accept all) */
router.post('/mpesa/c2b/validation', (req, res) => {
  console.log('[C2B Validation]', JSON.stringify(req.body));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/**
 * POST /payments/mpesa/c2b/confirmation
 * Safaricom fires this when a Paybill payment completes.
 * BillRefNumber = Account Reference the customer entered (Invoice# or phone)
 */
router.post('/mpesa/c2b/confirmation', async (req, res) => {
  // Respond immediately — Safaricom needs a fast 200
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const { TransID: transId, TransAmount: transAmountStr, BillRefNumber: billRef, MSISDN: phone, FirstName, MiddleName, LastName } = req.body || {};
  const amount = parseFloat(transAmountStr) || 0;
  const payerName = [FirstName, MiddleName, LastName].filter(Boolean).join(' ');
  console.log(`[C2B] TransID=${transId} | Amount=KES ${amount} | Ref=${billRef} | Phone=${phone}`);

  if (!global.dbAvailable || !global.db || !transId || amount <= 0) {
    console.error('[C2B] Missing required data or DB unavailable');
    return;
  }

  try {
    // Duplicate check
    const dup = await global.db.query('SELECT id FROM payments WHERE reference = $1 LIMIT 1', [transId]);
    if (dup.rows.length > 0) { console.log(`[C2B] Duplicate skipped: ${transId}`); return; }

    let invoice = null;
    let customerId = null;

    // 1) Match by invoice number
    if (billRef) {
      const r = await global.db.query('SELECT * FROM invoices WHERE LOWER(invoice_number) = LOWER($1) LIMIT 1', [billRef.trim()]);
      if (r.rows.length > 0) { invoice = r.rows[0]; customerId = invoice.customer_id; }
    }
    // 2) Match by account_number
    if (!customerId && billRef) {
      const r = await global.db.query('SELECT * FROM customers WHERE LOWER(account_number) = LOWER($1) LIMIT 1', [billRef.trim()]);
      if (r.rows.length > 0) customerId = r.rows[0].id;
    }
    // 3) Match by phone
    if (!customerId && phone) {
      const normalized = phone.replace(/^\+/, '');
      const r = await global.db.query(`SELECT id FROM customers WHERE phone LIKE $1 OR phone LIKE $2 LIMIT 1`, [`%${normalized.slice(-9)}`, `%${normalized}`]);
      if (r.rows.length > 0) customerId = r.rows[0].id;
    }
    // 4) Find oldest unpaid invoice for customer
    if (customerId && !invoice) {
      const r = await global.db.query(`SELECT * FROM invoices WHERE customer_id = $1 AND status NOT IN ('paid','cancelled') ORDER BY due_date ASC LIMIT 1`, [customerId]);
      if (r.rows.length > 0) invoice = r.rows[0];
    }

    // Create payment
    const { v4: uuid } = require('uuid');
    const paymentId = uuid();
    await global.db.query(
      `INSERT INTO payments (id, customer_id, invoice_id, phone, amount, method, status, reference, receipt_number, notes, received_at)
       VALUES ($1,$2,$3,$4,$5,'mpesa_c2b','completed',$6,$7,$8,NOW())`,
      [paymentId, customerId || null, invoice?.id || null, phone || null, amount, transId, transId,
       `M-Pesa Paybill: ${payerName || phone} | Ref: ${billRef || 'N/A'}`]
    );

    // Update invoice status
    if (invoice) {
      const paid = await global.db.query(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE invoice_id = $1 AND status='completed'`, [invoice.id]);
      const totalPaid = parseFloat(paid.rows[0]?.total || 0);
      const newStatus = totalPaid >= parseFloat(invoice.total) ? 'paid' : totalPaid > 0 ? 'partial' : invoice.status;
      if (newStatus !== invoice.status) {
        await global.db.query(`UPDATE invoices SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [newStatus, invoice.id]);
        console.log(`[C2B] Invoice ${invoice.invoice_number} → ${newStatus}`);
      }
    }

    // SMS confirmation
    if (customerId) {
      const custRow = await global.db.query('SELECT * FROM customers WHERE id=$1', [customerId]);
      if (custRow.rows[0]?.phone) {
        notificationService.triggerSMS('payment_received', {
          customer: custRow.rows[0],
          invoice: invoice || { invoice_number: billRef || transId },
          payment: { amount, reference: transId, receipt_number: transId },
        }).catch(e => console.error('[C2B] SMS:', e.message));
      }
    }

    // Auto-provision
    if (invoice?.id) {
      autoProvision.autoProvisionOnPayment({ id: paymentId, customer_id: customerId, invoice_id: invoice.id, amount })
        .catch(e => console.error('[C2B] AutoProvision:', e.message));
    }
    console.log(`[C2B] ✅ ${transId} processed — KES ${amount}`);
  } catch (err) {
    console.error('[C2B] Error:', err.message);
  }
});

/** GET /payments/mpesa/c2b/status — Configuration status */
router.get('/mpesa/c2b/status', async (req, res) => {
  try {
    const configured = await isMpesaConfigured();
    const baseUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
    res.json({
      configured,
      confirmation_url: `${baseUrl}/api/payments/mpesa/c2b/confirmation`,
      validation_url: `${baseUrl}/api/payments/mpesa/c2b/validation`,
      setup: configured
        ? 'Call POST /payments/mpesa/c2b/register to register with Safaricom'
        : 'Configure MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, MPESA_SHORTCODE first',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
