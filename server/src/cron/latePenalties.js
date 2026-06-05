/**
 * Late Payment Penalty Cron
 * Runs daily. Adds a penalty charge to overdue invoices after the grace period.
 * Grace period and penalty % are configurable via the Settings table.
 */

const logger = require('../utils/logger');

async function getSetting(key, fallback) {
  try {
    if (!global.dbAvailable || !global.db) return fallback;
    const r = await global.db.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
    return r.rows[0]?.value ?? fallback;
  } catch { return fallback; }
}

async function runLatePenalties() {
  logger.info('[LatePenalties] Running late payment penalty check...');

  if (!global.dbAvailable || !global.db) {
    logger.warn('[LatePenalties] Database not available, skipping');
    return;
  }

  const graceDays = parseInt(await getSetting('late_payment_grace_days', '7'));
  const penaltyPct = parseFloat(await getSetting('late_payment_penalty_pct', '5'));

  logger.info(`[LatePenalties] Grace: ${graceDays} days | Penalty: ${penaltyPct}%`);

  try {
    // Find invoices that are overdue past grace period, not yet penalized
    const result = await global.db.query(
      `SELECT i.*, c.name as customer_name, c.phone, c.email
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.status NOT IN ('paid', 'cancelled')
         AND i.due_date < CURRENT_DATE - $1::INTEGER
         AND (i.notes IS NULL OR i.notes NOT LIKE '%Late payment penalty%')
       ORDER BY i.due_date ASC`,
      [graceDays]
    );

    const overdue = result.rows;
    logger.info(`[LatePenalties] Found ${overdue.length} invoices eligible for penalty`);

    const results = { applied: [], skipped: [], errors: [] };

    for (const invoice of overdue) {
      try {
        const baseAmount = parseFloat(invoice.amount);
        const penaltyAmount = Math.round((baseAmount * penaltyPct / 100) * 100) / 100;
        const newAmount = baseAmount + penaltyAmount;
        const newTotal = newAmount + parseFloat(invoice.tax || 0);
        const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000);
        const penaltyNote = `Late payment penalty: ${penaltyPct}% (KES ${penaltyAmount}) applied on ${new Date().toLocaleDateString('en-KE')} — ${daysOverdue} days overdue`;
        const updatedNotes = [invoice.notes, penaltyNote].filter(Boolean).join('\n');

        await global.db.query(
          `UPDATE invoices
           SET amount = $1, total = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [newAmount, newTotal, updatedNotes, invoice.id]
        );

        results.applied.push({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer: invoice.customer_name,
          penalty_amount: penaltyAmount,
          days_overdue: daysOverdue,
        });

        logger.info(`[LatePenalties] Applied KES ${penaltyAmount} penalty to ${invoice.invoice_number} (${invoice.customer_name})`);
      } catch (err) {
        results.errors.push({ invoice_id: invoice.id, error: err.message });
        logger.error('[LatePenalties] Error applying penalty', { invoice_id: invoice.id, error: err.message });
      }
    }

    logger.info('[LatePenalties] Complete', {
      applied: results.applied.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
    });

    return results;
  } catch (err) {
    logger.error('[LatePenalties] Fatal error', { error: err.message });
    return { fatal_error: err.message };
  }
}

function startCron() {
  const interval = 24 * 60 * 60 * 1000; // daily
  logger.info('[LatePenalties] Cron started (daily, 15min startup delay)');

  // Run 15 minutes after server start, then every 24h
  setTimeout(() => {
    runLatePenalties();
    setInterval(runLatePenalties, interval);
  }, 15 * 60 * 1000);
}

module.exports = { runLatePenalties, startCron };
