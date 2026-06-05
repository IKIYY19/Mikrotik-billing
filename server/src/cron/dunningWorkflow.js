/**
 * Dunning Workflow Cron
 * Structured escalation for unpaid invoices:
 *
 * Day 0:   Invoice generated (handled by recurringBilling)
 * Day +3:  Friendly reminder SMS
 * Day +7:  "Final notice" warning SMS
 * Day +10: FUP throttle (reduce speed to 256kbps)
 * Day +14: Full suspension (handled by autoSuspend, but we pre-warn here)
 *
 * All day thresholds are configurable via settings table.
 * Runs every 6 hours to catch time zones and reduce lag.
 *
 * Tracks state in invoice.notes to avoid duplicate actions per stage.
 */

const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

async function getSetting(key, fallback) {
  try {
    if (!global.dbAvailable || !global.db) return fallback;
    const r = await global.db.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    return r.rows[0]?.value ?? fallback;
  } catch { return fallback; }
}

// Dunning stage markers written into invoice notes to track progress
const STAGE_MARKERS = {
  reminder: '[dunning:reminder]',
  warning: '[dunning:warning]',
  throttle: '[dunning:throttle]',
  suspended: '[dunning:suspended]',
};

function hasStage(notes, stage) {
  return (notes || '').includes(STAGE_MARKERS[stage]);
}

