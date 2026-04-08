/**
 * Auto-Suspend Cron
 * Runs daily to suspend non-paying customers and send notifications
 */

const repo = require('../db/billingRepository');

async function runAutoSuspend() {
  try {
    console.log('[Cron] Running auto-suspend check...');

    // 1. Get overdue invoices
    const overdueInvoices = await repo.invoices.getOverdue();
    if (overdueInvoices.length === 0) {
      console.log('[Cron] No overdue invoices');
      return;
    }

    console.log(`[Cron] Found ${overdueInvoices.length} overdue invoices`);

    // 2. Suspend subscriptions for overdue customers
    const suspended = await repo.subscriptions.suspendOverdue();
    if (suspended.length > 0) {
      console.log(`[Cron] Suspended ${suspended.length} subscriptions`);

      // 3. Log suspension notifications (would send email/SMS in production)
      for (const sub of suspended) {
        console.log(`[Cron] Would notify suspension for customer ${sub.customer_id}`);
      }
    }

    // 4. Log overdue notifications
    for (const invoice of overdueInvoices) {
      const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (24 * 60 * 60 * 1000));
      if (daysOverdue === 1 || daysOverdue === 7 || daysOverdue === 30) {
        console.log(`[Cron] Overdue notification: ${invoice.invoice_number} (${daysOverdue} days)`);
      }
    }
  } catch (error) {
    console.error('[Cron] Auto-suspend error:', error);
  }
}

// Start the cron
function startCron() {
  // Run every 24 hours
  const interval = 24 * 60 * 60 * 1000;
  console.log(`[Cron] Auto-scron started, runs every 24 hours`);

  // Run immediately on start
  runAutoSuspend();

  setInterval(runAutoSuspend, interval);
}

module.exports = { runAutoSuspend, startCron };
