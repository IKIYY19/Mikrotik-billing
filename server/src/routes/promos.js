const express = require("express");
const router = express.Router();

const promoStore = require("../db/promoStore");
const billingStore = require("../db/billingStore");

// ─── Promo Campaigns ───

router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await promoStore.getCampaigns();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: "Campaign name is required" });
    if (req.body.value === undefined || req.body.value === null) {
      return res.status(400).json({ error: "Discount value is required" });
    }
    const campaign = await promoStore.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Promo code already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.get("/campaigns/:id", async (req, res) => {
  try {
    const campaign = await promoStore.getCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/campaigns/:id", async (req, res) => {
  try {
    const campaign = await promoStore.updateCampaign(req.params.id, req.body);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    const deleted = await promoStore.deleteCampaign(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Campaign not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate a promo code (no redemption)
router.post("/validate", async (req, res) => {
  try {
    const { code, customer_id, invoice_amount } = req.body;
    if (!code) return res.status(400).json({ error: "Promo code is required" });
    const result = await promoStore.validatePromo(code, customer_id, invoice_amount);
    if (!result.valid) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Redeem a promo code
router.post("/redeem", async (req, res) => {
  try {
    const { code, customer_id, invoice_id, invoice_amount } = req.body;
    if (!code) return res.status(400).json({ error: "Promo code is required" });
    const result = await promoStore.redeemPromo(code, customer_id, invoice_id, invoice_amount);
    if (!result.valid) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get redemptions for a campaign
router.get("/campaigns/:id/redemptions", async (req, res) => {
  try {
    const redemptions = await promoStore.getRedemptions(req.params.id);
    res.json(redemptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all redemptions
router.get("/redemptions", async (req, res) => {
  try {
    const redemptions = await promoStore.getRedemptions();
    res.json(redemptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Referral Programs ───

router.get("/programs", async (req, res) => {
  try {
    const programs = await promoStore.getPrograms();
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/programs", async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: "Program name is required" });
    if (req.body.referrer_reward_value === undefined) {
      return res.status(400).json({ error: "Referrer reward value is required" });
    }
    const program = await promoStore.createProgram(req.body);
    res.status(201).json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/programs/:id", async (req, res) => {
  try {
    const program = await promoStore.getProgramById(req.params.id);
    if (!program) return res.status(404).json({ error: "Program not found" });
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/programs/:id", async (req, res) => {
  try {
    const program = await promoStore.updateProgram(req.params.id, req.body);
    if (!program) return res.status(404).json({ error: "Program not found" });
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/programs/:id", async (req, res) => {
  try {
    const deleted = await promoStore.deleteProgram(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Program not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get referral stats for a program
router.get("/programs/:id/stats", async (req, res) => {
  try {
    const stats = await promoStore.getReferralStats(req.params.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Referral Codes ───

router.get("/codes", async (req, res) => {
  try {
    const codes = await promoStore.getReferralCodes(req.query.customer_id);
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/codes", async (req, res) => {
  try {
    const { program_id, customer_id } = req.body;
    if (!program_id || !customer_id) {
      return res.status(400).json({ error: "Program ID and customer ID are required" });
    }
    const code = await promoStore.getOrCreateReferralCode(program_id, customer_id);
    res.status(201).json(code);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Referrals ───

router.get("/referrals", async (req, res) => {
  try {
    const filters = {};
    if (req.query.referrer_customer_id) filters.referrer_customer_id = req.query.referrer_customer_id;
    if (req.query.program_id) filters.program_id = req.query.program_id;
    if (req.query.status) filters.status = req.query.status;
    const referrals = await promoStore.getReferrals(filters);

    const enriched = referrals.map((r) => {
      const referrer = billingStore.store.customers.find((c) => c.id === r.referrer_customer_id);
      const referee = billingStore.store.customers.find((c) => c.id === r.referee_customer_id);
      return {
        ...r,
        referrer_name: referrer?.name,
        referrer_phone: referrer?.phone,
        referee_name: referee?.name,
        referee_phone: referee?.phone,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/referrals", async (req, res) => {
  try {
    const { program_id, referrer_customer_id, referee_customer_id, referral_code_id } = req.body;
    if (!program_id || !referrer_customer_id || !referee_customer_id) {
      return res.status(400).json({ error: "Program ID, referrer ID, and referee ID are required" });
    }
    const result = await promoStore.createReferral(program_id, referrer_customer_id, referee_customer_id, referral_code_id);
    if (result.error) return res.status(400).json(result);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/referrals/:id/qualify", async (req, res) => {
  try {
    const referral = await promoStore.qualifyReferral(req.params.id);
    if (!referral) return res.status(404).json({ error: "Referral not found or already qualified" });
    res.json(referral);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/referrals/:id/rewards", async (req, res) => {
  try {
    const result = await promoStore.issueRewards(req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
