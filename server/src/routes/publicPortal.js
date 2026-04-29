const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

function getDb() {
  return global.db || require("../db/memory");
}

// GET /api/public/plans - List active plans for self-registration
router.get("/plans", async (req, res) => {
  try {
    const billing = require("../services/billingData");
    const allPlans = await billing.listPlans();
    // Only return active plans, hide internal fields
    const plans = allPlans
      .filter((p) => p.status !== "archived")
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        speed: p.speed,
        data_cap: p.data_cap,
        duration_days: p.duration_days || 30,
        connection_type: p.connection_type || "pppoe",
      }));
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/public/register - Register new customer
router.post("/register", async (req, res) => {
  try {
    const { name, phone, email, pin, plan_id } = req.body;
    if (!name || !phone || !pin || !plan_id) {
      return res
        .status(400)
        .json({ error: "Name, phone, PIN, and plan are required" });
    }
    if (!/^\d{4,8}$/.test(String(pin))) {
      return res.status(400).json({ error: "PIN must be 4-8 digits" });
    }

    const billing = require("../services/billingData");
    const plan = billing.getPlanById(plan_id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const bcrypt = require("bcryptjs");
    const pinHash = await bcrypt.hash(pin, 10);

    // Create customer
    const customer = await billing.createCustomer({
      name,
      phone,
      email: email || "",
      address: "",
      status: "active",
      created_at: new Date().toISOString(),
    });

    // Create subscription
    const sub = await billing.createSubscription({
      customer_id: customer.id,
      plan_id: plan.id,
      status: "pending",
      start_date: new Date().toISOString(),
      auto_renew: true,
    });

    // Create first invoice
    const invoice = await billing.createInvoice({
      customer_id: customer.id,
      subscription_id: sub.id,
      amount: plan.price,
      tax: plan.price * 0.16,
      status: "unpaid",
      due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      description: `${plan.name} - ${plan.description || "Internet Service"}`,
      created_at: new Date().toISOString(),
    });

    // Store the PIN hash on the customer record for portal login
    const bcrypt2 = require("bcryptjs");
    const pinHashStored = await bcrypt2.hash(pin, 10);
    if (!global.dbAvailable) {
      const store = getDb()._getStore ? getDb()._getStore() : {};
      if (store.customers) {
        const c = store.customers.find((c) => c.id === customer.id);
        if (c) c.portal_pin_hash = pinHashStored;
      }
    } else {
      try {
        await getDb().query(
          `UPDATE customers SET portal_pin_hash = $1 WHERE id = $2`,
          [pinHashStored, customer.id],
        );
      } catch (dbErr) {
        // portal_pin_hash column might not exist yet
      }
    }

    res.status(201).json({
      success: true,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      subscription: { id: sub.id, plan_id: plan.id, status: sub.status },
      invoice: {
        id: invoice.id,
        amount: invoice.amount,
        status: invoice.status,
      },
      plan: { name: plan.name, price: plan.price },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/public/confirm-payment - Confirm payment and activate
router.post("/confirm-payment", async (req, res) => {
  try {
    const { invoice_id, mpesa_code } = req.body;
    if (!invoice_id)
      return res.status(400).json({ error: "Invoice ID required" });

    const billing = require("../services/billingData");

    // Mark invoice as paid
    const invoice = await billing.updateInvoice(invoice_id, {
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: mpesa_code ? "mpesa" : "cash",
      payment_reference: mpesa_code || "self-service",
    });

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    // Get subscription and activate it
    const sub = invoice.subscription_id
      ? await billing.getSubscriptionById(invoice.subscription_id)
      : null;
    if (sub) {
      await billing.updateSubscription(sub.id, {
        status: "active",
        activated_at: new Date().toISOString(),
      });
    }

    // Get customer and plan for response
    const customer = sub
      ? await billing.getCustomerById(sub.customer_id)
      : null;
    const plan = sub ? await billing.getPlanById(sub.plan_id) : null;

    // Generate credentials (PPPoE username/password or hotspot voucher)
    const pppoeUsername = customer ? `isp-${customer.phone}` : null;
    const pppoePassword = Math.random().toString(36).substring(2, 10);

    res.json({
      success: true,
      message: "Payment confirmed. Your service is now active!",
      credentials: {
        username: pppoeUsername,
        password: pppoePassword,
        plan_name: plan?.name || "",
        speed: plan?.speed || "",
      },
      customer: customer ? { id: customer.id, name: customer.name } : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
