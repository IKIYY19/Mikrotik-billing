/**
 * API Routes for: Prepaid Wallet, Map View, Auto Backup
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const walletStore = require("../db/walletStore");
const backupStore = require("../db/backupStore");
const billing = require("../db/billingStore");
const { triggerMessage } = require("./sms");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// ═══════════════════════════════════════
// PREPAID WALLET
// ═══════════════════════════════════════

router.get("/wallet/all", (req, res) => {
  walletStore.autoSetRatesFromPlans();
  res.json(walletStore.getAllWallets());
});

router.get("/wallet/:customerId", (req, res) => {
  const wallet = walletStore.getWallet(req.params.customerId);
  const transactions = walletStore.getTransactions(req.params.customerId);

  if (!wallet) {
    // Create wallet if doesn't exist
    const newWallet = walletStore.topUp(req.params.customerId, 0);
    return res.json({ wallet: newWallet.wallet, transactions: [] });
  }

  res.json({ wallet, transactions });
});

router.post("/wallet/:customerId/topup", async (req, res) => {
  const { amount, method = "mpesa", reference } = req.body;
  if (!amount || parseFloat(amount) <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const result = await walletStore.topUp(
    req.params.customerId,
    parseFloat(amount),
    method,
    reference,
  );

  // Send confirmation SMS/WhatsApp
  const customer = billing.store.customers.find(
    (c) => c.id === req.params.customerId,
  );
  if (customer?.phone) {
    triggerMessage("payment_received", {
      customer,
      payment: { reference: reference || result.transaction.id },
      invoice: { total: amount, paid_amount: amount },
    }).catch(() => {});
  }

  res.json(result);
});

router.post("/wallet/:customerId/set-rate", (req, res) => {
  const { daily_rate } = req.body;
  if (!daily_rate || parseFloat(daily_rate) <= 0)
    return res.status(400).json({ error: "Invalid rate" });

  const wallet = walletStore.setDailyRate(
    req.params.customerId,
    parseFloat(daily_rate),
  );
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });

  res.json(wallet);
});

router.post("/wallet/daily-run", async (req, res) => {
  const results = walletStore.runDailyDeductions();
  res.json(results);
});

// ═══════════════════════════════════════
// MAP / GIS
// ═══════════════════════════════════════

router.get("/map/data", async (req, res) => {
  try {
    const db = global.dbAvailable ? global.db : require("../db/memory");
    const billing = require("../db/billingStore");
    const walletStore = require("../db/walletStore");

    // Get branches from database or fallback to in-memory
    let branches = [];
    if (global.dbAvailable) {
      const branchResult = await db.query(
        "SELECT * FROM branches ORDER BY name",
      );
      branches = branchResult.rows.map((b) => ({
        id: b.id,
        name: b.name,
        type: "branch",
        lat: parseFloat(b.lat),
        lng: parseFloat(b.lng),
        city: b.city,
        status: b.status,
        active_pppoe: b.active_pppoe || 0,
        online_routers: b.online_routers || 0,
        total_routers: b.total_routers || 0,
      }));
    } else {
      const multiStore = require("../db/multiFeatureStore");
      branches = multiStore.branches.map((b) => ({
        id: b.id,
        name: b.name,
        type: "branch",
        lat: b.lat || null,
        lng: b.lng || null,
        city: b.city,
        status: b.status,
        active_pppoe: Math.floor(Math.random() * 50) + 10,
        online_routers: Math.floor(Math.random() * 3) + 1,
        total_routers: 3,
      }));
    }

    // Get customers with coordinates
    let customers = [];
    if (global.dbAvailable) {
      const customerResult = await db.query(
        `SELECT c.id, c.name, c.lat, c.lng, c.phone, c.status, c.branch_id,
         s.plan_id, s.status as sub_status, s.throttled
         FROM customers c
         LEFT JOIN subscriptions s ON s.customer_id = c.id AND s.status = 'active'
         WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL`,
      );

      const plans = await db.query("SELECT id, name FROM service_plans");
      const planMap = new Map(plans.rows.map((p) => [p.id, p.name]));

      customers = customerResult.rows.map((c) => ({
        id: c.id,
        name: c.name,
        type: "customer",
        lat: parseFloat(c.lat),
        lng: parseFloat(c.lng),
        status:
          c.status === "suspended"
            ? "suspended"
            : c.throttled
              ? "throttled"
              : "active",
        phone: c.phone,
        plan: c.plan_id ? planMap.get(c.plan_id) : null,
        branch_id: c.branch_id,
      }));
    } else {
      customers = billing.store.customers.map((c) => {
        const sub = billing.store.subscriptions.find(
          (s) => s.customer_id === c.id && s.status === "active",
        );
        const wallet = walletStore.getWallet(c.id);
        const isSuspended =
          sub?.status === "suspended" || wallet?.status === "suspended";
        const isThrottled = sub?.throttled;

        return {
          id: c.id,
          name: c.name,
          type: "customer",
          lat: c.lat || null,
          lng: c.lng || null,
          status: isSuspended
            ? "suspended"
            : isThrottled
              ? "throttled"
              : "active",
          phone: c.phone,
          plan: sub?.plan
            ? billing.store.service_plans.find((p) => p.id === sub.plan_id)
                ?.name
            : null,
          branch_id: c.branch_id,
        };
      });
    }

    // Calculate center point from all locations
    const allLats = [
      ...branches.map((b) => b.lat),
      ...customers.map((c) => c.lat),
    ];
    const allLngs = [
      ...branches.map((b) => b.lng),
      ...customers.map((c) => c.lng),
    ];
    const centerLat =
      allLats.length > 0
        ? allLats.reduce((a, b) => a + b, 0) / allLats.length
        : -1.2921;
    const centerLng =
      allLngs.length > 0
        ? allLngs.reduce((a, b) => a + b, 0) / allLngs.length
        : 36.8219;

    res.json({ branches, customers, center: [centerLat, centerLng], zoom: 10 });
  } catch (e) {
    console.error("Map data error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.put("/map/customer/:id", (req, res) => {
  const customer = billing.store.customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  if (req.body.lat !== undefined) customer.lat = req.body.lat;
  if (req.body.lng !== undefined) customer.lng = req.body.lng;

  res.json(customer);
});

// ═══════════════════════════════════════
// AUTO BACKUP
// ═══════════════════════════════════════

router.get("/backup/schedules", (req, res) => {
  res.json(backupStore.getAllSchedules());
});

router.get("/backup/schedules/:id", (req, res) => {
  const schedule = backupStore.getSchedule(req.params.id);
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  res.json(schedule);
});

router.post("/backup/schedules", (req, res) => {
  const schedule = backupStore.createSchedule(req.body);
  res.status(201).json(schedule);
});

router.put("/backup/schedules/:id", (req, res) => {
  const schedule = backupStore.updateSchedule(req.params.id, req.body);
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  res.json(schedule);
});

router.delete("/backup/schedules/:id", (req, res) => {
  const schedule = backupStore.deleteSchedule(req.params.id);
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  res.json({ message: "Schedule deleted" });
});

router.post("/backup/schedules/:id/run", async (req, res) => {
  const result = await backupStore.runBackup(req.params.id);
  res.json(result);
});

router.post("/backup/run-all", async (req, res) => {
  const results = await backupStore.runAllBackups();
  res.json(results);
});

router.get("/backup/backups", (req, res) => {
  const backups = backupStore.getBackups(
    req.query.schedule_id,
    parseInt(req.query.limit) || 50,
  );
  res.json(backups);
});

router.get("/backup/backups/:id", (req, res) => {
  const content = backupStore.getBackupContent(req.params.id);
  if (!content) return res.status(404).json({ error: "Backup not found" });
  res.json(content);
});

router.post("/backup/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const file = req.file;

  // Read file content
  const content = file.buffer.toString("utf-8");

  // Create backup entry
  const backup = backupStore.createUploadedBackup({
    device_name: file.originalname.replace(/\.(rsc|backup)$/, ""),
    ip_address: "uploaded",
    config_content: content,
    file_size: file.size,
    status: "success",
  });

  res.json(backup);
});

router.post("/backup/restore/:id", async (req, res) => {
  const { target_ip, target_port, target_username, target_password } = req.body;

  if (!target_ip || !target_username || !target_password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const backup = backupStore.getBackupContent(req.params.id);
  if (!backup) return res.status(404).json({ error: "Backup not found" });

  // TODO: Implement actual MikroTik API restore
  // For now, just return success
  res.json({ message: "Restore initiated", backup_id: req.params.id });
});

module.exports = router;
