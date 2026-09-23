/**
 * Promo Campaigns & Referral Engine Store
 * PostgreSQL when available, in-memory fallback.
 */

const { v4: uuidv4 } = require("uuid");

const promoStore = {
  campaigns: [],
  redemptions: [],
  programs: [],
  referral_codes: [],
  referrals: [],
};

function getDb() {
  return global.dbAvailable ? global.db : null;
}

function genCode(prefix = "PROMO") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${code}`;
}

// ─── Promo Campaigns ───

async function createCampaign(data) {
  const db = getDb();
  const code = (data.code || genCode()).toUpperCase();

  if (db) {
    const result = await db.query(
      `INSERT INTO promo_campaigns
        (name, code, description, type, value, max_uses, max_uses_per_customer, min_invoice_amount, applies_to, plan_id, starts_at, ends_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        data.name,
        code,
        data.description || null,
        data.type || "percentage",
        parseFloat(data.value) || 0,
        data.max_uses ? parseInt(data.max_uses) : null,
        parseInt(data.max_uses_per_customer) || 1,
        data.min_invoice_amount ? parseFloat(data.min_invoice_amount) : null,
        data.applies_to || "all",
        data.plan_id || null,
        data.starts_at || new Date().toISOString(),
        data.ends_at || null,
        data.status || "active",
      ],
    );
    return result.rows[0];
  }

  const campaign = {
    id: uuidv4(),
    name: data.name,
    code,
    description: data.description || null,
    type: data.type || "percentage",
    value: parseFloat(data.value) || 0,
    max_uses: data.max_uses ? parseInt(data.max_uses) : null,
    max_uses_per_customer: parseInt(data.max_uses_per_customer) || 1,
    used_count: 0,
    min_invoice_amount: data.min_invoice_amount ? parseFloat(data.min_invoice_amount) : null,
    applies_to: data.applies_to || "all",
    plan_id: data.plan_id || null,
    starts_at: data.starts_at || new Date().toISOString(),
    ends_at: data.ends_at || null,
    status: data.status || "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  promoStore.campaigns.push(campaign);
  return campaign;
}

