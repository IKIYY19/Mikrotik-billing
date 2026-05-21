const billing = require("./billingData");
const radiusSync = require("./radiusSync");
const notificationService = require("./notificationService");
const logger = require("../utils/logger");
const crypto = require("crypto");

function generatePassword(length = 8) {
  return crypto.randomBytes(length).toString("hex").slice(0, length).toUpperCase();
}

function generateUsername(customer) {
  const name = (customer.name || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const suffix = crypto.randomBytes(2).toString("hex");
  return `${name}${suffix}`;
}

async function autoProvisionOnPayment(payment) {
  try {
    if (!payment || !payment.customer_id) return null;

    const customer = payment.customer || await billing.getCustomerById(payment.customer_id);
    if (!customer) return null;

    const subscriptions = await billing.listSubscriptions();
    const customerSubs = subscriptions.filter(s => s.customer_id === payment.customer_id && s.status === "active");

    let provisioned = 0;
    for (const sub of customerSubs) {
      if (sub.auto_provision === false) continue;
      if (sub.pppoe_username && sub.pppoe_password) continue;

      const username = sub.pppoe_username || generateUsername(customer);
      const password = generatePassword(8);

      const plan = sub.plan || (sub.plan_id ? await billing.getPlanById(sub.plan_id) : null);

      await billing.updateSubscription(sub.id, {
        pppoe_username: username,
        pppoe_password: password,
      });

      try {
        await radiusSync.upsertRadiusUser({
          ...sub,
          pppoe_username: username,
          pppoe_password: password,
          customer_id: customer.id,
          customer: { id: customer.id, name: customer.name },
          plan,
          status: "active",
        });
      } catch (e) {
        logger.error("[AutoProvision] RADIUS sync failed:", { error: e.message });
      }

      const planName = plan?.name || "Active";
      const speed = plan ? `${plan.speed_up}/${plan.speed_down}` : "N/A";
      const phone = customer.phone || "";

      if (phone) {
        try {
          await notificationService.triggerSMS("welcome", {
            customer,
            plan_name: planName,
            speed,
            pppoe_user: username,
            pppoe_pass: password,
            company_name: process.env.COMPANY_NAME || "Your ISP",
            support_phone: phone,
          });
        } catch (e) {
          logger.error("[AutoProvision] Welcome SMS failed:", { error: e.message });
        }
      }

      logger.info(`[AutoProvision] Provisioned ${customer.name}: ${username} on ${planName}`);
      provisioned++;
    }

    return provisioned > 0 ? { provisioned, customer_name: customer.name } : null;
  } catch (e) {
    logger.error("[AutoProvision] Failed:", { error: e.message });
    return null;
  }
}

module.exports = { autoProvisionOnPayment };
