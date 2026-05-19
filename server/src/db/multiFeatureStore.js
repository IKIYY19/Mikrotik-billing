/**
 * Multi-Feature Store: Branches, Agents, Vouchers, Monitoring, Grace Periods
 * Unified store: PostgreSQL when available, in-memory fallback.
 * Extends billingStore with production-ready features
 */

const { v4: uuidv4 } = require("uuid");

// ─── Helpers ───
function getDb() {
  return global.dbAvailable ? global.db : null;
}

function pgNow() {
  return new Date().toISOString();
}

// ─── In-memory fallback store ───
const _branches = [
  {
    id: "branch-nairobi-main",
    name: "Nairobi Main POP",
    city: "Nairobi",
    address: "Moi Avenue",
    contact: "+254700000001",
    status: "active",
    lat: -1.2921,
    lng: 36.8219,
    created_at: new Date().toISOString(),
  },
  {
    id: "branch-mombasa",
    name: "Mombasa POP",
    city: "Mombasa",
    address: "Moi Road",
    contact: "+254700000002",
    status: "active",
    lat: -4.0435,
    lng: 39.6682,
    created_at: new Date().toISOString(),
  },
  {
    id: "branch-kisumu",
    name: "Kisumu POP",
    city: "Kisumu",
    address: "Oginga Odinga St",
    contact: "+254700000003",
    status: "active",
    lat: -0.0917,
    lng: 34.7679,
    created_at: new Date().toISOString(),
  },
];

const _agents = [];

const _graceConfig = {
  warn_days: 7, // Send warning SMS
  throttle_days: 14, // Throttle speed
  suspend_days: 30, // Full suspension
  throttle_speed_up: "1M",
  throttle_speed_down: "1M",
};

// ─── Ephemeral in-memory-only data ───
const vouchers = [];
const deviceMetrics = [];
const pppoeSessions = [];

// ─── Default seed data ───
const DEFAULT_BRANCHES = [
  {
    id: "branch-nairobi-main",
    name: "Nairobi Main POP",
    city: "Nairobi",
    address: "Moi Avenue",
    contact: "+254700000001",
    status: "active",
    lat: -1.2921,
    lng: 36.8219,
  },
  {
    id: "branch-mombasa",
    name: "Mombasa POP",
    city: "Mombasa",
    address: "Moi Road",
    contact: "+254700000002",
    status: "active",
    lat: -4.0435,
    lng: 39.6682,
  },
  {
    id: "branch-kisumu",
    name: "Kisumu POP",
    city: "Kisumu",
    address: "Oginga Odinga St",
    contact: "+254700000003",
    status: "active",
    lat: -0.0917,
    lng: 34.7679,
  },
];

const DEFAULT_AGENTS = [
  {
    id: "agent-001",
    name: "James Ochieng",
    phone: "+254711111111",
    email: "james@agent.co.ke",
    branch_id: "branch-nairobi-main",
    commission_rate: 10,
    balance: 5000,
    status: "active",
  },
  {
    id: "agent-002",
    name: "Amina Hassan",
    phone: "+254722222222",
    email: "amina@agent.co.ke",
    branch_id: "branch-mombasa",
    commission_rate: 12,
    balance: 3500,
    status: "active",
  },
  {
    id: "agent-003",
    name: "Peter Kamau",
    phone: "+254733333333",
    email: "peter@agent.co.ke",
    branch_id: "branch-kisumu",
    commission_rate: 10,
    balance: 2000,
    status: "active",
  },
];

const DEFAULT_GRACE_CONFIG = {
  warn_days: 7,
  throttle_days: 14,
  suspend_days: 30,
  throttle_speed_up: "1M",
  throttle_speed_down: "1M",
};