async function getCampaigns() {
  const db = getDb();
  if (db) {
    const result = await db.query("SELECT * FROM promo_campaigns ORDER BY created_at DESC");
    return result.rows;
  }
  return [...promoStore.campaigns].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function getCampaignById(id) {
  const db = getDb();
  if (db) {
    const result = await db.query("SELECT * FROM promo_campaigns WHERE id = $1", [id]);
    return result.rows[0] || null;
  }
  return promoStore.campaigns.find((c) => c.id === id) || null;
}

async function updateCampaign(id, updates) {
  const db = getDb();
  if (db) {
    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = ["name", "description", "type", "value", "max_uses", "max_uses_per_customer", "min_invoice_amount", "applies_to", "plan_id", "starts_at", "ends_at", "status"];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(updates[key]);
      }
    }
    if (fields.length === 0) return getCampaignById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await db.query(
      `UPDATE promo_campaigns SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return result.rows[0] || null;
  }

  const campaign = promoStore.campaigns.find((c) => c.id === id);
  if (!campaign) return null;
  const allowed = ["name", "description", "type", "value", "max_uses", "max_uses_per_customer", "min_invoice_amount", "applies_to", "plan_id", "starts_at", "ends_at", "status"];
  for (const key of allowed) {
    if (updates[key] !== undefined) campaign[key] = updates[key];
  }
  campaign.updated_at = new Date().toISOString();
  return campaign;
}

async function deleteCampaign(id) {
  const db = getDb();
  if (db) {
    await db.query("DELETE FROM promo_campaigns WHERE id = $1", [id]);
    return true;
  }
  const idx = promoStore.campaigns.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  promoStore.campaigns.splice(idx, 1);
  promoStore.redemptions = promoStore.redemptions.filter((r) => r.promo_id !== id);
  return true;
}

// Validate a promo code and return the discount info
async function validatePromo(code, customerId, invoiceAmount) {
  const db = getDb();
  let campaign;
  if (db) {
    const result = await db.query("SELECT * FROM promo_campaigns WHERE code = $1", [code.toUpperCase()]);
    campaign = result.rows[0];
  } else {
    campaign = promoStore.campaigns.find((c) => c.code === code.toUpperCase());
  }

  if (!campaign) return { valid: false, error: "Promo code not found" };
  if (campaign.status !== "active") return { valid: false, error: "Promo campaign is not active" };

  const now = new Date();
  if (new Date(campaign.starts_at) > now) return { valid: false, error: "Promo campaign has not started yet" };
  if (campaign.ends_at && new Date(campaign.ends_at) < now) return { valid: false, error: "Promo campaign has expired" };

  if (campaign.max_uses && campaign.used_count >= campaign.max_uses) {
    return { valid: false, error: "Promo code has reached maximum uses" };
  }

  if (campaign.min_invoice_amount && invoiceAmount && parseFloat(invoiceAmount) < parseFloat(campaign.min_invoice_amount)) {
    return { valid: false, error: `Minimum invoice amount is ${campaign.min_invoice_amount}` };
  }

  // Check per-customer usage limit
  if (customerId) {
    let redemptionCount;
    if (db) {
      const result = await db.query(
        "SELECT COUNT(*)::int as count FROM promo_redemptions WHERE promo_id = $1 AND customer_id = $2",
        [campaign.id, customerId],
      );
      redemptionCount = result.rows[0].count;
    } else {
      redemptionCount = promoStore.redemptions.filter(
        (r) => r.promo_id === campaign.id && r.customer_id === customerId,
      ).length;
    }
    if (redemptionCount >= campaign.max_uses_per_customer) {
      return { valid: false, error: "You have already used this promo code the maximum number of times" };
    }
  }

  let discountAmount = 0;
  if (campaign.type === "percentage") {
    discountAmount = (parseFloat(invoiceAmount || 0) * parseFloat(campaign.value)) / 100;
  } else {
    discountAmount = parseFloat(campaign.value);
  }

  return { valid: true, campaign, discountAmount };
}

// Redeem a promo code (records the redemption and increments used_count)
async function redeemPromo(code, customerId, invoiceId, invoiceAmount) {
  const validation = await validatePromo(code, customerId, invoiceAmount);
  if (!validation.valid) return validation;

  const { campaign, discountAmount } = validation;
  const db = getDb();

  if (db) {
    const result = await db.query(
      `INSERT INTO promo_redemptions (promo_id, customer_id, invoice_id, discount_amount)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [campaign.id, customerId || null, invoiceId || null, discountAmount],
    );
    await db.query(
      "UPDATE promo_campaigns SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1",
      [campaign.id],
    );
    return { valid: true, redemption: result.rows[0], discountAmount };
  }

  const redemption = {
    id: uuidv4(),
    promo_id: campaign.id,
    customer_id: customerId || null,
    invoice_id: invoiceId || null,
    discount_amount: discountAmount,
    redeemed_at: new Date().toISOString(),
  };
  promoStore.redemptions.push(redemption);
  campaign.used_count = (campaign.used_count || 0) + 1;
  return { valid: true, redemption, discountAmount };
}

async function getRedemptions(promoId) {
  const db = getDb();
  if (db) {
    if (promoId) {
      const result = await db.query(
        "SELECT * FROM promo_redemptions WHERE promo_id = $1 ORDER BY redeemed_at DESC",
        [promoId],
      );
      return result.rows;
    }
    const result = await db.query("SELECT * FROM promo_redemptions ORDER BY redeemed_at DESC LIMIT 100");
    return result.rows;
  }
  const filtered = promoId
    ? promoStore.redemptions.filter((r) => r.promo_id === promoId)
    : promoStore.redemptions;
  return [...filtered].sort((a, b) => new Date(b.redeemed_at) - new Date(a.redeemed_at));
}

// ─── Referral Programs ───

