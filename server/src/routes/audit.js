/**
 * Audit Log API Routes
 * Reads from BOTH audit_logs (auth/system events) and billing_audit_logs
 * (billing events) and merges them into a single sorted stream.
 */

const express = require("express");
const { getDb } = require("../db");
const router = express.Router();



// GET /api/audit/logs?action=&entity_type=&user_id=&search=&limit=50&offset=0
router.get("/logs", async (req, res) => {
  try {
    if (!global.dbAvailable) {
      return res.json({ logs: [], total: 0 });
    }

    const {
      action,
      entity_type,
      user_id,
      search,
      limit = 50,
      offset = 0,
    } = req.query;

    const db = getDb();
    const limitInt  = Math.min(parseInt(limit)  || 50, 500);
    const offsetInt = parseInt(offset) || 0;

    // ── Build shared filter fragments ────────────────────────────────────────
    // We'll build parameterised conditions for each sub-query separately
    // because the two tables have slightly different column names.

    // Helper: build WHERE conditions + params array for one table
    const buildConditions = (tableAlias, startIdx) => {
      const conds  = [];
      const params = [];
      let   idx    = startIdx;

      if (action) {
        conds.push(`${tableAlias}.action = $${idx++}`);
        params.push(action);
      }
      if (entity_type) {
        conds.push(`${tableAlias}.entity_type = $${idx++}`);
        params.push(entity_type);
      }
      if (user_id) {
        conds.push(`${tableAlias}.user_id = $${idx++}`);
        params.push(user_id);
      }
      if (search) {
        conds.push(
          `(${tableAlias}.action ILIKE $${idx} OR ${tableAlias}.entity_type ILIKE $${idx})`,
        );
        params.push(`%${search}%`);
        idx++;
      }
      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      return { where, params, nextIdx: idx };
    };

    // ── Check which tables exist ─────────────────────────────────────────────
    const tableCheck = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('audit_logs', 'billing_audit_logs')
    `);
    const existingTables = new Set(tableCheck.rows.map((r) => r.table_name));

    const unionParts  = [];
    const countParts  = [];
    const allParams   = [];
    let   paramOffset = 1;

    // ── Part 1: audit_logs (auth / system events) ────────────────────────────
    if (existingTables.has("audit_logs")) {
      const { where, params, nextIdx } = buildConditions("al", paramOffset);
      const searchWhere = search
        ? where
            ? `${where} AND (al.action ILIKE $${nextIdx - 1} OR al.entity_type ILIKE $${nextIdx - 1} OR COALESCE(al.user_name,'') ILIKE $${nextIdx - 1})`
            : `WHERE (al.action ILIKE $${paramOffset} OR al.entity_type ILIKE $${paramOffset} OR COALESCE(al.user_name,'') ILIKE $${paramOffset})`
        : where;

      unionParts.push(`
        SELECT
          al.id,
          al.user_id,
          al.action,
          al.entity_type,
          al.entity_id,
          al.before_data,
          al.after_data,
          al.ip_address,
          al.user_agent,
          al.created_at,
          COALESCE(al.user_name, 'System') AS user_name,
          al.user_role
        FROM audit_logs al
        ${where}
      `);
      countParts.push(`SELECT COUNT(*) FROM audit_logs al ${where}`);
      allParams.push(...params);
      paramOffset = nextIdx;
    }

    // ── Part 2: billing_audit_logs (billing events) ──────────────────────────
    if (existingTables.has("billing_audit_logs")) {
      const { where, params, nextIdx } = buildConditions("al", paramOffset);

      unionParts.push(`
        SELECT
          al.id,
          al.user_id,
          al.action,
          al.entity_type,
          al.entity_id,
          al.old_values  AS before_data,
          al.new_values  AS after_data,
          al.ip_address,
          al.user_agent,
          al.created_at,
          COALESCE(u.name, 'System') AS user_name,
          u.role AS user_role
        FROM billing_audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${where}
      `);
      countParts.push(`SELECT COUNT(*) FROM billing_audit_logs al ${where}`);
      allParams.push(...params);
      paramOffset = nextIdx;
    }

    if (unionParts.length === 0) {
      return res.json({ logs: [], total: 0 });
    }

    // ── Execute union query ──────────────────────────────────────────────────
    const limitParam  = paramOffset++;
    const offsetParam = paramOffset++;
    const dataParams  = [...allParams, limitInt, offsetInt];

    const dataQuery = `
      SELECT * FROM (
        ${unionParts.join(" UNION ALL ")}
      ) combined
      ORDER BY created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const countQuery = `
      SELECT (${countParts.map((q) => `(${q})`).join(" + ")}) AS total
    `;

    const [result, countResult] = await Promise.all([
      db.query(dataQuery, dataParams),
      db.query(countQuery, allParams),
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0);
    console.log("[AUDIT API] Returning", result.rows.length, "logs, total:", total);

    res.json({ logs: result.rows, total });
  } catch (error) {
    console.error("Audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs", detail: error.message });
  }
});

// DELETE /api/audit/logs/:id  — tries both tables
router.delete("/logs/:id", async (req, res) => {
  try {
    if (!global.dbAvailable) { return res.json({ success: true }); }
    const db = getDb();
    await db.query("DELETE FROM billing_audit_logs WHERE id = $1", [req.params.id]).catch(() => {});
    await db.query("DELETE FROM audit_logs WHERE id = $1",         [req.params.id]).catch(() => {});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
