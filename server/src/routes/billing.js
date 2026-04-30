const express = require("express");
const router = express.Router();
const billing = require("../services/billingData");
const PPPoEProvisioner = require("../utils/pppoeProvisioner");
const { triggerSMS } = require("./sms");
const db = global.dbAvailable ? global.db : require("../db/memory");
const MpesaService = require("../services/mpesa");
const alertSystem = require("../services/alertSystem");
const mikrotikProvisioning = require("../services/mikrotikProvisioning");

async function getExpandedSubscription(subscriptionId) {
  const sub = await billing.getSubscriptionById(subscriptionId);
  if (!sub) return null;

  const customer =
    sub.customer || (await billing.getCustomerById(sub.customer_id));
  const plan = sub.plan || (await billing.getPlanById(sub.plan_id));
  return { ...sub, customer, plan };
}

async function persistSyncState(subscriptionId, syncResult) {
  if (!subscriptionId || !syncResult) return null;

  const payload = {
    last_synced_at: new Date().toISOString(),
    last_sync_status:
      syncResult.status || (syncResult.success ? "synced" : "failed"),
    last_sync_error: syncResult.success
      ? null
      : syncResult.error || syncResult.message || "Unknown sync error",
  };

  await billing.updateSubscription(subscriptionId, payload);
  return billing.getSubscriptionById(subscriptionId);
}

function buildProvisionScriptFallback(action, subscription) {
  if (!subscription?.pppoe_username) {
    return null;
  }

  return PPPoEProvisioner.generateProvisioningScript(action, subscription);
}

async function syncSubscription(action, subscription) {
  if (!subscription?.auto_provision || !subscription?.pppoe_username) {
    return {
      syncResult: {
        success: false,
        status: "skipped",
        error: "Auto provisioning is disabled or PPPoE username is missing",
      },
      provisionScript: null,
    };
  }

  const fallbackScript = buildProvisionScriptFallback(
    action === "delete"
      ? "remove"
      : action === "suspend"
        ? "suspend"
        : subscription.status === "active"
          ? "activate"
          : "suspend",
    subscription,
  );

  if (!subscription.mikrotik_connection_id) {
    return {
      syncResult: {
        success: false,
        status: "skipped",
        error: "No MikroTik connection linked to this subscription",
      },
      provisionScript: fallbackScript,
    };
  }

  try {
    let syncResult;
    if (action === "delete") {
      syncResult =
        await mikrotikProvisioning.deleteSubscriptionSecret(subscription);
    } else if (action === "suspend") {
      syncResult =
        await mikrotikProvisioning.suspendSubscriptionSecret(subscription);
    } else {
      syncResult =
        await mikrotikProvisioning.reconcileSubscription(subscription);
    }

    await persistSyncState(subscription.id, syncResult);
    return {
      syncResult,
      provisionScript: syncResult.success ? null : fallbackScript,
    };
  } catch (error) {
    const failedSync = {
      success: false,
      status: "failed",
      error: error.message,
    };
    await persistSyncState(subscription.id, failedSync);
    return {
      syncResult: failedSync,
      provisionScript: fallbackScript,
    };
  }
}

function normalizeDisabledFlag(value) {
  return value === true || value === "true" || value === "yes";
}