async function createProgram(data) {
  const db = getDb();
  if (db) {
    const result = await db.query(
      `INSERT INTO referral_programs
        (name, description, referrer_reward_type, referrer_reward_value, referee_reward_type, referee_reward_value, referee_qualification, qualification_amount, max_referrals_per_referrer, status, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.referrer_reward_type || "wallet_credit",
        parseFloat(data.referrer_reward_value) || 0,
        data.referee_reward_type || "wallet_credit",
        parseFloat(data.referee_reward_value) || 0,
        data.referee_qualification || "first_payment",
        data.qualification_amount ? parseFloat(data.qualification_amount) : null,
        data.max_referrals_per_referrer ? parseInt(data.max_referrals_per_referrer) : null,
        data.status || "active",
        data.starts_at || new Date().toISOString(),
        data.ends_at || null,
      ],
    );
    return result.rows[0];
  }

  const program = {
    id: uuidv4(),
    name: data.name,
    description: data.description || null,
    referrer_reward_type: data.referrer_reward_type || "wallet_credit",
    referrer_reward_value: parseFloat(data.referrer_reward_value) || 0,
    referee_reward_type: data.referee_reward_type || "wallet_credit",
    referee_reward_value: parseFloat(data.referee_reward_value) || 0,
    referee_qualification: data.referee_qualification || "first_payment",
    qualification_amount: data.qualification_amount ? parseFloat(data.qualification_amount) : null,
    max_referrals_per_referrer: data.max_referrals_per_referrer ? parseInt(data.max_referrals_per_referrer) : null,
    status: data.status || "active",
    starts_at: data.starts_at || new Date().toISOString(),
    ends_at: data.ends_at || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  promoStore.programs.push(program);
  return program;
}

async function getPrograms() {
  const db = getDb();
  if (db) {
    const result = await db.query("SELECT * FROM referral_programs ORDER BY created_at DESC");
    return result.rows;
  }
  return [...promoStore.programs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function getProgramById(id) {
  const db = getDb();
  if (db) {
    const result = await db.query("SELECT * FROM referral_programs WHERE id = $1", [id]);
    return result.rows[0] || null;
  }
  return promoStore.programs.find((p) => p.id === id) || null;
}

async function updateProgram(id, updates) {
  const db = getDb();
  if (db) {
    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = [
      "name", "description", "referrer_reward_type", "referrer_reward_value",
      "referee_reward_type", "referee_reward_value", "referee_qualification",
      "qualification_amount", "max_referrals_per_referrer", "status", "starts_at", "ends_at",
    ];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(updates[key]);
      }
    }
    if (fields.length === 0) return getProgramById(id);
    fields.push("updated_at = NOW()");
    values.push(id);
    const result = await db.query(
      `UPDATE referral_programs SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return result.rows[0] || null;
  }

  const program = promoStore.programs.find((p) => p.id === id);
  if (!program) return null;
  const allowed = [
    "name", "description", "referrer_reward_type", "referrer_reward_value",
    "referee_reward_type", "referee_reward_value", "referee_qualification",
    "qualification_amount", "max_referrals_per_referrer", "status", "starts_at", "ends_at",
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) program[key] = updates[key];
  }
  program.updated_at = new Date().toISOString();
  return program;
}

async function deleteProgram(id) {
  const db = getDb();
  if (db) {
    await db.query("DELETE FROM referral_programs WHERE id = $1", [id]);
    return true;
  }
  const idx = promoStore.programs.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  promoStore.programs.splice(idx, 1);
  promoStore.referral_codes = promoStore.referral_codes.filter((c) => c.program_id !== id);
  promoStore.referrals = promoStore.referrals.filter((r) => r.program_id !== id);
  return true;
}

// ─── Referral Codes ───

async function getOrCreateReferralCode(programId, customerId) {
  const db = getDb();

  if (db) {
    let result = await db.query(
      "SELECT * FROM referral_codes WHERE program_id = $1 AND customer_id = $2",
      [programId, customerId],
    );
    if (result.rows[0]) return result.rows[0];

    const billing = require("./billingStore");
    const customer = billing.store.customers.find((c) => c.id === customerId);
    const namePart = customer ? customer.name.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X") : "REF";
    const code = genCode(namePart);

    result = await db.query(
      `INSERT INTO referral_codes (program_id, customer_id, code)
       VALUES ($1, $2, $3) RETURNING *`,
      [programId, customerId, code],
    );
    return result.rows[0];
  }

  let code = promoStore.referral_codes.find(
    (c) => c.program_id === programId && c.customer_id === customerId,
  );
  if (code) return code;

  const billing = require("./billingStore");
  const customer = billing.store.customers.find((c) => c.id === customerId);
  const namePart = customer ? customer.name.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X") : "REF";
  code = {
    id: uuidv4(),
    program_id: programId,
    customer_id: customerId,
    code: genCode(namePart),
    total_referrals: 0,
    qualified_referrals: 0,
    created_at: new Date().toISOString(),
  };
  promoStore.referral_codes.push(code);
  return code;
}

