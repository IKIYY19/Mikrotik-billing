/**
 * SMS Routes - Africa's Talking Integration
 * Handles sending, templates, logs, and settings
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const AfricaTalkingService = require('../services/africasTalking');
const WhatsAppService = require('../services/whatsapp');
const billing = require('../db/billingStore');

// In-memory SMS logs (use DB in production)
const smsLogs = [];

// SMS Templates
const defaultTemplates = [
  {
    id: 'invoice_due_soon',
    name: 'Invoice Due Soon',
    event: 'invoice_due_soon',
    body: 'Hi {customer_name}, your invoice {invoice_number} for KES {amount} is due on {due_date}. Pay via M-Pesa: {paybill}, Acc: {invoice_number}. Thank you - {company_name}',
    is_active: true,
  },
  {
    id: 'invoice_overdue',
    name: 'Invoice Overdue',
    event: 'invoice_overdue',
    body: 'URGENT: {customer_name}, your invoice {invoice_number} of KES {amount} is {days_overdue} days overdue. Your service may be suspended. Pay via M-Pesa: {paybill}, Acc: {invoice_number} - {company_name}',
    is_active: true,
  },
  {
    id: 'payment_received',
    name: 'Payment Received',
    event: 'payment_received',
    body: 'Payment received! KES {amount} for {invoice_number}. Receipt: {mpesa_receipt}. New balance: KES {balance}. Thank you - {company_name}',
    is_active: true,
  },
  {
    id: 'service_suspended',
    name: 'Service Suspended',
    event: 'service_suspended',
    body: 'NOTICE: {customer_name}, your internet service has been SUSPENDED due to unpaid invoice {invoice_number} of KES {amount}. Pay KES {amount} via M-Pesa: {paybill}, Acc: {invoice_number} to restore - {company_name}',
    is_active: true,
  },
  {
    id: 'service_restored',
    name: 'Service Restored',
    event: 'service_restored',
    body: 'GOOD NEWS: {customer_name}, your internet service has been RESTORED after payment of KES {amount}. Receipt: {mpesa_receipt}. Enjoy! - {company_name}',
    is_active: true,
  },
  {
    id: 'welcome',
    name: 'Welcome New Customer',
    event: 'welcome',
    body: 'Welcome to {company_name}! Your internet is active. Plan: {plan_name}, Speed: {speed}. PPPoE: {pppoe_user}/{pppoe_pass}. Support: {support_phone} - {company_name}',
    is_active: true,
  },
];

// Load templates from memory or use defaults
let templates = [...defaultTemplates];

// Initialize AT service
function getATService() {
  return new AfricaTalkingService({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || 'sandbox',
    senderId: process.env.AT_SENDER_ID || 'MyISP',
  });
}

// Get company info for templates
function getCompanyInfo() {
  return {
    company_name: process.env.COMPANY_NAME || 'Your ISP',
    paybill: process.env.MPESA_PAYBILL || '123456',
    support_phone: process.env.SUPPORT_PHONE || '+254 700 000 000',
  };
}

// Render template with variables
function renderTemplate(templateId, variables) {
  const tmpl = templates.find(t => t.id === templateId);
  if (!tmpl || !tmpl.is_active) return null;

  let message = tmpl.body;
  const company = getCompanyInfo();

  // Replace all variables
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  // Replace company info
  message = message.replace('{company_name}', company.company_name);
  message = message.replace('{paybill}', company.paybill);
  message = message.replace('{support_phone}', company.support_phone);

  return AfricaTalkingService.truncate(message);
}

// ═══════════════════════════════════════
// SEND SMS (direct)
// ═══════════════════════════════════════
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });

    const at = getATService();
    const result = await at.sendSMS(AfricaTalkingService.formatPhone(to), message);

    // Log
    const log = {
      id: uuidv4(),
      to: Array.isArray(to) ? to : [to],
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.results?.[0]?.messageId || null,
      cost: result.results?.[0]?.cost || 0,
      is_sandbox: result.isSandbox,
      created_at: new Date().toISOString(),
    };
    smsLogs.unshift(log);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// SEND VIA TEMPLATE
// ═══════════════════════════════════════
router.post('/send-template', async (req, res) => {
  try {
    const { template_id, to, variables } = req.body;
    if (!template_id || !to) return res.status(400).json({ error: 'template_id and to required' });

    const message = renderTemplate(template_id, { ...variables, ...getCompanyInfo() });
    if (!message) return res.status(404).json({ error: 'Template not found or inactive' });

    const at = getATService();
    const result = await at.sendSMS(AfricaTalkingService.formatPhone(to), message);

    // Log
    const log = {
      id: uuidv4(),
      template_id,
      to: Array.isArray(to) ? to : [to],
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.results?.[0]?.messageId || null,
      cost: result.results?.[0]?.cost || 0,
      is_sandbox: result.isSandbox,
      created_at: new Date().toISOString(),
    };
    smsLogs.unshift(log);

    res.json({ ...result, template_id, message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// BULK SMS (via template)
// ═══════════════════════════════════════
router.post('/bulk-send', async (req, res) => {
  try {
    const { template_id, recipients } = req.body;
    // recipients: [{ to: '+254...', variables: {...} }, ...]
    if (!template_id || !recipients?.length) return res.status(400).json({ error: 'template_id and recipients required' });

    const messages = recipients
      .map(r => {
        const message = renderTemplate(template_id, { ...r.variables, ...getCompanyInfo() });
        return message ? { to: AfricaTalkingService.formatPhone(r.to), message } : null;
      })
      .filter(Boolean);

    if (messages.length === 0) return res.json({ success: true, sent: 0, message: 'No valid messages' });

    const at = getATService();
    const result = await at.sendBulkSMS(messages);

    // Log each
    for (let i = 0; i < messages.length; i++) {
      smsLogs.unshift({
        id: uuidv4(),
        template_id,
        to: [messages[i].to],
        message: messages[i].message,
        status: result.results[i]?.status === 'Success' ? 'sent' : 'failed',
        message_id: result.results[i]?.messageId || null,
        cost: result.results[i]?.cost || 0,
        is_sandbox: result.isSandbox,
        created_at: new Date().toISOString(),
      });
    }

    res.json({ ...result, sent: messages.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════
router.get('/templates', (req, res) => {
  res.json(templates);
});

router.put('/templates/:id', (req, res) => {
  const idx = templates.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Template not found' });
  templates[idx] = { ...templates[idx], ...req.body };
  res.json(templates[idx]);
});

// ═══════════════════════════════════════
// LOGS
// ═══════════════════════════════════════
router.get('/logs', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  res.json({
    data: smsLogs.slice(offset, offset + limit),
    total: smsLogs.length,
    page,
    limit,
  });
});

// ═══════════════════════════════════════
// SETTINGS / BALANCE
// ═══════════════════════════════════════
router.get('/balance', async (req, res) => {
  const at = getATService();
  const result = await at.checkBalance();
  res.json(result);
});

router.get('/settings', (req, res) => {
  res.json({
    username: process.env.AT_USERNAME || 'sandbox',
    sender_id: process.env.AT_SENDER_ID || 'MyISP',
    is_configured: !!process.env.AT_API_KEY,
    company: getCompanyInfo(),
  });
});

// ═══════════════════════════════════════
// TRIGGER HELPERS (called from billing routes)
// ═══════════════════════════════════════
async function triggerSMS(event, data) {
  try {
    const phone = data.customer?.phone;
    if (!phone) return { success: false, message: 'No phone number' };

    const templateMap = {
      invoice_due_soon: 'invoice_due_soon',
      invoice_overdue: 'invoice_overdue',
      payment_received: 'payment_received',
      service_suspended: 'service_suspended',
      service_restored: 'service_restored',
      welcome: 'welcome',
    };

    const templateId = templateMap[event];
    if (!templateId) return { success: false, message: 'Unknown event' };

    const variables = {
      customer_name: data.customer?.name?.split(' ')[0] || 'Customer',
      invoice_number: data.invoice?.invoice_number || '',
      amount: data.invoice?.total?.toFixed(2) || data.amount?.toFixed(2) || '0',
      due_date: data.invoice?.due_date || '',
      days_overdue: data.days_overdue || 0,
      mpesa_receipt: data.payment?.reference || data.mpesa_receipt || '',
      balance: data.invoice ? (data.invoice.total - (data.paid_amount || 0)).toFixed(2) : '0',
      plan_name: data.plan?.name || '',
      speed: data.plan ? `${data.plan.speed_down}/${data.plan.speed_up}` : '',
      pppoe_user: data.pppoe_username || '',
      pppoe_pass: data.pppoe_password || '',
    };

    const message = renderTemplate(templateId, { ...variables, ...getCompanyInfo() });
    if (!message) return { success: false, message: 'Template not found' };

    const at = getATService();
    const result = await at.sendSMS(AfricaTalkingService.formatPhone(phone), message);

    smsLogs.unshift({
      id: uuidv4(),
      event,
      template_id: templateId,
      to: [AfricaTalkingService.formatPhone(phone)],
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.results?.[0]?.messageId || null,
      cost: result.results?.[0]?.cost || 0,
      is_sandbox: result.isSandbox,
      created_at: new Date().toISOString(),
    });

    return result;
  } catch (e) {
    console.error('SMS trigger error:', e.message);
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════
// WHATSAPP
// ═══════════════════════════════════════

const whatsapp = new WhatsAppService();

// Send WhatsApp message
router.post('/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });

    const result = await whatsapp.sendMessage(to, message);

    smsLogs.unshift({
      id: uuidv4(),
      channel: 'whatsapp',
      to: [to],
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.messageId,
      cost: 0,
      is_sandbox: result.isSandbox,
      created_at: new Date().toISOString(),
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// WhatsApp webhook verification
router.get('/whatsapp/webhook', (req, res) => {
  const challenge = whatsapp.verifyWebhook(req);
  if (challenge) return res.send(challenge.toString());
  res.sendStatus(403);
});

// WhatsApp webhook receiver
router.post('/whatsapp/webhook', (req, res) => {
  const events = whatsapp.handleWebhook(req.body);

  for (const event of events) {
    if (event.type === 'message_received') {
      smsLogs.unshift({
        id: uuidv4(),
        channel: 'whatsapp_inbound',
        from: event.from,
        message: event.message,
        status: 'received',
        created_at: new Date(parseInt(event.timestamp) * 1000).toISOString(),
      });
      console.log(`[WhatsApp Inbound] ${event.from}: ${event.message}`);
    }
  }

  res.sendStatus(200);
});

// Send WhatsApp via template
router.post('/whatsapp/send-template', async (req, res) => {
  try {
    const { to, template_id, variables } = req.body;
    const tmpl = templates.find(t => t.id === template_id);
    if (!tmpl) return res.status(404).json({ error: 'Template not found' });

    let message = tmpl.body;
    const company = getCompanyInfo();
    for (const [key, value] of Object.entries(variables || {})) {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    }
    message = message.replace('{company_name}', company.company_name);
    message = message.replace('{paybill}', company.paybill);
    message = message.replace('{support_phone}', company.support_phone);

    const result = await whatsapp.sendMessage(to, AfricaTalkingService.truncate(message));

    smsLogs.unshift({
      id: uuidv4(),
      channel: 'whatsapp',
      template_id,
      to: [to],
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.messageId,
      cost: 0,
      is_sandbox: result.isSandbox,
      created_at: new Date().toISOString(),
    });

    res.json({ ...result, message });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// WhatsApp settings
router.get('/whatsapp/settings', (req, res) => {
  res.json({
    is_configured: whatsapp.isConfigured,
    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID ? '***' + process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4) : null,
  });
});

// ═══════════════════════════════════════
// COMBINED MESSAGING (SMS + WhatsApp)
// ═══════════════════════════════════════

async function triggerMessage(event, data, channel = 'both') {
  const phone = data.customer?.phone;
  if (!phone) return { success: false, message: 'No phone number' };

  const results = { sms: null, whatsapp: null };

  // Send SMS
  if (channel === 'both' || channel === 'sms') {
    results.sms = await triggerSMS(event, data);
  }

  // Send WhatsApp
  if (channel === 'both' || channel === 'whatsapp') {
    const templateMap = {
      invoice_due_soon: 'invoice_due_soon',
      invoice_overdue: 'invoice_overdue',
      payment_received: 'payment_received',
      service_suspended: 'service_suspended',
      service_restored: 'service_restored',
      welcome: 'welcome',
    };
    const templateId = templateMap[event];
    if (templateId) {
      const tmpl = templates.find(t => t.id === templateId);
      if (tmpl) {
        let message = tmpl.body;
        const company = getCompanyInfo();
        const variables = {
          customer_name: data.customer?.name?.split(' ')[0] || 'Customer',
          invoice_number: data.invoice?.invoice_number || '',
          amount: data.invoice?.total?.toFixed(2) || data.amount?.toFixed(2) || '0',
          due_date: data.invoice?.due_date || '',
          days_overdue: data.days_overdue || 0,
          mpesa_receipt: data.payment?.reference || '',
          balance: data.invoice ? (data.invoice.total - (data.paid_amount || 0)).toFixed(2) : '0',
        };
        for (const [key, value] of Object.entries(variables)) {
          message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
        }
        message = message.replace('{company_name}', company.company_name);
        message = message.replace('{paybill}', company.paybill);
        message = message.replace('{support_phone}', company.support_phone);
        message = AfricaTalkingService.truncate(message);

        results.whatsapp = await whatsapp.sendMessage(phone, message);

        smsLogs.unshift({
          id: uuidv4(),
          channel: 'whatsapp',
          event,
          template_id: templateId,
          to: [phone],
          message,
          status: results.whatsapp.success ? 'sent' : 'failed',
          message_id: results.whatsapp.messageId,
          cost: 0,
          is_sandbox: results.whatsapp.isSandbox,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

module.exports = router;
module.exports.triggerSMS = triggerSMS;
module.exports.triggerMessage = triggerMessage;
module.exports.smsLogs = smsLogs;
