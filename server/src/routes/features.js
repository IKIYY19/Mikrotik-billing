/**
 * API Routes for: Branches, Agents, Vouchers, Monitoring, Auto-suspend
 */

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const multiStore = require("../db/multiFeatureStore");
const billing = require("../db/billingStore");

// ═══════════════════════════════════════
// BRANCHES
// ═══════════════════════════════════════
router.get("/branches", (req, res) => {
  const branchStats = multiStore.branches.map((b) => {
    const customers = billing.store.customers.filter(
      (c) => c.branch_id === b.id,
    ).length;
    const routers = billing.store.routers
      ? billing.store.routers.filter((r) => r.branch_id === b.id).length
      : 0;
    const revenue = billing.store.payments
      .filter((p) => {
        const inv = billing.store.invoices.find((i) => i.id === p.invoice_id);
        return (
          inv &&
          billing.store.customers.find((c) => c.id === inv.customer_id)
            ?.branch_id === b.id
        );
      })
      .reduce((sum, p) => sum + p.amount, 0);
    return { ...b, customer_count: customers, router_count: routers, revenue };
  });
  res.json(branchStats);
});

router.post("/branches", (req, res) => {
  const branch = {
    id: uuidv4(),
    ...req.body,
    created_at: new Date().toISOString(),
    status: "active",
  };
  multiStore.branches.push(branch);
  res.status(201).json(branch);
});

// ═══════════════════════════════════════
// AGENTS/RESELLERS
// ═══════════════════════════════════════
router.get("/agents", (req, res) => {
  const agentStats = multiStore.agents.map((a) => {
    const sold = multiStore.vouchers.filter((v) => v.sold_by === a.id).length;
    const revenue = multiStore.vouchers
      .filter((v) => v.sold_by === a.id)
      .reduce((sum, v) => sum + v.price, 0);
    const commission = revenue * (a.commission_rate / 100);
    return {
      ...a,
      vouchers_sold: sold,
      voucher_revenue: revenue,
      commission_earned: commission,
    };
  });
  res.json(agentStats);
});

router.post("/agents", (req, res) => {
  const agent = {
    id: uuidv4(),
    ...req.body,
    balance: 0,
    status: "active",
    created_at: new Date().toISOString(),
  };
  multiStore.agents.push(agent);
  res.status(201).json(agent);
});

router.put("/agents/:id", (req, res) => {
  const idx = multiStore.agents.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Agent not found" });
  multiStore.agents[idx] = { ...multiStore.agents[idx], ...req.body };
  res.json(multiStore.agents[idx]);
});

router.delete("/agents/:id", (req, res) => {
  const idx = multiStore.agents.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Agent not found" });
  multiStore.agents.splice(idx, 1);
  res.json({ message: "Agent deleted" });
});

// ═══════════════════════════════════════
// VOUCHERS
// ═══════════════════════════════════════
router.get("/vouchers", (req, res) => {
  const { status, agent_id } = req.query;
  let filtered = [...multiStore.vouchers];
  if (status) filtered = filtered.filter((v) => v.status === status);
  if (agent_id) filtered = filtered.filter((v) => v.sold_by === agent_id);
  res.json(filtered);
});

