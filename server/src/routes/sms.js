/**
 * SMS Routes - Africa's Talking Integration
 * Handles sending, templates, logs, and settings
 */

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const AfricaTalkingService = require("../services/africasTalking");
const WhatsAppService = require("../services/whatsapp");
const SMSLeopardService = require("../services/smsLeopard");
const BulkSmsKenyaService = require("../services/bulkSmsKenya");
const NexmoService = require("../services/nexmo");
const TwilioService = require("../services/twilio");
const messagingStore = require("../services/messagingStore");
const { messagingLimiter } = require("../middleware/rateLimiter");
const { decryptObject } = require("../utils/encryption");

const router = express.Router();
const whatsapp = new WhatsAppService();
const isProductionEnv = process.env.NODE_ENV === "production";

async function getIntegrationConfig(serviceName) {
  try {
    if (!global.db) return null;
    const result = await global.db.query(
      "SELECT config_data, is_active FROM integrations WHERE service_name = $1 AND is_active = true LIMIT 1",
      [serviceName],
    );
    if (result.rows.length === 0) return null;
    const decrypted = decryptObject(result.rows[0].config_data);
    return decrypted;
  } catch (error) {
    console.error("Error fetching integration config:", error);
    return null;
  }
}

async function getATService() {
  const integrationConfig = await getIntegrationConfig("africas_talking");
  if (integrationConfig) {
    return new AfricaTalkingService({
      apiKey: integrationConfig.api_key,
      username:
        integrationConfig.username || (isProductionEnv ? "" : "sandbox"),
      senderId: integrationConfig.sender_id || "MyISP",
    });
  }
  return new AfricaTalkingService({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || (isProductionEnv ? "" : "sandbox"),
    senderId: process.env.AT_SENDER_ID || "MyISP",
  });
}

async function getWhatsAppService() {
  const integrationConfig = await getIntegrationConfig("whatsapp");
  if (integrationConfig) {
    return new WhatsAppService({
      accessToken: integrationConfig.access_token,
      phoneNumberId: integrationConfig.phone_number_id,
      verifyToken: integrationConfig.verify_token,
    });
  }
  return new WhatsAppService();
}

async function getSmsLeopardService() {
  const integrationConfig = await getIntegrationConfig("smsleopard");
  if (integrationConfig) {
    return new SMSLeopardService({
      apiKey: integrationConfig.api_key,
      senderId: integrationConfig.sender_id,
    });
  }
  return new SMSLeopardService();
}

async function getBulkSmsKenyaService() {
  const integrationConfig = await getIntegrationConfig("bulksms_kenya");
  if (integrationConfig) {
    return new BulkSmsKenyaService({
      username: integrationConfig.username,
      apiKey: integrationConfig.api_key,
      senderId: integrationConfig.sender_id,
    });
  }
  return new BulkSmsKenyaService();
}

async function getNexmoService() {
  const integrationConfig = await getIntegrationConfig("nexmo");
  if (integrationConfig) {
    return new NexmoService({
      apiKey: integrationConfig.api_key,
      apiSecret: integrationConfig.api_secret,
      senderId: integrationConfig.sender_id,
    });
  }
  return new NexmoService();
}

async function getTwilioService() {
  const integrationConfig = await getIntegrationConfig("twilio");
  if (integrationConfig) {
    return new TwilioService({
      accountSid: integrationConfig.account_sid,
      authToken: integrationConfig.auth_token,
      phoneNumber: integrationConfig.phone_number,
    });
  }
  return new TwilioService();
}

function getCompanyInfo() {
  return {
    company_name: process.env.COMPANY_NAME || "Your ISP",
    paybill: process.env.MPESA_PAYBILL || "123456",
    support_phone: process.env.SUPPORT_PHONE || "+254 700 000 000",
  };
}

async function renderTemplate(templateId, variables, channel = "sms") {
  const template = await messagingStore.getTemplate(templateId, channel);
  if (!template || !template.is_active) return null;

  let message = template.body;
  const company = getCompanyInfo();

  for (const [key, value] of Object.entries({ ...variables, ...company })) {
    message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
  }

  return AfricaTalkingService.truncate(message);
}