// ─── Seed PG defaults ───
let pgSeeded = false;
async function seedPgDefaults(db) {
  if (pgSeeded) {return;}
  try {
    // Seed branches
    const branchResult = await db.query("SELECT COUNT(*) as c FROM branches");
    if (parseInt(branchResult.rows[0].c) === 0) {
      for (const b of DEFAULT_BRANCHES) {
        await db.query(
          `INSERT INTO branches (id, name, city, address, contact, status, lat, lng)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [b.id, b.name, b.city, b.address, b.contact, b.status, b.lat, b.lng],
        );
      }
    }

    // Seed agents
    const agentResult = await db.query("SELECT COUNT(*) as c FROM agents");
    if (parseInt(agentResult.rows[0].c) === 0) {
      for (const a of DEFAULT_AGENTS) {
        await db.query(
          `INSERT INTO agents (id, name, phone, email, branch_id, commission_rate, balance, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [
            a.id,
            a.name,
            a.phone,
            a.email,
            a.branch_id,
            a.commission_rate,
            a.balance,
            a.status,
          ],
        );
      }
    }

    // Seed grace config
    const graceResult = await db.query(
      "SELECT COUNT(*) as c FROM grace_period_config",
    );
    if (parseInt(graceResult.rows[0].c) === 0) {
      await db.query(
        `INSERT INTO grace_period_config (warn_days, throttle_days, suspend_days, throttle_speed_up, throttle_speed_down)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          DEFAULT_GRACE_CONFIG.warn_days,
          DEFAULT_GRACE_CONFIG.throttle_days,
          DEFAULT_GRACE_CONFIG.suspend_days,
          DEFAULT_GRACE_CONFIG.throttle_speed_up,
          DEFAULT_GRACE_CONFIG.throttle_speed_down,
        ],
      );
    }

    pgSeeded = true;
  } catch (e) {
    console.error("MultiFeature PG seed error (non-fatal):", e.message);
  }
}

// ─── Branches ───
async function getBranches() {
  const db = getDb();
  if (db) {
    await seedPgDefaults(db);
    const result = await db.query("SELECT * FROM branches ORDER BY name");
    return result.rows;
  }
  return [..._branches];
}

async function createBranch(data) {
  const db = getDb();
  if (db) {
    await seedPgDefaults(db);
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO branches (id, name, city, address, contact, status, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        id,
        data.name,
        data.city || null,
        data.address || null,
        data.contact || null,
        data.status || "active",
        data.lat || null,
        data.lng || null,
      ],
    );
    return result.rows[0];
  }
  const branch = {
    id: uuidv4(),
    ...data,
    created_at: pgNow(),
    status: data.status || "active",
  };
  _branches.push(branch);
  return branch;
}

async function updateBranch(id, data) {
  const db = getDb();
  if (db) {
    const existing = await db.query("SELECT * FROM branches WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {return null;}
    const merged = { ...existing.rows[0], ...data, updated_at: pgNow() };
    const result = await db.query(
      `UPDATE branches SET name=$1, city=$2, address=$3, contact=$4, status=$5, lat=$6, lng=$7, updated_at=$8
       WHERE id=$9 RETURNING *`,
      [
        merged.name,
        merged.city,
        merged.address,
        merged.contact,
        merged.status,
        merged.lat,
        merged.lng,
        merged.updated_at,
        id,
      ],
    );
    return result.rows[0];
  }
  const idx = _branches.findIndex((b) => b.id === id);
  if (idx === -1) {return null;}
  _branches[idx] = { ..._branches[idx], ...data, updated_at: pgNow() };
  return _branches[idx];
}

// ─── Agents ───
async function getAgents() {
  const db = getDb();
  if (db) {
    await seedPgDefaults(db);
    const result = await db.query("SELECT * FROM agents ORDER BY name");
    return result.rows;
  }
  return [..._agents];
}

async function createAgent(data) {
  const db = getDb();
  if (db) {
    await seedPgDefaults(db);
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO agents (id, name, phone, email, branch_id, commission_rate, balance, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        id,
        data.name,
        data.phone || null,
        data.email || null,
        data.branch_id || null,
        parseFloat(data.commission_rate) || 10,
        parseFloat(data.balance) || 0,
        data.status || "active",
      ],
    );
    return result.rows[0];
  }
  const agent = {
    id: uuidv4(),
    ...data,
    balance: parseFloat(data.balance) || 0,
    status: data.status || "active",
    created_at: pgNow(),
  };
  _agents.push(agent);
  return agent;
}

async function updateAgent(id, data) {
  const db = getDb();
  if (db) {
    const existing = await db.query("SELECT * FROM agents WHERE id = $1", [id]);
    if (existing.rows.length === 0) {return null;}
    const merged = { ...existing.rows[0], ...data, updated_at: pgNow() };
    const result = await db.query(
      `UPDATE agents SET name=$1, phone=$2, email=$3, branch_id=$4, commission_rate=$5, balance=$6, status=$7, updated_at=$8
       WHERE id=$9 RETURNING *`,
      [
        merged.name,
        merged.phone,
        merged.email,
        merged.branch_id,
        merged.commission_rate,
        merged.balance,
        merged.status,
        merged.updated_at,
        id,
      ],
    );
    return result.rows[0];
  }
  const idx = _agents.findIndex((a) => a.id === id);
  if (idx === -1) {return null;}
  _agents[idx] = { ..._agents[idx], ...data, updated_at: pgNow() };
  return _agents[idx];
}

async function deleteAgent(id) {
  const db = getDb();
  if (db) {
    const result = await db.query(
      "DELETE FROM agents WHERE id = $1 RETURNING *",
      [id],
    );
    return result.rows[0] || null;
  }
  const idx = _agents.findIndex((a) => a.id === id);
  if (idx === -1) {return null;}
  return _agents.splice(idx, 1)[0];
}

// ─── Grace Period Config ───
async function getGraceConfig() {
  const db = getDb();
  if (db) {
    await seedPgDefaults(db);
    const result = await db.query(
      "SELECT * FROM grace_period_config ORDER BY id LIMIT 1",
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        warn_days: row.warn_days,
        throttle_days: row.throttle_days,
        suspend_days: row.suspend_days,
        throttle_speed_up: row.throttle_speed_up,
        throttle_speed_down: row.throttle_speed_down,
      };
    }
  }
  return { ..._graceConfig };
}

async function updateGraceConfig(data) {
  const db = getDb();
  if (db) {
    const current = await db.query(
      "SELECT id FROM grace_period_config ORDER BY id LIMIT 1",
    );
    const merged = { ...DEFAULT_GRACE_CONFIG, ...data };
    if (current.rows.length > 0) {
      const result = await db.query(
        `UPDATE grace_period_config SET warn_days=$1, throttle_days=$2, suspend_days=$3,
         throttle_speed_up=$4, throttle_speed_down=$5, updated_at=$6
         WHERE id=$7 RETURNING *`,
        [
          merged.warn_days,
          merged.throttle_days,
          merged.suspend_days,
          merged.throttle_speed_up,
          merged.throttle_speed_down,
          pgNow(),
          current.rows[0].id,
        ],
      );
      const row = result.rows[0];
      return {
        warn_days: row.warn_days,
        throttle_days: row.throttle_days,
        suspend_days: row.suspend_days,
        throttle_speed_up: row.throttle_speed_up,
        throttle_speed_down: row.throttle_speed_down,
      };
    }
    // No row exists yet, insert one
    const result = await db.query(
      `INSERT INTO grace_period_config (warn_days, throttle_days, suspend_days, throttle_speed_up, throttle_speed_down)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        merged.warn_days,
        merged.throttle_days,
        merged.suspend_days,
        merged.throttle_speed_up,
        merged.throttle_speed_down,
      ],
    );
    const row = result.rows[0];
    return {
      warn_days: row.warn_days,
      throttle_days: row.throttle_days,
      suspend_days: row.suspend_days,
      throttle_speed_up: row.throttle_speed_up,
      throttle_speed_down: row.throttle_speed_down,
    };
  }
  Object.assign(_graceConfig, data);
  return { ..._graceConfig };
}

// ─── Seed sample vouchers ───
const seedVouchers = () => {
  if (vouchers.length > 0) {return;}
  const codes = [
    "VCH-A1B2C3",
    "VCH-D4E5F6",
    "VCH-G7H8I9",
    "VCH-J0K1L2",
    "VCH-M3N4O5",
  ];
  codes.forEach((code, i) => {
    vouchers.push({
      id: `voucher-${i + 1}`,
      code,
      plan_name: [
        "Bronze 5M",
        "Silver 10M",
        "Gold 25M",
        "Silver 10M",
        "Bronze 5M",
      ][i],
      duration_days: 30,
      price: [15, 25, 45, 25, 15][i],
      sold_by: ["agent-001", "agent-002", "agent-001", null, null][i],
      sold_to: ["", "", "John Kamau", "", ""][i],
      status: i < 2 ? "sold" : i < 3 ? "redeemed" : "available",
      redeemed_at: i === 2 ? "2026-04-01T10:00:00Z" : null,
      created_at: new Date().toISOString(),
    });
  });
};
seedVouchers();

// ─── Seed network metrics ───
const seedMetrics = () => {
  if (deviceMetrics.length > 0) {return;}
  const now = Date.now();
  _branches.forEach((branch) => {
    for (let i = 0; i < 24; i++) {
      deviceMetrics.push({
        id: uuidv4(),
        branch_id: branch.id,
        timestamp: new Date(now - (23 - i) * 3600000).toISOString(),
        active_pppoe: Math.floor(Math.random() * 50) + 10,
        bandwidth_in_mbps: Math.floor(Math.random() * 200) + 50,
        bandwidth_out_mbps: Math.floor(Math.random() * 400) + 100,
        cpu_usage: Math.floor(Math.random() * 40) + 20,
        memory_usage: Math.floor(Math.random() * 30) + 50,
        online_routers: Math.floor(Math.random() * 3) + 1,
        total_routers: 3,
      });
    }
  });
};
seedMetrics();

// ─── Seed PPPoE sessions ───
const seedPPPoE = () => {
  if (pppoeSessions.length > 0) {return;}
  const subs = require("./billingStore").store.subscriptions || [];
  subs
    .filter((s) => s.pppoe_username && s.status === "active")
    .forEach((sub) => {
      pppoeSessions.push({
        id: uuidv4(),
        username: sub.pppoe_username,
        customer_name: sub.customer?.name || "Unknown",
        ip_address: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        bytes_in: Math.floor(Math.random() * 5000000000),
        bytes_out: Math.floor(Math.random() * 10000000000),
        uptime_seconds: Math.floor(Math.random() * 86400 * 7),
        connected_at: new Date(
          Date.now() - Math.random() * 86400000,
        ).toISOString(),
      });
    });
  // Add some fake sessions if none exist
  if (pppoeSessions.length === 0) {
    ["kamau01", "jane02", "alice03", "bob04"].forEach((user, i) => {
      pppoeSessions.push({
        id: uuidv4(),
        username: user,
        customer_name: `Customer ${i + 1}`,
        ip_address: `10.10.${i + 1}.${Math.floor(Math.random() * 254) + 1}`,
        bytes_in: Math.floor(Math.random() * 5000000000),
        bytes_out: Math.floor(Math.random() * 10000000000),
        uptime_seconds: Math.floor(Math.random() * 86400 * 7),
        connected_at: new Date(
          Date.now() - Math.random() * 86400000,
        ).toISOString(),
      });
    });
  }
};
seedPPPoE();

module.exports = {
  getBranches,
  getAgents,
  getGraceConfig,
  createAgent,
  updateAgent,
  deleteAgent,
  createBranch,
  updateBranch,
  updateGraceConfig,
  // Ephemeral in-memory-only exports
  vouchers,
  deviceMetrics,
  pppoeSessions,
};