router.post("/vouchers/generate", (req, res) => {
  const { count, plan_id, agent_id } = req.body;
  const plan = billing.store.service_plans.find((p) => p.id === plan_id);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const generated = [];
  for (let i = 0; i < (count || 1); i++) {
    const code = `VCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const voucher = {
      id: uuidv4(),
      code,
      plan_name: plan.name,
      plan_id: plan.id,
      duration_days: 30,
      price: plan.price,
      sold_by: agent_id || null,
      sold_to: "",
      status: agent_id ? "sold" : "available",
      redeemed_at: null,
      created_at: new Date().toISOString(),
    };
    multiStore.vouchers.push(voucher);
    generated.push(voucher);
  }

  // If agent specified, deduct from balance
  if (agent_id) {
    const agent = multiStore.agents.find((a) => a.id === agent_id);
    if (agent) agent.balance -= generated.reduce((sum, v) => sum + v.price, 0);
  }

  res.json({ generated, total: generated.length });
});

router.post("/vouchers/redeem", (req, res) => {
  const { code, customer_id } = req.body;
  const voucher = multiStore.vouchers.find(
    (v) => v.code === code && v.status !== "redeemed",
  );

  if (!voucher)
    return res
      .status(404)
      .json({ error: "Invalid or already redeemed voucher" });

  voucher.status = "redeemed";
  voucher.sold_to = customer_id || "";
  voucher.redeemed_at = new Date().toISOString();

  // Activate customer subscription
  const customer = billing.store.customers.find((c) => c.id === customer_id);
  if (customer) {
    const plan = billing.store.service_plans.find(
      (p) => p.name === voucher.plan_name,
    );
    billing.createSubscription({
      customer_id: customer_id,
      plan_id: plan?.id,
      status: "active",
      start_date: new Date().toISOString().split("T")[0],
      billing_cycle: "prepaid",
    });
  }

  res.json({ success: true, voucher });
});

// ═══════════════════════════════════════
// NETWORK MONITORING
// ═══════════════════════════════════════
router.get("/monitoring/dashboard", async (req, res) => {
  try {
    // Get all MikroTik connections
    const db = global.db || require("../db/memory");
    let connections = [];

    try {
      if (global.dbAvailable && db) {
        const result = await db.query("SELECT * FROM mikrotik_connections");
        connections = result.rows;
      }
    } catch (e) {
      console.warn("[Monitoring] Could not fetch connections:", e.message);
    }

    // Decrypt password helper
    function decryptPassword(encryptedPassword) {
      try {
        const crypto = require("crypto");
        const algorithm = "aes-256-gcm";
        const ENCRYPTION_KEY =
          process.env.ENCRYPTION_KEY || "default-key-change-in-production-32";
        const [ivHex, authTagHex, encrypted] = encryptedPassword.split(":");
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const decipher = crypto.createDecipheriv(
          algorithm,
          Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
          iv,
        );
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      } catch (e) {
        return null;
      }
    }

    // Parse MikroTik bytes
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
      };
      return Math.round(value * (multipliers[unit] || 1));
    }

    // Parse MikroTik uptime
    function parseUptime(uptimeStr) {
      if (!uptimeStr) return 0;
      const str = String(uptimeStr);
      let totalSeconds = 0;
      const daysMatch = str.match(/(\d+)d/);
      const hoursMatch = str.match(/(\d+)h/);
      const minsMatch = str.match(/(\d+)m/);
      const secsMatch = str.match(/(\d+)s/);
      if (daysMatch) totalSeconds += parseInt(daysMatch[1]) * 86400;
      if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;
      if (minsMatch) totalSeconds += parseInt(minsMatch[1]) * 60;
      if (secsMatch) totalSeconds += parseInt(secsMatch[1]);
      return totalSeconds;
    }

    function getMemoryUsage(resource) {
      const total = parseBytes(resource["total-memory"]);
      const free = parseBytes(resource["free-memory"]);
      if (!total) return 0;
      return Math.max(0, Math.min(100, ((total - free) / total) * 100));
    }

    const allSessions = [];
    let totalBandwidthIn = 0;
    let totalBandwidthOut = 0;
    const branchMetrics = [];

    // Fetch real PPPoE sessions from each MikroTik router
    for (const connection of connections) {
      const device = { ...connection };
      if (device.password_encrypted) {
        device.password = decryptPassword(device.password_encrypted);
      }

      if (!device.password) continue;

      try {
        const MikroNode = require("mikronode");
        const mikrotik = new MikroNode(device.ip_address, {
          port: device.api_port || 8728,
        });
        const conn = await mikrotik.connect(device.username, device.password);
        const close = conn.closeOnDone(true);

        // Get real router resources and PPPoE active sessions from MikroTik
        const resourceChan = conn.openChannel();
        resourceChan.write("/system/resource/print");
        const resources = await resourceChan.done;

        const pppoeChan = conn.openChannel();
        pppoeChan.write("/ppp/active/print");
        const pppoeActive = await pppoeChan.done;
        close();

        const resource = Array.isArray(resources) ? resources[0] || {} : {};
        const cpuUsage = parseFloat(resource["cpu-load"] || 0);
        const memoryUsage = getMemoryUsage(resource);

        let branchIn = 0;
        let branchOut = 0;

        for (const session of Array.isArray(pppoeActive) ? pppoeActive : []) {
          const username = session.name || session.username;
          if (!username) continue;

          const bytesIn = parseBytes(session["bytes-in"] || session.bytes_in);
          const bytesOut = parseBytes(
            session["bytes-out"] || session.bytes_out,
          );
          const uptimeSeconds = parseUptime(
            session.uptime || session["uptime"],
          );

          branchIn += bytesIn;
          branchOut += bytesOut;

          // Try to find customer
          let customerName = "Unknown";
          try {
            const billingStore = require("../db/billingStore");
            const sub = billingStore.store.subscriptions.find(
              (s) => s.pppoe_username === username && s.status === "active",
            );
            if (sub) {
              const customer = billingStore.store.customers.find(
                (c) => c.id === sub.customer_id,
              );
              if (customer) customerName = customer.name;
            }
          } catch (e) {}

          allSessions.push({
            id: session[".id"] || session.id || username,
            username,
            customer_name: customerName,
            ip_address: session.address || "",
            bytes_in: bytesIn,
            bytes_out: bytesOut,
            uptime_seconds: uptimeSeconds,
            uptime: session.uptime || "",
            connected_at: new Date(
              Date.now() - uptimeSeconds * 1000,
            ).toISOString(),
            router_name: device.name,
          });
        }

        totalBandwidthIn += branchIn;
        totalBandwidthOut += branchOut;

        branchMetrics.push({
          branch: { id: device.id, name: device.name },
          active_pppoe: (Array.isArray(pppoeActive) ? pppoeActive : []).length,
          bandwidth_in: Math.round(branchIn / (1024 * 1024)), // MB
          bandwidth_out: Math.round(branchOut / (1024 * 1024)),
          cpu: Number(cpuUsage.toFixed(1)),
          memory: Number(memoryUsage.toFixed(1)),
          online_routers: 1,
          total_routers: 1,
        });
      } catch (e) {
        console.warn(
          `[Monitoring] Failed to fetch from ${device.name}: ${e.message}`,
        );
        branchMetrics.push({
          branch: { id: device.id, name: device.name },
          active_pppoe: 0,
          bandwidth_in: 0,
          bandwidth_out: 0,
          cpu: 0,
          memory: 0,
          online_routers: 0,
          total_routers: 1,
        });
      }
    }

    if (connections.length === 0) {
      return res.json({
        total_sessions: 0,
        total_bandwidth_in_gb: "0.0",
        total_bandwidth_out_gb: "0.0",
        branch_metrics: [],
        sessions: [],
        metrics_24h: [],
        monitoring_source: "real_mikrotik",
        status: "not_configured",
        message:
          "No MikroTik connections configured. Add a MikroTik API connection to enable real monitoring.",
      });
    }

    const totalSessions = allSessions.length;
    const totalInGB = totalBandwidthIn / (1024 * 1024 * 1024);
    const totalOutGB = totalBandwidthOut / (1024 * 1024 * 1024);

    res.json({
      total_sessions: totalSessions,
      total_bandwidth_in_gb: totalInGB.toFixed(1),
      total_bandwidth_out_gb: totalOutGB.toFixed(1),
      branch_metrics: branchMetrics,
      sessions: allSessions,
      metrics_24h: [],
      monitoring_source: "real_mikrotik",
      status: branchMetrics.some((b) => b.online_routers > 0)
        ? "online"
        : "offline",
      message: branchMetrics.some((b) => b.online_routers > 0)
        ? "Monitoring data collected from MikroTik RouterOS API"
        : "Configured MikroTik routers are offline or unreachable. No dummy monitoring data is being shown.",
    });
  } catch (e) {
    console.error("[Monitoring] Dashboard error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/monitoring/branch/:branchId", (req, res) => {
  const metrics = multiStore.deviceMetrics
    .filter((m) => m.branch_id === req.params.branchId)
    .slice(-24);
  res.json(metrics);
});

// ═══════════════════════════════════════
// AUTO-SUSPEND WITH GRACE PERIOD
// ═══════════════════════════════════════
router.get("/auto-suspend/config", (req, res) => {
  res.json(multiStore.graceConfig);
});

router.put("/auto-suspend/config", (req, res) => {
  Object.assign(multiStore.graceConfig, req.body);
  res.json(multiStore.graceConfig);
});

router.post("/auto-suspend/run", async (req, res) => {
  const { warn_days, throttle_days, suspend_days } = multiStore.graceConfig;
  const results = { warned: [], throttled: [], suspended: [] };

  // Find overdue invoices
  const overdueInvoices = billing.store.invoices.filter(
    (i) => i.status !== "paid" && new Date(i.due_date) < new Date(),
  );

  for (const invoice of overdueInvoices) {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(invoice.due_date).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    const subs = billing.store.subscriptions.filter(
      (s) => s.customer_id === invoice.customer_id && s.status === "active",
    );

    for (const sub of subs) {
      if (daysOverdue >= suspend_days && sub.status === "active") {
        sub.status = "suspended";
        sub.updated_at = new Date().toISOString();
        results.suspended.push({
          subscription_id: sub.id,
          customer: sub.customer?.name,
          days_overdue: daysOverdue,
        });

        // Trigger webhook
        const { triggerWebhook } = require("./webhooks");
        triggerWebhook("customer.suspended", {
          customer_id: invoice.customer_id,
          subscription_id: sub.id,
          days_overdue: daysOverdue,
        }).catch(() => {});
      } else if (daysOverdue >= throttle_days && !sub.throttled) {
        sub.throttled = true;
        sub.throttle_speed = `${multiStore.graceConfig.throttle_speed_up}/${multiStore.graceConfig.throttle_speed_down}`;
        results.throttled.push({
          subscription_id: sub.id,
          customer: sub.customer?.name,
          days_overdue: daysOverdue,
          throttle_speed: sub.throttle_speed,
        });
      } else if (daysOverdue >= warn_days && !sub.warned) {
        sub.warned = true;
        results.warned.push({
          subscription_id: sub.id,
          customer: sub.customer?.name,
          days_overdue: daysOverdue,
        });
      }
    }
  }

  res.json({ success: true, results, config: multiStore.graceConfig });
});

// ═══════════════════════════════════════
// CUSTOMER BRANCH ASSIGNMENT
// ═══════════════════════════════════════
router.put("/customers/:id/branch", (req, res) => {
  const customer = billing.store.customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  customer.branch_id = req.body.branch_id || null;
  res.json(customer);
});

// ═══════════════════════════════════════
// SETUP WIZARD
// ═══════════════════════════════════════
router.post("/setup", async (req, res) => {
  try {
    const { companyName, plans, paymentMethods, mpesa, notifications } =
      req.body;

    // Save company info
    multiStore.companyInfo = {
      name: companyName || "My ISP",
      contactEmail: req.body.contactEmail || "",
      contactPhone: req.body.contactPhone || "",
      address: req.body.address || "",
      setupCompleted: true,
      setupDate: new Date().toISOString(),
    };

    // Create service plans
    if (plans && plans.length > 0) {
      for (const plan of plans) {
        if (!plan.name) continue;
        billing.store.plans.push({
          id: uuidv4(),
          name: plan.name,
          speed_up: plan.speedUp || "1M",
          speed_down: plan.speedDown || "1M",
          price: plan.price || 0,
          quota_gb: plan.quotaGb || null,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Save payment settings
    multiStore.paymentSettings = {
      methods: paymentMethods || {
        cash: true,
        bank: true,
        mpesa: false,
        card: false,
      },
      mpesa: mpesa || {},
    };

    // Save notification settings
    multiStore.notificationSettings = {
      sms: notifications?.sms || false,
      email: notifications?.email || false,
      reminderDays: notifications?.reminderDays || 3,
    };

    console.log("✅ Setup wizard completed");
    res.json({ success: true, message: "Setup completed successfully" });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({ error: "Setup failed" });
  }
});

router.get("/setup/status", (req, res) => {
  res.json({ completed: !!multiStore.companyInfo?.setupCompleted });
});

module.exports = router;
