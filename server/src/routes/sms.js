/**
 * SMS Routes - Africa's Talking Integration
 * Handles sending, templates, logs, and settings
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const AfricaTalkingService = require('../services/africasTalking');
const WhatsAppService = require('../services/whatsapp');
const messagingStore = require('../services/messagingStore');
const { messagingLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const whatsapp = new WhatsAppService();
const isProductionEnv = process.env.NODE_ENV === 'production';

function getATService() {
  return new AfricaTalkingService({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || (isProductionEnv ? '' : 'sandbox'),
    senderId: process.env.AT_SENDER_ID || 'MyISP',
  });
}

function getCompanyInfo() {
  return {
    company_name: process.env.COMPANY_NAME || 'Your ISP',
    paybill: process.env.MPESA_PAYBILL || '123456',
    support_phone: process.env.SUPPORT_PHONE || '+254 700 000 000',
  };
}

async function renderTemplate(templateId, variables, channel = 'sms') {
  const template = await messagingStore.getTemplate(templateId, channel);
  if (!template || !template.is_active) return null;

  let message = template.body;
  const company = getCompanyInfo();

  for (const [key, value] of Object.entries({ ...variables, ...company })) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }

  return AfricaTalkingService.truncate(message);
}

async function logMessage(log) {
  await messagingStore.createLog({
    id: log.id || uuidv4(),
    channel: log.channel || 'sms',
    event: log.event || null,
    template_id: log.template_id || null,
    to: Array.isArray(log.to) ? log.to : log.to ? [log.to] : [],
    message: log.message,
    status: log.status,
    message_id: log.message_id || null,
    cost: log.cost || 0,
    is_sandbox: log.is_sandbox === true,
    metadata: log.metadata || null,
    created_at: log.created_at || new Date().toISOString(),
  });
}

function buildMessageVariables(data = {}) {
  return {
    customer_name: data.customer?.name?.split(' ')[0] || 'Customer',
    invoice_number: data.invoice?.invoice_number || '',
    amount: data.invoice?.total?.toFixed?.(2) || data.amount?.toFixed?.(2) || '0',
    due_date: data.invoice?.due_date || '',
    days_overdue: data.days_overdue || 0,
    mpesa_receipt: data.payment?.reference || data.mpesa_receipt || '',
    balance: data.invoice ? (Number(data.invoice.total || 0) - Number(data.paid_amount || 0)).toFixed(2) : '0',
    plan_name: data.plan?.name || '',
    speed: data.plan ? `${data.plan.speed_down}/${data.plan.speed_up}` : '',
    pppoe_user: data.pppoe_username || data.sub?.pppoe_username || '',
    pppoe_pass: data.pppoe_password || data.sub?.pppoe_password || '',
  };
}

// ═══════════════════════════════════════
// SEND SMS (direct)
// ═══════════════════════════════════════
router.post('/send', messagingLimiter, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });

    const recipients = (Array.isArray(to) ? to : [to]).map((item) => AfricaTalkingService.formatPhone(item));
    const at = getATService();
    const result = await at.sendSMS(recipients, message);

    await logMessage({
      to: recipients,
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.results?.[0]?.messageId || null,
      cost: result.results?.[0]?.cost || 0,
      is_sandbox: result.isSandbox,
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// SEND VIA TEMPLATE
// ═══════════════════════════════════════
router.post('/send-template', messagingLimiter, async (req, res) => {
  try {
    const { template_id, to, variables } = req.body;
    if (!template_id || !to) return res.status(400).json({ error: 'template_id and to required' });

    const message = await renderTemplate(template_id, variables || {});
    if (!message) return res.status(404).json({ error: 'Template not found or inactive' });

    const recipients = (Array.isArray(to) ? to : [to]).map((item) => AfricaTalkingService.formatPhone(item));
    const at = getATService();
    const result = await at.sendSMS(recipients, message);

    await logMessage({
      template_id,
      to: recipients,
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.results?.[0]?.messageId || null,
      cost: result.results?.[0]?.cost || 0,
      is_sandbox: result.isSandbox,
    });

    res.json({ ...result, template_id, message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// BULK SMS (via template)
// ═══════════════════════════════════════
router.post('/bulk-send', messagingLimiter, async (req, res) => {
  try {
    const { template_id, recipients } = req.body;
    if (!template_id || !recipients?.length) return res.status(400).json({ error: 'template_id and recipients required' });

    const messages = (await Promise.all(
      recipients.map(async (recipient) => {
        const message = await renderTemplate(template_id, recipient.variables || {});
        return message ? { to: AfricaTalkingService.formatPhone(recipient.to), message } : null;
      })
    )).filter(Boolean);

    if (messages.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No valid messages' });
    }

    const at = getATService();
    const result = await at.sendBulkSMS(messages);

    await Promise.all(messages.map((item, index) => logMessage({
      template_id,
      to: [item.to],
      message: item.message,
      status: result.results?.[index]?.status === 'Success' ? 'sent' : 'failed',
      message_id: result.results?.[index]?.messageId || null,
      cost: result.results?.[index]?.cost || 0,
      is_sandbox: result.isSandbox,
    })));

    res.json({ ...result, sent: messages.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════
router.get('/templates', async (req, res) => {
  try {
    res.json(await messagingStore.listTemplates('sms'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/templates/:id', messagingLimiter, async (req, res) => {
  try {
    const updated = await messagingStore.updateTemplate(req.params.id, req.body || {}, 'sms');
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// LOGS
// ═══════════════════════════════════════
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    res.json(await messagingStore.listLogs({ page, limit }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// SETTINGS / BALANCE
// ═══════════════════════════════════════
router.get('/balance', async (req, res) => {
  try {
    const at = getATService();
    res.json(await at.checkBalance());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/settings', (req, res) => {
  res.json({
    username: process.env.AT_USERNAME || (isProductionEnv ? null : 'sandbox'),
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

    const templateId = {
      invoice_due_soon: 'invoice_due_soon',
      invoice_overdue: 'invoice_overdue',
      payment_received: 'payment_received',
      service_suspended: 'service_suspended',
      service_restored: 'service_restored',
      welcome: 'welcome',
    }[event];

    if (!templateId) return { success: false, message: 'Unknown event' };

    const message = await renderTemplate(templateId, buildMessageVariables(data));
    if (!message) return { success: false, message: 'Template not found' };

    const recipient = AfricaTalkingService.formatPhone(phone);
    const at = getATService();
    const result = await at.sendSMS(recipient, message);

    await logMessage({
      event,
      template_id: templateId,
      to: [recipient],
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.results?.[0]?.messageId || null,
      cost: result.results?.[0]?.cost || 0,
      is_sandbox: result.isSandbox,
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

router.post('/whatsapp/send', messagingLimiter, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });

    const result = await whatsapp.sendMessage(to, message);

    await logMessage({
      channel: 'whatsapp',
      to: [to],
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.messageId,
      cost: 0,
      is_sandbox: result.isSandbox,
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/whatsapp/webhook', (req, res) => {
  const challenge = whatsapp.verifyWebhook(req);
  if (challenge) return res.send(challenge.toString());
  return res.sendStatus(403);
});

router.post('/whatsapp/webhook', async (req, res) => {
  const events = whatsapp.handleWebhook(req.body);

  for (const event of events) {
    if (event.type === 'message_received') {
      await logMessage({
        channel: 'whatsapp_inbound',
        to: [event.from],
        message: event.message,
        status: 'received',
        created_at: new Date(parseInt(event.timestamp, 10) * 1000).toISOString(),
        metadata: { direction: 'inbound' },
      });
      console.log(`[WhatsApp Inbound] ${event.from}: ${event.message}`);
    }
  }

  res.sendStatus(200);
});

router.post('/whatsapp/send-template', messagingLimiter, async (req, res) => {
  try {
    const { to, template_id, variables } = req.body;
    const message = await renderTemplate(template_id, variables || {});
    if (!message) return res.status(404).json({ error: 'Template not found' });

    const result = await whatsapp.sendMessage(to, message);

    await logMessage({
      channel: 'whatsapp',
      template_id,
      to: [to],
      message,
      status: result.success ? 'sent' : 'failed',
      message_id: result.messageId,
      cost: 0,
      is_sandbox: result.isSandbox,
    });

    res.json({ ...result, message });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/whatsapp/settings', (req, res) => {
  res.json({
    is_configured: whatsapp.isConfigured,
    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID ? `***${process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4)}` : null,
  });
});

// ═══════════════════════════════════════
// COMBINED MESSAGING (SMS + WhatsApp)
// ═══════════════════════════════════════

async function triggerMessage(event, data, channel = 'both') {
  const phone = data.customer?.phone;
  if (!phone) return { success: false, message: 'No phone number' };

  const results = { sms: null, whatsapp: null };

  if (channel === 'both' || channel === 'sms') {
    results.sms = await triggerSMS(event, data);
  }

  if (channel === 'both' || channel === 'whatsapp') {
    const templateId = {
      invoice_due_soon: 'invoice_due_soon',
      invoice_overdue: 'invoice_overdue',
      payment_received: 'payment_received',
      service_suspended: 'service_suspended',
      service_restored: 'service_restored',
      welcome: 'welcome',
    }[event];

    if (templateId) {
      const message = await renderTemplate(templateId, buildMessageVariables(data));
      if (message) {
        results.whatsapp = await whatsapp.sendMessage(phone, message);

        await logMessage({
          channel: 'whatsapp',
          event,
          template_id: templateId,
          to: [phone],
          message,
          status: results.whatsapp.success ? 'sent' : 'failed',
          message_id: results.whatsapp.messageId,
          cost: 0,
          is_sandbox: results.whatsapp.isSandbox,
        });
      }
    }
  }

  return results;
}

module.exports = router;
module.exports.triggerSMS = triggerSMS;
module.exports.triggerMessage = triggerMessage;
module.exports.smsLogs = [];
