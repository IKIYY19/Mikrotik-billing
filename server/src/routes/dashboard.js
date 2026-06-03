/**
 * Dashboard Stats API
 * Returns real-time statistics for the main dashboard
 * Cached for 10 seconds to eliminate repeated DB round-trips
 */

const express = require("express");
const { getDb } = require("../db");
const router = express.Router();

// Simple in-memory cache with TTL
const cache = { stats: null, ts: 0 };
const CACHE_TTL = 10000; // 10 seconds



// ─── GET DASHBOARD STATS ───
router.get("/stats", async (req, res) => {
  // Return cached data if fresh
  if (cache.stats && Date.now() - cache.ts < CACHE_TTL) {
    return res.json({
      success: true,
      timestamp: cache.stats.timestamp,
      stats: cache.stats,
      cached: true,
    });
  }

  try {
    const db = getDb();
    const stats = {};

    // Run ALL independent queries in parallel
    const [
      projectsResult,
      templatesResult,
      customersResult,
      usersResult,
      activeResult,
      suspendedResult,
      revenueResult,
      pendingResult,
      mikrotikResult,
      recentProjectsResult,
      recentCustomersResult,
      todayResult,
      todayCountResult,
      monthResult,
      lastMonthResult,
      outstandingResult,
      overdueResult,
      activeSubsResult,
      topPlansResult,
      revenueByDayResult,
      radacctResult,
      recentPaymentsResult,
    ] = await Promise.allSettled([
      db.query("SELECT COUNT(*) FROM projects"),
      db.query("SELECT COUNT(*) FROM templates"),
      db.query("SELECT COUNT(*) FROM customers"),
      db.query("SELECT COUNT(*) FROM users"),
      db.query("SELECT COUNT(*) FROM customers WHERE status = 'active'"),
      db.query("SELECT COUNT(*) FROM customers WHERE status = 'suspended'"),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid'",
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'pending'",
      ),
      db.query("SELECT COUNT(*) FROM mikrotik_connections"),
      db.query(
        "SELECT COUNT(*) FROM projects WHERE created_at >= NOW() - INTERVAL '7 days'",
      ),
      db.query(
        "SELECT COUNT(*) FROM customers WHERE created_at >= NOW() - INTERVAL '7 days'",
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(received_at) = CURRENT_DATE",
      ),
      db.query(
        "SELECT COUNT(*) as count FROM payments WHERE DATE(received_at) = CURRENT_DATE",
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE EXTRACT(MONTH FROM received_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM received_at) = EXTRACT(YEAR FROM CURRENT_DATE)",
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE EXTRACT(MONTH FROM received_at) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM received_at) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')",
      ),
      db.query(
        "SELECT COALESCE(SUM(total - COALESCE(paid_amount, 0)), 0) as total FROM invoices WHERE status IN ('pending', 'partial', 'overdue')",
      ),
      db.query(
        "SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue' OR (status = 'pending' AND due_date < CURRENT_DATE)",
      ),
      db.query(
        "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'",
      ),
      db.query(
        "SELECT p.name, p.price, COUNT(s.id) as customer_count FROM service_plans p LEFT JOIN subscriptions s ON p.id = s.plan_id AND s.status = 'active' GROUP BY p.id, p.name, p.price ORDER BY customer_count DESC LIMIT 5",
      ),
      db.query(
        "SELECT DATE(created_at) as date, SUM(amount) as total FROM invoices WHERE status = 'paid' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY DATE(created_at) ORDER BY date DESC",
      ),
      db.query("SELECT COUNT(*) FROM radacct WHERE acctstoptime IS NULL"),
      db.query(
        "SELECT p.id, p.amount, p.method, p.received_at, c.name as customer_name FROM payments p LEFT JOIN customers c ON c.id = p.customer_id ORDER BY p.received_at DESC LIMIT 5"
      ),
    ]);

    const val = (result, field = "count", fallback = 0) => {
      if (result.status === "fulfilled" && result.value?.rows?.[0]) {
        return field === "total"
          ? parseFloat(result.value.rows[0].total) || fallback
          : parseInt(result.value.rows[0][field]) || fallback;
      }
      return fallback;
    };

    stats.totalProjects = val(projectsResult);
    stats.totalTemplates = val(templatesResult);
    stats.totalCustomers = val(customersResult);
    stats.totalUsers = val(usersResult);
    stats.activeCustomers = val(activeResult);
    stats.suspendedCustomers = val(suspendedResult);
    stats.totalRevenue = val(revenueResult, "total");
    stats.pendingRevenue = val(pendingResult, "total");
    stats.activeDevices = val(mikrotikResult);
    stats.recentProjects = val(recentProjectsResult);
    stats.recentCustomers = val(recentCustomersResult);
    stats.todayRevenue = val(todayResult, "total");
    stats.todayPayments = val(todayCountResult);
    stats.monthRevenue = val(monthResult, "total");
    stats.lastMonthRevenue = val(lastMonthResult, "total");

    stats.revenueChange =
      stats.lastMonthRevenue > 0
        ? parseFloat(
            (
              ((stats.monthRevenue - stats.lastMonthRevenue) /
                stats.lastMonthRevenue) *
              100
            ).toFixed(1),
          )
        : stats.monthRevenue > 0
          ? 100
          : 0;

    stats.outstandingBalance = val(outstandingResult, "total");
    stats.overdueInvoices = val(overdueResult);
    stats.activeSubscriptions = val(activeSubsResult);
    stats.topPlans =
      topPlansResult.status === "fulfilled" ? topPlansResult.value.rows : [];
    stats.revenueByDay =
      revenueByDayResult.status === "fulfilled"
        ? revenueByDayResult.value.rows
        : [];
    stats.activeRadiusSessions = val(radacctResult);
    stats.recentPayments =
      recentPaymentsResult.status === "fulfilled"
        ? recentPaymentsResult.value.rows
        : [];
    stats.timestamp = new Date().toISOString();

    // Cache for 10 seconds
    cache.stats = stats;
    cache.ts = Date.now();

    res.json({
      success: true,
      timestamp: stats.timestamp,
      stats,
      cached: false,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    // Return stale cache if available
    if (cache.stats) {
      return res.json({
        success: true,
        timestamp: cache.stats.timestamp,
        stats: cache.stats,
        cached: true,
        stale: true,
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET QUICK ACTIONS ───
router.get("/quick-actions", async (req, res) => {
  const user = req.user;
  const actions = [
    {
      id: "new-customer",
      label: "Add Customer",
      icon: "UserPlus",
      route: "/billing-customers?action=add",
      color: "emerald",
    },
    {
      id: "send-sms",
      label: "Send SMS",
      icon: "MessageSquare",
      route: "/billing-messaging",
      color: "blue",
    },
    {
      id: "record-payment",
      label: "Record Payment",
      icon: "CreditCard",
      route: "/billing-payments",
      color: "amber",
    },
    {
      id: "reconcile",
      label: "Reconcile Routers",
      icon: "Link",
      route: "/billing-reconcile",
      color: "violet",
    },
  ];

  res.json({ success: true, actions });
});

module.exports = router;
