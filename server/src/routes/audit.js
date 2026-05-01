/**
 * Audit Log API Routes
 */

const express = require("express");
const router = express.Router();

function getDb() {
  return global.db;
}

// GET /api/audit/logs?action=&entity_type=&user_id=&search=&limit=100&offset=0
router.get("/logs", async (req, res) => {
  try {
    const {
      action,
      entity_type,
      user_id,
      search,
      limit = 100,
      offset = 0,
    } = req.query;

    if (!global.dbAvailable) {
      return res.json({ logs: [], total: 0 });
    }

    const db = getDb();
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (action) {
      conditions.push(`action = $${paramIdx++}`);
      params.push(action);
    }
    if (entity_type) {
      conditions.push(`entity_type = $${paramIdx++}`);
      params.push(entity_type);
    }
    if (user_id) {
      conditions.push(`user_id = $${paramIdx++}`);
      params.push(user_id);
    }
    if (search) {
      conditions.push(
        `(action ILIKE $${paramIdx} OR entity_type ILIKE $${paramIdx})`,
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT id, user_id, action, entity_type, entity_id,
             old_values as before_data, new_values as after_data,
             ip_address, user_agent, created_at
      FROM billing_audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    params.push(parseInt(limit), parseInt(offset));
    const result = await db.query(query, params);

    const countQuery = `SELECT COUNT(*) as total FROM billing_audit_logs ${whereClause}`;
    console.log("[AUDIT API] Returning", result.rows.length, "logs, total:", countResult.rows[0]?.total);
    const countResult = await db.query(countQuery, params.slice(0, -2));

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0),
    });
  } catch (error) {
    console.error("Audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// DELETE /api/audit/logs/:id
router.delete("/logs/:id", async (req, res) => {
  try {
    if (!global.dbAvailable) return res.json({ success: true });
    await getDb().query("DELETE FROM billing_audit_logs WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