async function logMessage(log) {
  await messagingStore.createLog({
    id: log.id || uuidv4(),
    channel: log.channel || "sms",
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
    customer_name: data.customer?.name?.split(" ")[0] || "Customer",
    invoice_number: data.invoice?.invoice_number || "",
    amount:
      data.invoice?.total?.toFixed?.(2) || data.amount?.toFixed?.(2) || "0",
    due_date: data.invoice?.due_date || "",
    days_overdue: data.days_overdue || 0,
    mpesa_receipt: data.payment?.reference || data.mpesa_receipt || "",
    balance: data.invoice
      ? (
          Number(data.invoice.total || 0) - Number(data.paid_amount || 0)
        ).toFixed(2)
      : "0",
    plan_name: data.plan?.name || "",
    speed: data.plan ? `${data.plan.speed_down}/${data.plan.speed_up}` : "",
    pppoe_user: data.pppoe_username || data.sub?.pppoe_username || "",
    pppoe_pass: data.pppoe_password || data.sub?.pppoe_password || "",
  };
}

// ═══════════════════════════════════════
// SEND BULK SMS (to all customers)
// ═══════════════════════════════════════
router.post("/send-bulk", messagingLimiter, async (req, res) => {
  try {
    const { message, provider, filter = "all" } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    // Fetch customers based on filter
    let customers = [];
    if (global.db) {
      let query =
        "SELECT id, name, phone, status FROM customers WHERE phone IS NOT NULL AND phone != ''";
      let params = [];

      if (filter === "active") {
        query += " AND status = $1";
        params = ["active"];
      } else if (filter === "overdue") {
        query +=
          " AND id IN (SELECT DISTINCT customer_id FROM invoices WHERE status != 'paid' AND due_date < CURRENT_DATE)";
      }

      const result = await global.db.query(query, params);
      customers = result.rows;
    }

    if (customers.length === 0) {
      return res
        .status(404)
        .json({ error: "No customers found with phone numbers" });
    }

    let usedProvider = provider || "africas_talking";
    let service;

    switch (usedProvider) {
      case "smsleopard":
        service = await getSmsLeopardService();
        break;
      case "bulksms_kenya":
        service = await getBulkSmsKenyaService();
        break;
      case "nexmo":
        service = await getNexmoService();
        break;
      case "twilio":
        service = await getTwilioService();
        break;
      case "whatsapp":
        service = whatsapp;
        break;
      case "africas_talking":
      default:
        service = await getATService();
        break;
    }

    // Send to all customers
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const customer of customers) {
      try {
        let result;
        if (usedProvider === "africas_talking") {
          const formattedPhone = AfricaTalkingService.formatPhone(
            customer.phone,
          );
          result = await service.sendSMS([formattedPhone], message);
        } else if (usedProvider === "whatsapp") {
          result = await service.sendMessage(customer.phone, message);
        } else {
          result = await service.sendSMS(customer.phone, message);
        }

        await logMessage({
          to: [customer.phone],
          message,
          status: result.success ? "sent" : "failed",
          cost: result.cost || 0,
          is_sandbox: false,
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        results.push({
          customer: customer.name,
          phone: customer.phone,
          success: result.success,
          error: result.message,
        });
      } catch (error) {
        failCount++;
        results.push({
          customer: customer.name,
          phone: customer.phone,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      total: customers.length,
      successCount,
      failCount,
      results,
    });
  } catch (e) {
    console.error("Bulk SMS error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// SEND SMS (direct)
// ═══════════════════════════════════════
router.post("/send", messagingLimiter, async (req, res) => {
  try {
    const { to, message, provider } = req.body;
    if (!to || !message)
      return res.status(400).json({ error: "to and message required" });

    const recipients = Array.isArray(to) ? to : [to];
    let result;
    let usedProvider = provider || "africas_talking";

    switch (usedProvider) {
      case "smsleopard":
        const smsLeopard = await getSmsLeopardService();
        result = await smsLeopard.sendSMS(recipients[0], message);
        break;
      case "bulksms_kenya":
        const bulkSms = await getBulkSmsKenyaService();
        result = await bulkSms.sendSMS(recipients[0], message);
        break;
      case "nexmo":
        const nexmo = await getNexmoService();
        result = await nexmo.sendSMS(recipients[0], message);
        break;
      case "twilio":
        const twilio = await getTwilioService();
        result = await twilio.sendSMS(recipients[0], message);
        break;
      case "whatsapp":
        result = await whatsapp.sendMessage(recipients[0], message);
        break;
      case "africas_talking":
      default:
        const at = await getATService();
        const formattedRecipients = recipients.map((item) =>
          AfricaTalkingService.formatPhone(item),
        );
        result = await at.sendSMS(formattedRecipients, message);
        break;
    }

    await logMessage({
      to: recipients,
      message,
      status: result.success ? "sent" : "failed",
      message_id: result.messageId || result.results?.[0]?.messageId || null,
      cost: result.cost || result.results?.[0]?.cost || 0,
      is_sandbox: result.isSandbox,
      metadata: { provider: usedProvider },
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// SEND VIA TEMPLATE
// ═══════════════════════════════════════
router.post("/send-template", messagingLimiter, async (req, res) => {
  try {
    const { template_id, to, variables } = req.body;
    if (!template_id || !to)
      return res.status(400).json({ error: "template_id and to required" });

    const message = await renderTemplate(template_id, variables || {});
    if (!message)
      return res.status(404).json({ error: "Template not found or inactive" });

    const recipients = (Array.isArray(to) ? to : [to]).map((item) =>
      AfricaTalkingService.formatPhone(item),
    );
    const at = await getATService();
    const result = await at.sendSMS(recipients, message);

    await logMessage({
      template_id,
      to: recipients,
      message,
      status: result.success ? "sent" : "failed",
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
// DELETE SMS LOG
// ═══════════════════════════════════════
router.delete("/logs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await messagingStore.deleteLog(id);
    res.json({ success: true, message: "Log deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// CLEAR ALL SMS LOGS
// ═══════════════════════════════════════
router.delete("/logs", async (req, res) => {
  try {
    await messagingStore.clearLogs();
    res.json({ success: true, message: "All logs cleared" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// BULK SMS (via template)
// ═══════════════════════════════════════
router.post("/bulk-send", messagingLimiter, async (req, res) => {
  try {
    const { template_id, recipients } = req.body;
    if (!template_id || !recipients?.length)
      return res
        .status(400)
        .json({ error: "template_id and recipients required" });

    const messages = (
      await Promise.all(
        recipients.map(async (recipient) => {
          const message = await renderTemplate(
            template_id,
            recipient.variables || {},
          );
          return message
            ? { to: AfricaTalkingService.formatPhone(recipient.to), message }
            : null;
        }),
      )
    ).filter(Boolean);

    if (messages.length === 0) {
      return res.json({ success: true, sent: 0, message: "No valid messages" });
    }

    const at = await getATService();
    const result = await at.sendBulkSMS(messages);

    await Promise.all(
      messages.map((item, index) =>
        logMessage({
          template_id,
          to: [item.to],
          message: item.message,
          status:
            result.results?.[index]?.status === "Success" ? "sent" : "failed",
          message_id: result.results?.[index]?.messageId || null,
          cost: result.results?.[index]?.cost || 0,
          is_sandbox: result.isSandbox,
        }),
      ),
    );

    res.json({ ...result, sent: messages.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════
router.get("/templates", async (req, res) => {
  try {
    res.json(await messagingStore.listTemplates("sms"));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/templates/:id", messagingLimiter, async (req, res) => {
  try {
    const updated = await messagingStore.updateTemplate(
      req.params.id,
      req.body || {},
      "sms",
    );
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// LOGS
// ═══════════════════════════════════════
router.get("/logs", async (req, res) => {
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
router.get("/balance", async (req, res) => {
  try {
    const at = await getATService();
    res.json(await at.checkBalance());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/settings", async (req, res) => {
  try {
    // Check if any SMS integration is configured in the database
    let isConfigured = false;
    let configuredProvider = null;

    if (global.db) {
      const providers = [
        "africas_talking",
        "smsleopard",
        "bulksms_kenya",
        "nexmo",
        "twilio",
      ];
      for (const provider of providers) {
        const result = await global.db.query(
          "SELECT is_active FROM integrations WHERE service_name = $1 AND is_active = true LIMIT 1",
          [provider],
        );
        if (result.rows.length > 0) {
          isConfigured = true;
          configuredProvider = provider;
          break;
        }
      }
    }

    res.json({
      username: process.env.AT_USERNAME || (isProductionEnv ? null : "sandbox"),
      sender_id: process.env.AT_SENDER_ID || "MyISP",
      is_configured: isConfigured,
      configured_provider: configuredProvider,
      company: getCompanyInfo(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// TRIGGER HELPERS (called from billing routes)
// ═══════════════════════════════════════
async function triggerSMS(event, data) {
  try {
    const phone = data.customer?.phone;
    if (!phone) return { success: false, message: "No phone number" };

    const templateId = {
      invoice_due_soon: "invoice_due_soon",
      invoice_overdue: "invoice_overdue",
      payment_received: "payment_received",
      service_suspended: "service_suspended",
      service_restored: "service_restored",
      welcome: "welcome",
      password_reset: "password_reset",
    }[event];

    if (!templateId) return { success: false, message: "Unknown event" };

    const message =
      data.custom_message ||
      (await renderTemplate(templateId, buildMessageVariables(data)));
    if (!message) return { success: false, message: "Template not found" };

    // Try all configured SMS providers in order
    const providers = [
      {
        name: "africas_talking",
        getService: getATService,
        send: (svc, to, msg) =>
          svc.sendSMS([AfricaTalkingService.formatPhone(to)], msg),
      },
      {
        name: "twilio",
        getService: getTwilioService,
        send: (svc, to, msg) => svc.sendSMS(to, msg),
      },
      {
        name: "bulksms_kenya",
        getService: getBulkSmsKenyaService,
        send: (svc, to, msg) => svc.sendSMS(to, msg),
      },
      {
        name: "smsleopard",
        getService: getSmsLeopardService,
        send: (svc, to, msg) => svc.sendSMS(to, msg),
      },
      {
        name: "nexmo",
        getService: getNexmoService,
        send: (svc, to, msg) => svc.sendSMS(to, msg),
      },
    ];

    let result = { success: false, message: "No provider available" };
    for (const provider of providers) {
      try {
        const service = await provider.getService();
        if (!service || !service.isConfigured) continue;
        result = await provider.send(service, phone, message);
        if (result && result.success) {
          result.provider = provider.name;
          break;
        }
      } catch (e) {
        continue; // Try next provider
      }
    }

    await logMessage({
      event,
      template_id: templateId,
      provider: result.provider || "none",
      to: [phone],
      message,
      status: result.success ? "sent" : "failed",
      message_id: result.messageId || null,
      cost: result.cost || 0,
      is_sandbox: result.isSandbox,
    });

    return result;
  } catch (e) {
    console.error("SMS trigger error:", e.message);
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════
// WHATSAPP
// ═══════════════════════════════════════

router.post("/whatsapp/send", messagingLimiter, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message)
      return res.status(400).json({ error: "to and message required" });

    const wa = await getWhatsAppService();
    const result = await wa.sendMessage(to, message);

    await logMessage({
      channel: "whatsapp",
      to: [to],
      message,
      status: result.success ? "sent" : "failed",
      message_id: result.messageId,
      cost: 0,
      is_sandbox: result.isSandbox,
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/whatsapp/webhook", async (req, res) => {
  const wa = await getWhatsAppService();
  const challenge = wa.verifyWebhook(req);
  if (challenge) return res.send(challenge.toString());
  return res.sendStatus(403);
});

router.post("/whatsapp/webhook", async (req, res) => {
  const wa = await getWhatsAppService();
  const events = wa.handleWebhook(req.body);

  for (const event of events) {
    if (event.type === "message_received") {
      await logMessage({
        channel: "whatsapp_inbound",
        to: [event.from],
        message: event.message,
        status: "received",
        created_at: new Date(
          parseInt(event.timestamp, 10) * 1000,
        ).toISOString(),
        metadata: { direction: "inbound" },
      });
      console.log(`[WhatsApp Inbound] ${event.from}: ${event.message}`);
    }
  }

  res.sendStatus(200);
});

router.post("/whatsapp/send-template", messagingLimiter, async (req, res) => {
  try {
    const { to, template_id, variables } = req.body;
    const message = await renderTemplate(template_id, variables || {});
    if (!message) return res.status(404).json({ error: "Template not found" });

    const wa = await getWhatsAppService();
    const result = await wa.sendMessage(to, message);

    await logMessage({
      channel: "whatsapp",
      template_id,
      to: [to],
      message,
      status: result.success ? "sent" : "failed",
      message_id: result.messageId,
      cost: 0,
      is_sandbox: result.isSandbox,
    });

    res.json({ ...result, message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/whatsapp/settings", (req, res) => {
  res.json({
    is_configured: whatsapp.isConfigured,
    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID
      ? `***${process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4)}`
      : null,
  });
});

// ═══════════════════════════════════════
// COMBINED MESSAGING (SMS + WhatsApp)
// ═══════════════════════════════════════

async function triggerMessage(event, data, channel = "both") {
  const phone = data.customer?.phone;
  if (!phone) return { success: false, message: "No phone number" };

  const results = { sms: null, whatsapp: null };

  if (channel === "both" || channel === "sms") {
    results.sms = await triggerSMS(event, data);
  }

  if (channel === "both" || channel === "whatsapp") {
    const templateId = {
      invoice_due_soon: "invoice_due_soon",
      invoice_overdue: "invoice_overdue",
      payment_received: "payment_received",
      service_suspended: "service_suspended",
      service_restored: "service_restored",
      welcome: "welcome",
    }[event];

    if (templateId) {
      const message = await renderTemplate(
        templateId,
        buildMessageVariables(data),
      );
      if (message) {
        const wa = await getWhatsAppService();
        results.whatsapp = await wa.sendMessage(phone, message);

        await logMessage({
          channel: "whatsapp",
          event,
          template_id: templateId,
          to: [phone],
          message,
          status: results.whatsapp.success ? "sent" : "failed",
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
