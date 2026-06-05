/**
 * Recurring Billing Cron
 * Runs on the 1st of every month at 00:05 to generate invoices
 * for all active subscriptions. Supports prorated billing for
 * mid-month activations.
 */

const billingData = require('../services/billingData');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getStartDay(dateStr) {
  if (!dateStr) return 1;
  return new Date(dateStr).getDate();
}

/**
 * Calculate prorated amount for mid-month activations.
 * If subscription started on the 1st, returns full price.
 */
function getProratedAmount(planPrice, startDateStr) {
  const startDay = getStartDay(startDateStr);
  if (startDay <= 1) return planPrice;

  const now = new Date();
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
  const daysRemaining = daysInMonth - startDay + 1;
  const prorated = Math.round((planPrice / daysInMonth) * daysRemaining * 100) / 100;
  logger.info(`[RecurringBilling] Prorated: ${daysRemaining}/${daysInMonth} days = KES ${prorated} of KES ${planPrice}`);
  return prorated;
}

function getDueDate() {
  const now = new Date();
  // Due on the 15th of the current month
  const due = new Date(now.getFullYear(), now.getMonth(), 15);
  return due.toISOString().split('T')[0];
}

async function getCompanySetting(key, fallback = '') {
  try {
    if (!global.dbAvailable || !global.db) return fallback;
    const r = await global.db.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    return r.rows[0]?.value || fallback;
  } catch { return fallback; }
}

// ─── Main Function ───────────────────────────────────────────────────────────

async function runRecurringBilling({ force = false } = {}) {
  logger.info('[RecurringBilling] Starting monthly invoice generation...');

  const now = new Date();
  const currentMonth = now.getMonth() + 1;  // 1-indexed
  const currentYear = now.getFullYear();
  const dueDate = getDueDate();

  const results = {
    created: [],
    skipped: [],
    errors: [],
    total_generated: 0,
    total_skipped: 0,
  };

  try {
    const subscriptions = await billingData.listSubscriptions();
    const activeSubs = subscriptions.filter(s => s.status === 'active');

    logger.info(`[RecurringBilling] Processing ${activeSubs.length} active subscriptions`);

    for (const sub of activeSubs) {
      try {
        const customerId = sub.customer_id;
        const planPrice = sub.plan?.price || sub.plan_price || 0;
        const planName = sub.plan?.name || sub.plan_name || 'Internet Service';
        const speedUp = sub.plan?.speed_up || sub.speed_up || '';
        const speedDown = sub.plan?.speed_down || sub.speed_down || '';

        if (!planPrice || planPrice <= 0) {
          results.skipped.push({ sub_id: sub.id, reason: 'No plan price' });
          results.total_skipped++;
          continue;
        }

        // Check if invoice already generated this month for this subscription
        if (!force && global.dbAvailable && global.db) {
          const existing = await global.db.query(
            `SELECT id FROM invoices
             WHERE customer_id = $1
             AND EXTRACT(MONTH FROM created_at) = $2
             AND EXTRACT(YEAR FROM created_at) = $3
             AND (subscription_id = $4 OR notes LIKE '%Monthly%')
             LIMIT 1`,
            [customerId, currentMonth, currentYear, sub.id]
          );
          if (existing.rows.length > 0) {
            results.skipped.push({ sub_id: sub.id, customer_id: customerId, reason: 'Invoice already generated this month' });
            results.total_skipped++;
            continue;
          }
        }

        // Calculate amount (prorated if first month)
        const isFirstMonth = sub.start_date &&
          new Date(sub.start_date).getMonth() === now.getMonth() &&
          new Date(sub.start_date).getFullYear() === now.getFullYear();

        const amount = isFirstMonth
          ? getProratedAmount(planPrice, sub.start_date)
          : planPrice;

        const speedLabel = speedUp && speedDown ? ` (${speedUp}/${speedDown})` : '';
        const notes = isFirstMonth
          ? `Prorated monthly service — ${planName}${speedLabel} (${getDaysInMonth(currentYear, now.getMonth()) - getStartDay(sub.start_date) + 1} days)`
          : `Monthly internet service — ${planName}${speedLabel}`;

        const invoice = await billingData.createInvoice({
          customer_id: customerId,
          subscription_id: sub.id,
          amount,
          due_date: dueDate,
          notes,
        });

        results.created.push({ invoice_id: invoice.id, customer_id: customerId, amount, invoice_number: invoice.invoice_number });
        results.total_generated++;

        // Send notification
        const customer = sub.customer || await billingData.getCustomerById(customerId);
        if (customer) {
          notificationService.triggerSMS('invoice_generated', {
            customer,
            invoice,
            sub,
          }).catch(e => logger.warn('[RecurringBilling] SMS failed', { error: e.message }));
        }

      } catch (subErr) {
        logger.error('[RecurringBilling] Error for subscription', { sub_id: sub.id, error: subErr.message });
        results.errors.push({ sub_id: sub.id, error: subErr.message });
      }
    }

    logger.info('[RecurringBilling] Complete', {
      generated: results.total_generated,
      skipped: results.total_skipped,
      errors: results.errors.length,
    });

    return results;
  } catch (err) {
    logger.error('[RecurringBilling] Fatal error', { error: err.message, stack: err.stack });
    return { ...results, fatal_error: err.message };
  }
}

// ─── Cron Scheduler ─────────────────────────────────────────────────────────

function msUntilFirst() {
  const now = new Date();
  // Next 1st of month at 00:05:00
  let target = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0);
  if (target <= now) {
    target = new Date(now.getFullYear(), now.getMonth() + 2, 1, 0, 5, 0);
  }
  return target.getTime() - now.getTime();
}

function startCron() {
  const delay = msUntilFirst();
  const hours = Math.round(delay / 1000 / 60 / 60);
  logger.info(`[RecurringBilling] Cron scheduled — next run in ~${hours}h (1st of next month 00:05)`);

  setTimeout(() => {
    runRecurringBilling();
    // Then repeat every ~30 days (86400000 * 30), re-schedule keeps it on the 1st
    setInterval(() => runRecurringBilling(), 30 * 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { runRecurringBilling, startCron };