async function markStage(invoiceId, stage, extraNote = '') {
  const marker = STAGE_MARKERS[stage];
  await global.db.query(
    `UPDATE invoices
     SET notes = COALESCE(notes,'') || $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [`\n${marker} ${new Date().toISOString().split('T')[0]} ${extraNote}`, invoiceId]
  );
}

async function applyFUPThrottle(pppoeUsername, throttleSpeed) {
  try {
    const radiusSync = require('../services/radiusSync');
    const radiusPod = require('../services/radiusPod');
    await radiusSync.updateThrottle(pppoeUsername, throttleSpeed);
    await radiusPod.kickUser(pppoeUsername, {});
    logger.info(`[Dunning] Throttled ${pppoeUsername} to ${throttleSpeed}`);
    return true;
  } catch (e) {
    logger.warn('[Dunning] Throttle failed', { user: pppoeUsername, error: e.message });
    return false;
  }
}

async function runDunning() {
  if (!global.dbAvailable || !global.db) {
    logger.warn('[Dunning] DB not available, skipping');
    return;
  }

  logger.info('[Dunning] Running dunning workflow check...');

  // Read configurable thresholds (days overdue)
  const [dayReminder, dayWarning, dayThrottle] = await Promise.all([
    getSetting('dunning_reminder_days', '3'),
    getSetting('dunning_warning_days', '7'),
    getSetting('dunning_throttle_days', '10'),
  ]);

  const dReminder = parseInt(dayReminder);
  const dWarning = parseInt(dayWarning);
  const dThrottle = parseInt(dayThrottle);

  try {
    // Get all unpaid invoices that are now overdue
    const result = await global.db.query(`
      SELECT
        i.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        s.pppoe_username,
        s.plan_id,
        (CURRENT_DATE - i.due_date::date) as days_overdue
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      LEFT JOIN subscriptions s ON s.customer_id = c.id AND s.status = 'active'
      WHERE i.status NOT IN ('paid', 'cancelled')
        AND i.due_date::date < CURRENT_DATE
      ORDER BY i.due_date ASC
    `);

    const overdue = result.rows;
    logger.info(`[Dunning] ${overdue.length} overdue invoices to process`);

    const stats = { reminder: 0, warning: 0, throttle: 0, skipped: 0 };

    for (const inv of overdue) {
      const days = parseInt(inv.days_overdue) || 0;
      const notes = inv.notes || '';
      const customer = {
        id: inv.customer_id,
        name: inv.customer_name,
        phone: inv.customer_phone,
        email: inv.customer_email,
      };
      const invoice = {
        id: inv.id,
        invoice_number: inv.invoice_number,
        total: inv.total,
        due_date: inv.due_date,
        balance: parseFloat(inv.total || 0) - parseFloat(inv.paid_amount || 0),
      };

      // Stage 1: Friendly Reminder
      if (days >= dReminder && !hasStage(notes, 'reminder')) {
        try {
          await notificationService.triggerSMS('invoice_due_soon', {
            customer,
            invoice: { ...invoice, days_overdue: days },
            custom_message: `Hi ${customer.name}, your invoice ${invoice.invoice_number} of KES ${parseFloat(invoice.total).toLocaleString()} was due ${days} day${days !== 1 ? 's' : ''} ago. Please pay to avoid service interruption. M-Pesa: ${await getSetting('mpesa_paybill', 'your Paybill')} Acc: ${invoice.invoice_number}`,
          });
          await markStage(inv.id, 'reminder');
          stats.reminder++;
          logger.info(`[Dunning] Reminder sent to ${customer.name} (${days}d overdue)`);
        } catch (e) {
          logger.warn('[Dunning] Reminder SMS failed', { customer: customer.name, error: e.message });
        }
        continue; // process one stage per run per invoice
      }

      // Stage 2: Final Warning
      if (days >= dWarning && !hasStage(notes, 'warning')) {
        try {
          await notificationService.triggerSMS('invoice_overdue', {
            customer,
            invoice: { ...invoice, days_overdue: days },
            custom_message: `URGENT: ${customer.name}, your invoice ${invoice.invoice_number} is ${days} days overdue (KES ${parseFloat(invoice.total).toLocaleString()}). Your service will be suspended in ${dThrottle - dWarning} day(s) if not paid. Pay via M-Pesa Paybill ${await getSetting('mpesa_paybill', '')} Acc: ${invoice.invoice_number}`,
          });
          await markStage(inv.id, 'warning');
          stats.warning++;
          logger.info(`[Dunning] Warning sent to ${customer.name} (${days}d overdue)`);
        } catch (e) {
          logger.warn('[Dunning] Warning SMS failed', { customer: customer.name, error: e.message });
        }
        continue;
      }

      // Stage 3: FUP Throttle (reduce speed before full suspension)
      if (days >= dThrottle && !hasStage(notes, 'throttle') && inv.pppoe_username) {
        const throttleSpeed = await getSetting('dunning_throttle_speed', '256k/256k');
        const throttled = await applyFUPThrottle(inv.pppoe_username, throttleSpeed);

        try {
          await notificationService.triggerSMS('service_suspended', {
            customer,
            invoice,
            custom_message: `${customer.name}, your internet speed has been reduced due to unpaid invoice ${invoice.invoice_number} (${days} days overdue). Pay KES ${parseFloat(invoice.total).toLocaleString()} immediately to restore full speed. M-Pesa: ${await getSetting('mpesa_paybill', '')} Acc: ${invoice.invoice_number}`,
          });
        } catch (e) {
          logger.warn('[Dunning] Throttle SMS failed', { error: e.message });
        }

        if (throttled) {
          await markStage(inv.id, 'throttle', `(throttled to ${throttleSpeed})`);
          stats.throttle++;
          logger.info(`[Dunning] Throttled ${inv.pppoe_username} — ${days}d overdue`);
        }
        continue;
      }

      stats.skipped++;
    }

    logger.info('[Dunning] Complete', stats);
    return stats;
  } catch (err) {
    logger.error('[Dunning] Fatal error', { error: err.message });
    return { error: err.message };
  }
}

function startCron() {
  const intervalMs = 6 * 60 * 60 * 1000; // Every 6 hours
  logger.info('[Dunning] Cron started (every 6h, first run in 20min)');

  // First run 20 minutes after server start
  setTimeout(() => {
    runDunning();
    setInterval(runDunning, intervalMs);
  }, 20 * 60 * 1000);
}

module.exports = { runDunning, startCron };