async function getReferralCodes(customerId) {
  const db = getDb();
  if (db) {
    if (customerId) {
      const result = await db.query(
        `SELECT rc.*, rp.name as program_name
         FROM referral_codes rc
         JOIN referral_programs rp ON rc.program_id = rp.id
         WHERE rc.customer_id = $1
         ORDER BY rc.created_at DESC`,
        [customerId],
      );
      return result.rows;
    }
    const result = await db.query(
      `SELECT rc.*, rp.name as program_name
       FROM referral_codes rc
       JOIN referral_programs rp ON rc.program_id = rp.id
       ORDER BY rc.created_at DESC`,
    );
    return result.rows;
  }
  const codes = customerId
    ? promoStore.referral_codes.filter((c) => c.customer_id === customerId)
    : promoStore.referral_codes;
  return codes.map((c) => ({
    ...c,
    program_name: promoStore.programs.find((p) => p.id === c.program_id)?.name,
  }));
}

// ─── Referrals ───

async function createReferral(programId, referrerCustomerId, refereeCustomerId, referralCodeId) {
  const db = getDb();

  // Check max referrals for referrer
  const program = await getProgramById(programId);
  if (!program) return { error: "Referral program not found" };
  if (program.status !== "active") return { error: "Referral program is not active" };

  const now = new Date();
  if (new Date(program.starts_at) > now) return { error: "Referral program has not started" };
  if (program.ends_at && new Date(program.ends_at) < now) return { error: "Referral program has ended" };

  if (program.max_referrals_per_referrer) {
    let referrerCount;
    if (db) {
      const result = await db.query(
        "SELECT COUNT(*)::int as count FROM referrals WHERE referrer_customer_id = $1 AND program_id = $2",
        [referrerCustomerId, programId],
      );
      referrerCount = result.rows[0].count;
    } else {
      referrerCount = promoStore.referrals.filter(
        (r) => r.referrer_customer_id === referrerCustomerId && r.program_id === programId,
      ).length;
    }
    if (referrerCount >= program.max_referrals_per_referrer) {
      return { error: "Maximum referrals reached for this referrer" };
    }
  }

  if (referrerCustomerId === refereeCustomerId) {
    return { error: "Cannot refer yourself" };
  }

  if (db) {
    try {
      const result = await db.query(
        `INSERT INTO referrals (program_id, referrer_customer_id, referee_customer_id, referral_code_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (referee_customer_id, program_id) DO NOTHING
         RETURNING *`,
        [programId, referrerCustomerId, refereeCustomerId, referralCodeId || null],
      );
      if (result.rows[0]) {
        await db.query(
          "UPDATE referral_codes SET total_referrals = total_referrals + 1 WHERE id = $1",
          [referralCodeId],
        );
        return result.rows[0];
      }
      return { error: "This customer has already been referred under this program" };
    } catch (err) {
      return { error: err.message };
    }
  }

  const existing = promoStore.referrals.find(
    (r) => r.referee_customer_id === refereeCustomerId && r.program_id === programId,
  );
  if (existing) return { error: "This customer has already been referred under this program" };

  const referral = {
    id: uuidv4(),
    program_id: programId,
    referrer_customer_id: referrerCustomerId,
    referee_customer_id: refereeCustomerId,
    referral_code_id: referralCodeId || null,
    status: "pending",
    referrer_rewarded: false,
    referee_rewarded: false,
    qualified_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  promoStore.referrals.push(referral);

  if (referralCodeId) {
    const code = promoStore.referral_codes.find((c) => c.id === referralCodeId);
    if (code) code.total_referrals = (code.total_referrals || 0) + 1;
  }

  return referral;
}

async function getReferrals(filters = {}) {
  const db = getDb();
  if (db) {
    let query = "SELECT * FROM referrals WHERE 1=1";
    const values = [];
    let idx = 1;
    if (filters.referrer_customer_id) {
      query += ` AND referrer_customer_id = $${idx++}`;
      values.push(filters.referrer_customer_id);
    }
    if (filters.program_id) {
      query += ` AND program_id = $${idx++}`;
      values.push(filters.program_id);
    }
    if (filters.status) {
      query += ` AND status = $${idx++}`;
      values.push(filters.status);
    }
    query += " ORDER BY created_at DESC";
    const result = await db.query(query, values);
    return result.rows;
  }

  let filtered = [...promoStore.referrals];
  if (filters.referrer_customer_id) filtered = filtered.filter((r) => r.referrer_customer_id === filters.referrer_customer_id);
  if (filters.program_id) filtered = filtered.filter((r) => r.program_id === filters.program_id);
  if (filters.status) filtered = filtered.filter((r) => r.status === filters.status);
  return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function qualifyReferral(referralId) {
  const db = getDb();
  if (db) {
    const result = await db.query(
      `UPDATE referrals
       SET status = 'qualified', qualified_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [referralId],
    );
    if (result.rows[0]) {
      await db.query(
        "UPDATE referral_codes SET qualified_referrals = qualified_referrals + 1 WHERE id = $1",
        [result.rows[0].referral_code_id],
      );
    }
    return result.rows[0] || null;
  }

  const referral = promoStore.referrals.find((r) => r.id === referralId);
  if (!referral || referral.status !== "pending") return null;
  referral.status = "qualified";
  referral.qualified_at = new Date().toISOString();
  referral.updated_at = new Date().toISOString();
  if (referral.referral_code_id) {
    const code = promoStore.referral_codes.find((c) => c.id === referral.referral_code_id);
    if (code) code.qualified_referrals = (code.qualified_referrals || 0) + 1;
  }
  return referral;
}

async function issueRewards(referralId) {
  const db = getDb();
  const referral = db
    ? (await db.query("SELECT * FROM referrals WHERE id = $1", [referralId])).rows[0]
    : promoStore.referrals.find((r) => r.id === referralId);

  if (!referral) return { error: "Referral not found" };
  if (referral.status !== "qualified") return { error: "Referral is not qualified yet" };

  const program = await getProgramById(referral.program_id);
  if (!program) return { error: "Referral program not found" };

  const walletStore = require("./walletStore");
  const results = { referrer: null, referee: null };

  if (!referral.referrer_rewarded && program.referrer_reward_value > 0) {
    if (program.referrer_reward_type === "wallet_credit") {
      const topup = await walletStore.topUp(
        referral.referrer_customer_id,
        program.referrer_reward_value,
        "referral_bonus",
        `Referral reward - ${program.name}`,
      );
      results.referrer = topup;
    }
    if (db) {
      await db.query("UPDATE referrals SET referrer_rewarded = true, updated_at = NOW() WHERE id = $1", [referralId]);
    } else {
      referral.referrer_rewarded = true;
      referral.updated_at = new Date().toISOString();
    }
  }

  if (!referral.referee_rewarded && program.referee_reward_value > 0) {
    if (program.referee_reward_type === "wallet_credit") {
      const topup = await walletStore.topUp(
        referral.referee_customer_id,
        program.referee_reward_value,
        "referral_bonus",
        `Referral welcome bonus - ${program.name}`,
      );
      results.referee = topup;
    }
    if (db) {
      await db.query("UPDATE referrals SET referee_rewarded = true, updated_at = NOW() WHERE id = $1", [referralId]);
    } else {
      referral.referee_rewarded = true;
      referral.updated_at = new Date().toISOString();
    }
  }

  if (db) {
    await db.query("UPDATE referrals SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status = 'qualified'", [referralId]);
  } else {
    if (referral.status === "qualified") {
      referral.status = "completed";
      referral.updated_at = new Date().toISOString();
    }
  }

  return { success: true, results };
}

async function getReferralStats(programId) {
  const db = getDb();
  if (db) {
    const statsResult = await db.query(
      `SELECT
        COUNT(*) as total_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'qualified') as qualified,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE referrer_rewarded = true) as referrer_rewarded_count,
        COUNT(*) FILTER (WHERE referee_rewarded = true) as referee_rewarded_count
       FROM referrals WHERE program_id = $1`,
      [programId],
    );
    const codesResult = await db.query(
      "SELECT COUNT(*) as total_codes FROM referral_codes WHERE program_id = $1",
      [programId],
    );
    return { ...statsResult.rows[0], total_codes: codesResult.rows[0].total_codes };
  }

  const referrals = promoStore.referrals.filter((r) => r.program_id === programId);
  const codes = promoStore.referral_codes.filter((c) => c.program_id === programId);
  return {
    total_referrals: referrals.length,
    pending: referrals.filter((r) => r.status === "pending").length,
    qualified: referrals.filter((r) => r.status === "qualified").length,
    completed: referrals.filter((r) => r.status === "completed").length,
    referrer_rewarded_count: referrals.filter((r) => r.referrer_rewarded).length,
    referee_rewarded_count: referrals.filter((r) => r.referee_rewarded).length,
    total_codes: codes.length,
  };
}

module.exports = {
  promoStore,
  genCode,
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  validatePromo,
  redeemPromo,
  getRedemptions,
  createProgram,
  getPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
  getOrCreateReferralCode,
  getReferralCodes,
  createReferral,
  getReferrals,
  qualifyReferral,
  issueRewards,
  getReferralStats,
};