function buildSubscriptionDrift(subscription, secret) {
  const issues = [];
  const expectedRateLimit = mikrotikProvisioning.buildRateLimit(
    subscription.plan,
  );
  const expectedProfile = subscription.pppoe_profile || "";
  const expectedDisabled = subscription.status !== "active";

  if (!secret) {
    issues.push({
      code: "missing_on_router",
      message:
        "Subscription exists in billing but PPPoE secret is missing on MikroTik",
    });
  } else {
    const actualProfile = secret.profile || "";
    const actualDisabled = normalizeDisabledFlag(secret.disabled);
    const actualRateLimit = secret["rate-limit"] || secret.rate_limit || "";

    if (
      (expectedProfile || actualProfile) &&
      expectedProfile !== actualProfile
    ) {
      issues.push({
        code: "profile_mismatch",
        message: `Router profile is "${actualProfile || "default"}" but billing expects "${expectedProfile || "default"}"`,
      });
    }

    if (
      (expectedRateLimit || actualRateLimit) &&
      expectedRateLimit !== actualRateLimit
    ) {
      issues.push({
        code: "rate_limit_mismatch",
        message: `Router rate limit is "${actualRateLimit || "unset"}" but billing expects "${expectedRateLimit || "unset"}"`,
      });
    }

    if (expectedDisabled !== actualDisabled) {
      issues.push({
        code: "status_mismatch",
        message: actualDisabled
          ? "Router secret is disabled while billing says the subscription is active"
          : "Router secret is enabled while billing says the subscription should be suspended",
      });
    }
  }

  if (!subscription.mikrotik_connection_id) {
    issues.push({
      code: "missing_connection_link",
      message: "Subscription has no linked MikroTik connection",
    });
  }

  return issues;
}

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
router.get("/dashboard", async (req, res) => {
  try {
    const stats = await billing.getDashboardStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════
router.get("/customers", async (req, res) => {
  try {
    res.json(await billing.listCustomers());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const customer = await billing.getCustomerDetail(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const customer = await billing.createCustomer(req.body);

    // Auto-create subscription if plan_id provided
    let subscription = null;
    if (req.body.plan_id) {
      try {
        subscription = await billing.createSubscription({
          customer_id: customer.id,
          plan_id: req.body.plan_id,
          status: "active",
          start_date: new Date().toISOString(),
          billing_cycle: "monthly",
        });

        // Sync to MikroTik if connection selected
        if (req.body.mikrotik_connection_id) {
          try {
            const expandedSub = await getExpandedSubscription(subscription.id);
            await syncSubscription("reconcile", expandedSub);
          } catch (syncErr) {
            console.error(
              "Failed to sync subscription to MikroTik:",
              syncErr.message,
            );
          }
        }
      } catch (subErr) {
        console.error("Failed to create subscription:", subErr.message);
      }
    }

    // Auto-generate portal credentials (4-digit PIN)
    const db = global.dbAvailable ? global.db : require("../db/memory");
    const bcrypt = require("bcryptjs");
    const crypto = require("crypto");
    const defaultPin = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit PIN
    const pinHash = await bcrypt.hash(defaultPin, 10);
    const portalUsername = customer.phone || `cust-${customer.id.slice(0, 8)}`;

    if (global.dbAvailable) {
      await db
        .query(
          `UPDATE customers SET portal_username = $1, portal_pin_hash = $2 WHERE id = $3`,
          [portalUsername, pinHash, customer.id],
        )
        .catch(() => {});
    } else {
      const store = db._getStore ? db._getStore() : {};
      if (store.customers) {
        const c = store.customers.find((c) => c.id === customer.id);
        if (c) {
          c.portal_username = portalUsername;
          c.portal_pin_hash = pinHash;
        }
      }
    }

    const portalUrl = `${req.protocol}://${req.get("host")}/portal/login?phone=${encodeURIComponent(customer.phone || "")}`;
    res.status(201).json({
      ...customer,
      subscription: subscription || null,
      portal_url: portalUrl,
      portal_username: portalUsername,
      portal_password: defaultPin,
      message: `Customer created. Portal PIN: ${defaultPin}. Share the portal URL with the customer.`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/customers/:id", async (req, res) => {
  try {
    const customer = await billing.updateCustomer(req.params.id, req.body);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/customers/:id", async (req, res) => {
  try {
    const customer = await billing.deleteCustomer(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json({ message: "Customer deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate/regenerate portal URL for customer
router.post("/customers/:id/portal-url", async (req, res) => {
  try {
    const db = global.dbAvailable ? global.db : require("../db/memory");
    const { v4: uuidv4 } = require("uuid");
    const bcrypt = require("bcryptjs");
    const crypto = require("crypto");

    const newToken = uuidv4();
    const tokenExpires = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Generate random 8-character password
    const newPassword = crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await db.query(
      `UPDATE customers
       SET portal_token = $1, portal_token_expires = $2, portal_password_hash = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, phone, portal_username, portal_token, portal_token_expires`,
      [newToken, tokenExpires, passwordHash, req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = result.rows[0];
    const portalUrl = `${req.protocol}://${req.get("host")}/portal/token/${customer.portal_token}`;

    res.json({
      portal_url: portalUrl,
      portal_token: customer.portal_token,
      portal_token_expires: customer.portal_token_expires,
      portal_username:
        customer.portal_username || customer.email || customer.phone,
      password: newPassword,
    });
  } catch (e) {
    console.error("Generate portal URL error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get customer portal info
router.get("/customers/:id/portal-info", async (req, res) => {
  try {
    const db = global.dbAvailable ? global.db : require("../db/memory");

    const result = await db.query(
      `SELECT id, name, email, phone, portal_username, portal_token, portal_token_expires
       FROM customers
       WHERE id = $1`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = result.rows[0];
    const portalUrl = customer.portal_token
      ? `${req.protocol}://${req.get("host")}/portal/token/${customer.portal_token}`
      : null;

    res.json({
      portal_url: portalUrl,
      portal_token: customer.portal_token,
      portal_token_expires: customer.portal_token_expires,
      portal_username:
        customer.portal_username || customer.email || customer.phone,
    });
  } catch (e) {
    console.error("Get portal info error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Reset portal PIN to a new 4-digit number (for phone+PIN login)
router.post("/customers/:id/reset-pin", async (req, res) => {
  try {
    const db = global.dbAvailable ? global.db : require("../db/memory");
    const bcrypt = require("bcryptjs");

    // Generate random 4-digit PIN
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    const pinHash = await bcrypt.hash(newPin, 10);

    if (global.dbAvailable) {
      const result = await db.query(
        `UPDATE customers SET portal_pin_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, phone`,
        [pinHash, req.params.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }
    } else {
      const store = db._getStore ? db._getStore() : {};
      if (store.customers) {
        const c = store.customers.find((c) => c.id === req.params.id);
        if (c) {
          c.portal_pin_hash = pinHash;
        } else {
          return res.status(404).json({ error: "Customer not found" });
        }
      }
    }

    res.json({
      success: true,
      pin: newPin,
      message: `New portal PIN: ${newPin}. Customer can log in with their phone number and this PIN.`,
    });
  } catch (e) {
    console.error("Reset PIN error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Generate new password for customer
router.post("/customers/:id/reset-password", async (req, res) => {
  try {
    const db = global.dbAvailable ? global.db : require("../db/memory");
    const bcrypt = require("bcryptjs");
    const crypto = require("crypto");

    // Generate random 8-character password
    const newPassword = crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await db.query(
      `UPDATE customers
       SET portal_password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, phone, portal_username`,
      [passwordHash, req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = result.rows[0];

    res.json({
      success: true,
      password: newPassword,
      portal_username:
        customer.portal_username || customer.email || customer.phone,
    });
  } catch (e) {
    console.error("Reset password error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// PAYMENT PROMPTS (M-Pesa STK Push)
// ═══════════════════════════════════════

// Send payment prompt to customer
router.post("/customers/:id/payment-prompt", async (req, res) => {
  try {
    const { amount, invoice_id } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const customer = await billing.getCustomerDetail(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (!customer.phone) {
      return res
        .status(400)
        .json({ error: "Customer phone number is required" });
    }

    // Initialize M-Pesa service
    const mpesa = new MpesaService();
    const accountReference = invoice_id
      ? `INV-${invoice_id}`
      : `PAY-${customer.id}`;
    const description = invoice_id
      ? `Payment for invoice ${invoice_id}`
      : `Payment from ${customer.name}`;

    const mpesaResult = await mpesa.stkPush(
      customer.phone,
      amount,
      accountReference,
      description,
    );

    if (!mpesaResult.success) {
      return res
        .status(400)
        .json({ error: mpesaResult.message || "Failed to send M-Pesa prompt" });
    }

    // Store pending payment
    const pendingId = `pay-${Date.now()}`;
    if (global.dbAvailable) {
      await db.query(
        `INSERT INTO payments (id, customer_id, invoice_id, phone, amount, method, status, reference, received_at)
         VALUES ($1, $2, $3, $4, $5, 'mpesa', 'pending', $6, NOW())`,
        [
          pendingId,
          customer.id,
          invoice_id || null,
          customer.phone,
          parseFloat(amount),
          mpesaResult.checkoutRequestId,
        ],
      );
    }

    res.json({
      success: true,
      checkoutRequestId: mpesaResult.checkoutRequestId,
      pending_id: pendingId,
      message: "Payment prompt sent successfully",
    });
  } catch (e) {
    console.error("Send payment prompt error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// SERVICE PLANS
// ═══════════════════════════════════════
router.get("/plans", async (req, res) => {
  try {
    res.json(await billing.listPlans());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/plans", async (req, res) => {
  try {
    const plan = await billing.createPlan(req.body);
    res.status(201).json(plan);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/plans/:id", async (req, res) => {
  try {
    const plan = await billing.updatePlan(req.params.id, req.body);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/plans/:id", async (req, res) => {
  try {
    const plan = await billing.deletePlan(req.params.id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json({ message: "Plan deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════
router.get("/subscriptions", async (req, res) => {
  try {
    res.json(await billing.listSubscriptions());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/subscriptions", async (req, res) => {
  try {
    const sub = await billing.createSubscription(req.body);

    // Auto-generate first invoice
    const plan = sub.plan || (await billing.getPlanById(sub.plan_id));
    if (plan) {
      await billing.createInvoice({
        customer_id: sub.customer_id,
        subscription_id: sub.id,
        amount: plan.price,
        tax: plan.price * 0.16,
        notes: `First invoice for ${plan.name}`,
      });
    }

    const expandedSub = await getExpandedSubscription(sub.id);
    const { syncResult, provisionScript } = await syncSubscription(
      "reconcile",
      { ...expandedSub, plan },
    );

    res.status(201).json({
      ...expandedSub,
      provision_script: provisionScript,
      mikrotik_sync: syncResult,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/subscriptions/:id", async (req, res) => {
  try {
    const sub = await billing.updateSubscription(req.params.id, req.body);
    if (!sub) return res.status(404).json({ error: "Subscription not found" });
    const expandedSub = await getExpandedSubscription(sub.id);
    const shouldSync =
      req.body.auto_provision !== false &&
      (req.body.pppoe_username || expandedSub.pppoe_username);
    const { syncResult, provisionScript } = shouldSync
      ? await syncSubscription("reconcile", expandedSub)
      : { syncResult: null, provisionScript: null };
    res.json({
      ...expandedSub,
      provision_script: provisionScript,
      mikrotik_sync: syncResult,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/subscriptions/:id/toggle", async (req, res) => {
  try {
    const sub = await billing.toggleSubscriptionStatus(req.params.id);
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    const expandedSub = await getExpandedSubscription(sub.id);
    const action = expandedSub.status === "active" ? "reconcile" : "suspend";
    const { syncResult, provisionScript } = await syncSubscription(
      action,
      expandedSub,
    );

    // Send SMS notification
    if (expandedSub.customer?.phone) {
      triggerSMS(
        sub.status === "active" ? "service_restored" : "service_suspended",
        {
          customer: expandedSub.customer,
          sub: expandedSub,
          plan: expandedSub.plan,
          invoice: null,
          payment: null,
        },
      ).catch((e) => console.error("SMS error:", e.message));
    }

    // Send Telegram alert for suspension
    if (sub.status !== "active" && expandedSub.plan?.name) {
      alertSystem
        .sendServiceSuspension(expandedSub.customer.id, expandedSub.plan.name)
        .catch((e) => console.error("Telegram alert error:", e.message));
    }

    res.json({
      ...expandedSub,
      provision_script: provisionScript,
      mikrotik_sync: syncResult,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/subscriptions/:id/sync", async (req, res) => {
  try {
    const sub = await getExpandedSubscription(req.params.id);
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    const { syncResult, provisionScript } = await syncSubscription(
      "reconcile",
      sub,
    );
    const refreshed = await getExpandedSubscription(req.params.id);
    res.json({
      ...refreshed,
      provision_script: provisionScript,
      mikrotik_sync: syncResult,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/reconcile", async (req, res) => {
  try {
    const { connection_id = "" } = req.query;
    const subscriptions = await billing.listSubscriptions();
    const mikrotikConnections = connection_id
      ? [await mikrotikProvisioning.getConnectionById(connection_id)].filter(
          Boolean,
        )
      : (
          await db.query(
            "SELECT id, name, ip_address, is_online, last_seen FROM mikrotik_connections ORDER BY name ASC",
          )
        ).rows;

    const subscriptionsInScope = subscriptions.filter((subscription) => {
      if (!connection_id) return true;
      return subscription.mikrotik_connection_id === connection_id;
    });

    const secretsByConnection = new Map();
    const connectionErrors = [];

    for (const connection of mikrotikConnections) {
      try {
        const secrets = await mikrotikProvisioning.print(
          connection.id,
          "/ppp/secret",
          ".id,name,profile,comment,disabled,rate-limit",
        );
        secretsByConnection.set(connection.id, secrets);
      } catch (error) {
        connectionErrors.push({
          connection_id: connection.id,
          connection_name: connection.name,
          error: error.message,
        });
        secretsByConnection.set(connection.id, []);
      }
    }

    const subscriptionItems = subscriptionsInScope.map((subscription) => {
      const secrets = subscription.mikrotik_connection_id
        ? secretsByConnection.get(subscription.mikrotik_connection_id) || []
        : [];
      const secret = subscription.pppoe_username
        ? secrets.find((item) => item.name === subscription.pppoe_username)
        : null;
      const issues = buildSubscriptionDrift(subscription, secret);

      return {
        type: "subscription",
        id: subscription.id,
        subscription_id: subscription.id,
        connection_id: subscription.mikrotik_connection_id || null,
        connection_name: subscription.router?.name || "Unlinked",
        customer_name: subscription.customer?.name || "Unknown",
        plan_name: subscription.plan?.name || "Unknown plan",
        pppoe_username: subscription.pppoe_username || "",
        billing_status: subscription.status,
        router_secret_status: secret
          ? normalizeDisabledFlag(secret.disabled)
            ? "disabled"
            : "active"
          : "missing",
        sync_status: issues.length === 0 ? "healthy" : "drift",
        issues,
        secret,
        subscription,
      };
    });

    const billingKeys = new Set(
      subscriptionsInScope
        .filter((item) => item.mikrotik_connection_id && item.pppoe_username)
        .map((item) => `${item.mikrotik_connection_id}:${item.pppoe_username}`),
    );

    const orphanSecrets = [];
    for (const connection of mikrotikConnections) {
      const secrets = secretsByConnection.get(connection.id) || [];
      for (const secret of secrets) {
        const key = `${connection.id}:${secret.name}`;
        if (!billingKeys.has(key)) {
          orphanSecrets.push({
            type: "orphan_secret",
            connection_id: connection.id,
            connection_name: connection.name,
            pppoe_username: secret.name,
            router_secret_status: normalizeDisabledFlag(secret.disabled)
              ? "disabled"
              : "active",
            sync_status: "untracked",
            issues: [
              {
                code: "missing_in_billing",
                message:
                  "PPPoE secret exists on MikroTik but has no linked billing subscription",
              },
            ],
            secret,
          });
        }
      }
    }

    const summary = {
      total_subscriptions: subscriptionItems.length,
      healthy_subscriptions: subscriptionItems.filter(
        (item) => item.sync_status === "healthy",
      ).length,
      drifted_subscriptions: subscriptionItems.filter(
        (item) => item.sync_status === "drift",
      ).length,
      orphan_secrets: orphanSecrets.length,
      connection_errors: connectionErrors.length,
    };

    res.json({
      summary,
      connection_errors: connectionErrors,
      subscriptions: subscriptionItems,
      orphan_secrets: orphanSecrets,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/reconcile/subscriptions/:id/apply", async (req, res) => {
  try {
    const sub = await getExpandedSubscription(req.params.id);
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    const { syncResult, provisionScript } = await syncSubscription(
      "reconcile",
      sub,
    );
    const refreshed = await getExpandedSubscription(req.params.id);
    res.json({
      subscription: refreshed,
      mikrotik_sync: syncResult,
      provision_script: provisionScript,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/reconcile/orphan-secret/import", async (req, res) => {
  try {
    const {
      connection_id,
      pppoe_username,
      plan_id,
      customer_id = "",
      customer_name = "",
      customer_email = "",
      customer_phone = "",
      billing_cycle = "monthly",
    } = req.body;

    if (!connection_id || !pppoe_username || !plan_id) {
      return res.status(400).json({
        error: "connection_id, pppoe_username, and plan_id are required",
      });
    }

    const connection =
      await mikrotikProvisioning.getConnectionById(connection_id);
    if (!connection) {
      return res.status(404).json({ error: "MikroTik connection not found" });
    }

    const secret = await mikrotikProvisioning.findSecret(
      connection_id,
      pppoe_username,
    );
    if (!secret) {
      return res
        .status(404)
        .json({ error: "PPPoE secret not found on MikroTik" });
    }

    const existingSubscriptions = await billing.listSubscriptions();
    const alreadyLinked = existingSubscriptions.find(
      (item) =>
        item.mikrotik_connection_id === connection_id &&
        item.pppoe_username === pppoe_username,
    );
    if (alreadyLinked) {
      return res.status(409).json({
        error: "This PPPoE secret is already linked to a billing subscription",
      });
    }

    let customer;
    if (customer_id) {
      customer = await billing.getCustomerById(customer_id);
      if (!customer) {
        return res
          .status(404)
          .json({ error: "Selected customer was not found" });
      }
    } else {
      const name = customer_name.trim() || pppoe_username;
      customer = await billing.createCustomer({
        name,
        email: customer_email || null,
        phone: customer_phone || null,
        status: "active",
        notes: `Imported from MikroTik connection ${connection.name}`,
      });
    }

    const status = normalizeDisabledFlag(secret.disabled)
      ? "suspended"
      : "active";
    const subscription = await billing.createSubscription({
      customer_id: customer.id,
      plan_id,
      mikrotik_connection_id: connection_id,
      router_id: null,
      pppoe_username,
      pppoe_password: "",
      pppoe_profile: secret.profile || "",
      billing_cycle,
      status,
      auto_provision: true,
    });

    const expanded = await getExpandedSubscription(subscription.id);
    const syncResult = {
      success: true,
      status: "imported",
      message:
        "Orphan PPPoE secret imported into billing and linked to MikroTik",
    };
    await persistSyncState(subscription.id, syncResult);
    const refreshed = await getExpandedSubscription(subscription.id);

    res.status(201).json({
      customer,
      subscription: refreshed || expanded,
      mikrotik_sync: syncResult,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/subscriptions/:id", async (req, res) => {
  try {
    const existing = await getExpandedSubscription(req.params.id);
    let syncResult = null;
    let provisionScript = null;
    if (existing) {
      const syncOutcome = await syncSubscription("delete", existing);
      syncResult = syncOutcome.syncResult;
      provisionScript = syncOutcome.provisionScript;
    }
    const deleted = await billing.deleteSubscription(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Subscription not found" });
    res.json({
      success: true,
      mikrotik_sync: syncResult,
      provision_script: provisionScript,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════
router.get("/invoices", async (req, res) => {
  try {
    const invoices = await billing.listInvoices();
    res.json(
      invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const invoice = await billing.createInvoice(req.body);

    // Send SMS notification
    const customer =
      invoice.customer || (await billing.getCustomerById(invoice.customer_id));
    if (customer?.phone) {
      triggerSMS("invoice_due_soon", { customer, invoice }).catch((e) =>
        console.error("SMS error:", e.message),
      );
    }

    // Send Telegram alert
    if (invoice.invoice_number) {
      alertSystem
        .sendNewInvoice(
          invoice.customer_id,
          invoice.invoice_number,
          invoice.total,
          invoice.due_date,
        )
        .catch((e) => console.error("Telegram alert error:", e.message));
    }

    res.status(201).json(invoice);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Credit Notes
router.get("/credit-notes", async (req, res) => {
  try {
    if (!global.db) {
      return res.json([]);
    }
    const result = await global.db.query(
      `SELECT cn.*, c.name as customer_name, i.invoice_number
       FROM credit_notes cn
       LEFT JOIN customers c ON c.id = cn.customer_id
       LEFT JOIN invoices i ON i.id = cn.invoice_id
       ORDER BY cn.created_at DESC`,
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/credit-notes", async (req, res) => {
  try {
    const { customer_id, invoice_id, amount, reason } = req.body || {};

    if (!customer_id || !amount) {
      return res
        .status(400)
        .json({ error: "customer_id and amount are required" });
    }

    if (!global.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    // Generate credit note number
    const now = new Date();
    const prefix = `CN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const countResult = await global.db.query(
      `SELECT COUNT(*) FROM credit_notes WHERE credit_note_number LIKE $1`,
      [`${prefix}%`],
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const creditNoteNumber = `${prefix}-${String(count).padStart(4, "0")}`;

    const result = await global.db.query(
      `INSERT INTO credit_notes (id, credit_note_number, customer_id, invoice_id, amount, reason, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [
        creditNoteNumber,
        customer_id,
        invoice_id || null,
        parseFloat(amount),
        reason || "",
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error("Credit note error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.put("/credit-notes/:id", async (req, res) => {
  try {
    const { status } = req.body || {};
    const creditNoteId = req.params.id;

    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    if (!global.db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const result = await global.db.query(
      `UPDATE credit_notes SET status = $1 WHERE id = $2 RETURNING *`,
      [status, creditNoteId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Credit note not found" });
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/invoices/:id", async (req, res) => {
  try {
    const invoice = await billing.updateInvoice(req.params.id, req.body);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/invoices/generate-monthly", async (req, res) => {
  try {
    const created = await billing.generateMonthlyInvoices();
    res.json({
      message: `Generated ${created.length} invoices`,
      invoices: created,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════
router.get("/payments", async (req, res) => {
  try {
    const payments = await billing.listPayments();
    res.json(
      payments.sort(
        (a, b) => new Date(b.received_at) - new Date(a.received_at),
      ),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/payments", async (req, res) => {
  try {
    const payment = await billing.createPayment(req.body);

    // Send SMS confirmation
    const customer =
      payment.customer || (await billing.getCustomerById(payment.customer_id));
    const invoice =
      payment.invoice || (await billing.getInvoiceById(payment.invoice_id));
    if (customer?.phone) {
      triggerSMS("payment_received", { customer, invoice, payment }).catch(
        (e) => console.error("SMS error:", e.message),
      );
    }

    // Trigger webhooks
    const { triggerWebhook } = require("./webhooks");
    triggerWebhook("payment.received", {
      customer_id: payment.customer_id,
      amount: payment.amount,
      invoice_id: payment.invoice_id,
    }).catch(() => {});

    res.status(201).json(payment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// REAL-TIME ONLINE STATUS
// ═══════════════════════════════════════
router.get("/customers/online-status", async (req, res) => {
  try {
    const { connection_id } = req.query;
    if (!connection_id)
      return res.json({ online: {}, pppoe: [], hotspot: [], total: 0 });

    // Get MikroTik connection
    const db = global.db || require("../db/memory");
    const crypto = require("crypto");
    const algorithm = "aes-256-gcm";
    const ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY || "default-key-change-in-production-32";

    const connResult = await db.query(
      "SELECT * FROM mikrotik_connections WHERE id = $1",
      [connection_id],
    );
    if (connResult.rows.length === 0)
      return res.json({ online: {}, pppoe: [], hotspot: [], total: 0 });

    const device = connResult.rows[0];
    const [ivHex, authTagHex, encrypted] = device.password_encrypted.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv,
    );
    decipher.setAuthTag(authTag);
    let password = decipher.update(encrypted, "hex", "utf8");
    password += decipher.final("utf8");

    // Fetch active PPPoE and Hotspot sessions
    const MikroNode = require("mikronode");
    const mikrotik = new MikroNode(device.ip_address, {
      port: device.api_port || 8728,
    });
    const connection = await mikrotik.connect(device.username, password);
    const close = connection.closeOnDone(true);

    // Get PPPoE active sessions
    const pppoeChan = connection.openChannel();
    pppoeChan.write("/ppp/active/print");
    const pppoeActive = await pppoeChan.done;

    // Get Hotspot active sessions
    const hotspotChan = connection.openChannel();
    hotspotChan.write("/ip/hotspot/active/print");
    const hotspotActive = await hotspotChan.done;

    // Get PPPoE secrets to map username → customer
    const secretsChan = connection.openChannel();
    secretsChan.write("/ppp/secret/print", { ".proplist": "name,comment" });
    await secretsChan.done;

    close();

    // Build online map: customer_id → session info
    const onlineMap = {};
    const pppoeOnline = [];
    const hotspotOnline = [];

    // Match PPPoE sessions to billing customers
    const allCustomers = await billing.listCustomers();
    const allSubscriptions = await billing.listSubscriptions();

    for (const session of Array.isArray(pppoeActive) ? pppoeActive : []) {
      const username = session.name || session.user;
      if (!username) continue;

      // Find subscription with this PPPoE username
      const sub = allSubscriptions.find((s) => s.pppoe_username === username);
      if (sub) {
        onlineMap[sub.customer_id] = {
          type: "pppoe",
          username,
          address: session.address,
          uptime: session.uptime,
          encoding: session.encoding,
          connected_at: new Date().toISOString(),
        };
        pppoeOnline.push({
          customer_id: sub.customer_id,
          customer_name:
            allCustomers.find((c) => c.id === sub.customer_id)?.name ||
            "Unknown",
          username,
          address: session.address,
          uptime: session.uptime,
          encoding: session.encoding,
        });
      }
    }

    // Match Hotspot sessions to billing customers
    for (const session of Array.isArray(hotspotActive) ? hotspotActive : []) {
      const username = session.user;
      if (!username) continue;

      // Try to find customer by hotspot username match in subscriptions or custom field
      const sub = allSubscriptions.find((s) => s.hotspot_username === username);
      if (sub) {
        const customerId = sub.customer_id;
        if (!onlineMap[customerId]) {
          // Don't override PPPoE if already online
          onlineMap[customerId] = {
            type: "hotspot",
            username,
            address: session.address,
            uptime: session.uptime,
            mac: session["mac-address"],
            bytes_in: session["bytes-in"],
            bytes_out: session["bytes-out"],
            connected_at: new Date().toISOString(),
          };
          hotspotOnline.push({
            customer_id: customerId,
            customer_name:
              allCustomers.find((c) => c.id === customerId)?.name || "Unknown",
            username,
            address: session.address,
            uptime: session.uptime,
            mac: session["mac-address"],
            bytes_in: session["bytes-in"],
            bytes_out: session["bytes-out"],
          });
        }
      }
    }

    res.json({
      online: onlineMap,
      pppoe: pppoeOnline,
      hotspot: hotspotOnline,
      total: pppoeOnline.length + hotspotOnline.length,
    });
  } catch (e) {
    console.error("Online status error:", e);
    res.json({
      online: {},
      pppoe: [],
      hotspot: [],
      total: 0,
      error: e.message,
    });
  }
});

// ═══════════════════════════════════════
// USAGE
// ═══════════════════════════════════════
router.get("/usage/:customerId", async (req, res) => {
  try {
    const records = await billing.listUsageRecords({
      customerId: req.params.customerId,
      limit: 100,
    });
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/usage/record", async (req, res) => {
  try {
    const record = await billing.recordUsage(req.body);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get aggregated usage history for bandwidth graphs
router.get("/usage/history", async (req, res) => {
  try {
    const {
      time_range = "1h",
      customer_id = "",
      connection_id = "",
    } = req.query;

    // Determine time window and grouping
    const now = new Date();
    let startTime, groupBy;
    switch (time_range) {
      case "6h":
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        groupBy = "5m";
        break;
      case "24h":
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        groupBy = "15m";
        break;
      case "7d":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = "1h";
        break;
      default: // 1h
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        groupBy = "1m";
    }

    // Get all usage records within the time window
    const records = await billing.listUsageRecords({
      customerId: customer_id || undefined,
      startTime,
      endTime: now,
      limit: 5000,
    });

    // If connection_id specified, get PPPoE sessions from MikroTik for real-time data
    let pppoeSessions = [];
    let pppoeBandwidth = { total_in: 0, total_out: 0 };

    if (connection_id) {
      try {
        const db = global.db || require("../db/memory");
        const crypto = require("crypto");
        const algorithm = "aes-256-gcm";
        const ENCRYPTION_KEY =
          process.env.ENCRYPTION_KEY || "default-key-change-in-production-32";

        const connResult = await db.query(
          "SELECT * FROM mikrotik_connections WHERE id = $1",
          [connection_id],
        );
        if (connResult.rows.length > 0) {
          const device = connResult.rows[0];
          const [ivHex, authTagHex, encrypted] =
            device.password_encrypted.split(":");
          const iv = Buffer.from(ivHex, "hex");
          const authTag = Buffer.from(authTagHex, "hex");
          const decipher = crypto.createDecipheriv(
            algorithm,
            Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
            iv,
          );
          decipher.setAuthTag(authTag);
          let password = decipher.update(encrypted, "hex", "utf8");
          password += decipher.final("utf8");

          const MikroNode = require("mikronode");
          const mikrotik = new MikroNode(device.ip_address, {
            port: device.api_port || 8728,
          });
          const connection = await mikrotik.connect(device.username, password);
          const close = connection.closeOnDone(true);

          const pppoeChan = connection.openChannel();
          pppoeChan.write("/ppp/active/print");
          pppoeSessions = await pppoeChan.done;
          close();

          // Calculate total bandwidth from PPPoE sessions
          for (const session of Array.isArray(pppoeSessions)
            ? pppoeSessions
            : []) {
            const bytesIn = parseBytes(session["bytes-in"] || session.bytes_in);
            const bytesOut = parseBytes(
              session["bytes-out"] || session.bytes_out,
            );
            pppoeBandwidth.total_in += bytesIn;
            pppoeBandwidth.total_out += bytesOut;
          }
        }
      } catch (e) {
        console.warn("[Billing] Failed to get PPPoE data:", e.message);
      }
    }

    // Aggregate records by time bucket
    const aggregated = aggregateByTimeRange(records, startTime, now, groupBy);

    // If no historical data, use current PPPoE session data to populate latest point
    if (aggregated.length === 0 && pppoeSessions.length > 0) {
      aggregated.push({
        time: now.toISOString(),
        download: pppoeBandwidth.total_out,
        upload: pppoeBandwidth.total_in,
        total: pppoeBandwidth.total_in + pppoeBandwidth.total_out,
        sessions: pppoeSessions.length,
      });
    }

    res.json({
      data: aggregated,
      time_range: time_range,
      group_by: groupBy,
      total_sessions: pppoeSessions.length,
      total_bandwidth_in: pppoeBandwidth.total_in,
      total_bandwidth_out: pppoeBandwidth.total_out,
    });
  } catch (e) {
    console.error("[Billing] Usage history error:", e);
    res.status(500).json({ error: e.message, data: [] });
  }
});

// Helper: parse MikroTik bytes string to integer
function parseBytes(bytesStr) {
  if (!bytesStr) return 0;
  const str = String(bytesStr);
  if (/^\d+$/.test(str)) return parseInt(str);
  const match = str.match(/^([\d.]+)\s*([KMGTP]i?B)?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || "").toLowerCase().replace("ib", "");
  const multipliers = {
    "": 1,
    k: 1024,
    m: 1048576,
    g: 1073741824,
    t: 1099511627776,
    p: 1125899906842624,
  };
  return Math.round(value * (multipliers[unit] || 1));
}

// Helper: aggregate usage records into time buckets
function aggregateByTimeRange(records, startTime, endTime, groupBy) {
  const buckets = [];
  let current = new Date(startTime);

  // Determine bucket size in milliseconds
  let bucketSize;
  switch (groupBy) {
    case "1m":
      bucketSize = 60 * 1000;
      break;
    case "5m":
      bucketSize = 5 * 60 * 1000;
      break;
    case "15m":
      bucketSize = 15 * 60 * 1000;
      break;
    case "1h":
      bucketSize = 60 * 60 * 1000;
      break;
    default:
      bucketSize = 60 * 1000;
  }

  while (current < endTime) {
    const bucketEnd = new Date(current.getTime() + bucketSize);
    const bucketRecords = records.filter((r) => {
      const t = new Date(r.recorded_at);
      return t >= current && t < bucketEnd;
    });

    const download = bucketRecords.reduce(
      (sum, r) => sum + (parseInt(r.bytes_out) || 0),
      0,
    );
    const upload = bucketRecords.reduce(
      (sum, r) => sum + (parseInt(r.bytes_in) || 0),
      0,
    );
    const uniqueSessions = new Set(
      bucketRecords.map((r) => r.session_id).filter(Boolean),
    ).size;

    buckets.push({
      time: current.toISOString(),
      download,
      upload,
      total: download + upload,
      sessions: Math.max(uniqueSessions, bucketRecords.length),
    });

    current = bucketEnd;
  }

  return buckets;
}

// ═══════════════════════════════════════
// REVIEWS (Admin)
// ═══════════════════════════════════════

// Get all reviews (admin only)
router.get("/reviews", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       FROM reviews r
       LEFT JOIN customers c ON c.id = r.customer_id
       ORDER BY r.created_at DESC`,
    );
    res.json(result.rows);
  } catch (e) {
    console.error("Get all reviews error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get staff points leaderboard
router.get("/staff-points", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, COALESCE(SUM(sp.points), 0) as total_points
       FROM users u
       LEFT JOIN staff_points sp ON sp.user_id = u.id
       WHERE u.role IN ('customer_care', 'sales_team', 'admin', 'technician')
       GROUP BY u.id, u.name, u.email, u.role
       ORDER BY total_points DESC`,
    );
    res.json(result.rows);
  } catch (e) {
    console.error("Get staff points error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get staff point history
router.get("/staff-points/:userId", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sp.*, r.rating, r.service_quality, c.name as customer_name
       FROM staff_points sp
       LEFT JOIN reviews r ON r.id = sp.review_id
       LEFT JOIN customers c ON c.id = r.customer_id
       WHERE sp.user_id = $1
       ORDER BY sp.created_at DESC`,
      [req.params.userId],
    );
    res.json(result.rows);
  } catch (e) {
    console.error("Get staff point history error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
