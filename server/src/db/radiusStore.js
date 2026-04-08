/**
 * RADIUS Accounting Store
 * Tracks bandwidth usage per session and per customer
 * Enforces quotas and auto-throttles
 */

const { v4: uuidv4 } = require('uuid');

const radiusStore = {
  sessions: [],
  daily_usage: [],
  quota_enforcement_log: [],
};

// ─── RADIUS Accounting Packet Handler ───
async function handleAccounting(data) {
  const {
    username,
    session_id,
    acct_status_type, // Start=1, Stop=2, Interim-Update=3
    acct_input_octets,
    acct_output_octets,
    acct_session_time,
    framed_ip_address,
    nas_ip_address,
    calling_station_id, // MAC address
    acct_terminate_cause,
  } = data;

  // Find customer by PPPoE username
  const billing = require('./billingStore');
  const customer = billing.store.customers.find(c => {
    const sub = billing.store.subscriptions.find(s => s.customer_id === c.id && s.pppoe_username === username);
    return sub;
  });

  if (!customer) {
    return { accepted: true, message: 'Unknown user', reply: { 'Reply-Message': 'User not found in billing system' } };
  }

  const subscription = billing.store.subscriptions.find(s => s.customer_id === customer.id && s.pppoe_username === username);
  const plan = subscription ? billing.store.service_plans.find(p => p.id === subscription.plan_id) : null;

  if (acct_status_type === 'Start' || acct_status_type === 1) {
    // Session started
    const session = {
      id: uuidv4(),
      session_id,
      username,
      customer_id: customer.id,
      start_time: new Date().toISOString(),
      end_time: null,
      bytes_in: 0,
      bytes_out: 0,
      session_time: 0,
      framed_ip: framed_ip_address,
      nas_ip: nas_ip_address,
      mac_address: calling_station_id,
      status: 'active',
    };
    radiusStore.sessions.push(session);

    return {
      accepted: true,
      reply: {
        'Reply-Message': 'Session started',
        'Mikrotik-Rate-Limit': plan ? `${plan.speed_down}/${plan.speed_up}` : '1M/1M',
      },
    };
  }

  if (acct_status_type === 'Interim-Update' || acct_status_type === 3) {
    // Update session
    const session = radiusStore.sessions.find(s => s.session_id === session_id && s.status === 'active');
    if (session) {
      session.bytes_in = parseInt(acct_input_octets) || 0;
      session.bytes_out = parseInt(acct_output_octets) || 0;
      session.session_time = parseInt(acct_session_time) || 0;

      // Check quota
      if (plan?.quota_gb) {
        const totalUsage = getTotalCustomerUsage(customer.id);
        const quotaBytes = plan.quota_gb * 1024 * 1024 * 1024;
        const usedPercent = (totalUsage / quotaBytes) * 100;

        if (usedPercent >= 100 && !subscription.throttled) {
          // Quota exceeded - throttle
          subscription.throttled = true;
          subscription.throttle_reason = 'quota_exceeded';
          subscription.updated_at = new Date().toISOString();

          radiusStore.quota_enforcement_log.push({
            id: uuidv4(),
            customer_id: customer.id,
            action: 'throttled',
            reason: `Quota exceeded: ${(totalUsage / (1024*1024*1024)).toFixed(1)}GB / ${plan.quota_gb}GB`,
            created_at: new Date().toISOString(),
          });

          return {
            accepted: true,
            reply: {
              'Reply-Message': 'Quota exceeded - throttled',
              'Mikrotik-Rate-Limit': '1M/1M',
            },
          };
        }

        if (usedPercent >= 80 && usedPercent < 100) {
          // Warning at 80%
          return {
            accepted: true,
            reply: {
              'Reply-Message': `Usage warning: ${usedPercent.toFixed(0)}% of quota used`,
              'Mikrotik-Rate-Limit': plan ? `${plan.speed_down}/${plan.speed_up}` : '1M/1M',
            },
          };
        }
      }

      return {
        accepted: true,
        reply: {
          'Mikrotik-Rate-Limit': subscription.throttled ? '1M/1M' : (plan ? `${plan.speed_down}/${plan.speed_up}` : '1M/1M'),
        },
      };
    }
  }

  if (acct_status_type === 'Stop' || acct_status_type === 2) {
    // Session ended
    const session = radiusStore.sessions.find(s => s.session_id === session_id && s.status === 'active');
    if (session) {
      session.end_time = new Date().toISOString();
      session.bytes_in = parseInt(acct_input_octets) || session.bytes_in;
      session.bytes_out = parseInt(acct_output_octets) || session.bytes_out;
      session.session_time = parseInt(acct_session_time) || session.session_time;
      session.status = 'completed';
      session.terminate_cause = acct_terminate_cause;
    }

    // Record daily usage
    const today = new Date().toISOString().split('T')[0];
    const dailyRecord = radiusStore.daily_usage.find(d => d.date === today && d.customer_id === customer.id);
    if (dailyRecord) {
      dailyRecord.bytes_in += parseInt(acct_input_octets) || 0;
      dailyRecord.bytes_out += parseInt(acct_output_octets) || 0;
      dailyRecord.sessions += 1;
    } else {
      radiusStore.daily_usage.push({
        id: uuidv4(),
        date: today,
        customer_id: customer.id,
        bytes_in: parseInt(acct_input_octets) || 0,
        bytes_out: parseInt(acct_output_octets) || 0,
        sessions: 1,
      });
    }

    return { accepted: true, reply: { 'Reply-Message': 'Session stopped' } };
  }

  return { accepted: true, reply: {} };
}

// ─── Get Total Customer Usage (current billing cycle) ───
function getTotalCustomerUsage(customerId) {
  const billing = require('./billingStore');
  const customer = billing.store.customers.find(c => c.id === customerId);
  if (!customer) return 0;

  // Find active subscription
  const subscription = billing.store.subscriptions.find(s => s.customer_id === customerId && s.status === 'active');
  if (!subscription) return 0;

  // Calculate usage from current billing cycle start date
  const cycleStart = subscription.start_date || new Date().toISOString().split('T')[0];
  const cycleStartTs = new Date(cycleStart).getTime();

  const totalBytes = radiusStore.sessions
    .filter(s => s.customer_id === customerId && new Date(s.start_time).getTime() >= cycleStartTs)
    .reduce((sum, s) => sum + s.bytes_in + s.bytes_out, 0);

  return totalBytes;
}

// ─── Reset Quotas for New Billing Cycle ───
function resetQuotas() {
  const billing = require('./billingStore');

  for (const sub of billing.store.subscriptions) {
    if (sub.status === 'active' && sub.throttled && sub.throttle_reason === 'quota_exceeded') {
      // Check if billing cycle has renewed
      // Simple check: if start_date is in current month
      const now = new Date();
      const startDate = new Date(sub.start_date);
      if (now.getMonth() !== startDate.getMonth() || now.getFullYear() !== startDate.getFullYear()) {
        // New billing cycle - reset throttle
        sub.throttled = false;
        sub.throttle_reason = null;
        sub.updated_at = new Date().toISOString();

        radiusStore.quota_enforcement_log.push({
          id: uuidv4(),
          customer_id: sub.customer_id,
          action: 'quota_reset',
          reason: 'New billing cycle',
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}

// ─── Get Usage Report ───
function getUsageReport(customerId, period = 'month') {
  const now = new Date();
  let startDate;

  if (period === 'day') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const sessions = radiusStore.sessions.filter(s =>
    s.customer_id === customerId && new Date(s.start_time) >= startDate
  );

  const totalIn = sessions.reduce((sum, s) => sum + s.bytes_in, 0);
  const totalOut = sessions.reduce((sum, s) => sum + s.bytes_out, 0);

  return {
    period,
    start_date: startDate.toISOString(),
    end_date: now.toISOString(),
    total_bytes_in: totalIn,
    total_bytes_out: totalOut,
    total_bytes: totalIn + totalOut,
    total_gb: ((totalIn + totalOut) / (1024 * 1024 * 1024)).toFixed(2),
    session_count: sessions.length,
    avg_session_time: sessions.length > 0
      ? (sessions.reduce((sum, s) => sum + s.session_time, 0) / sessions.length / 3600).toFixed(1) + 'h'
      : '0h',
    sessions: sessions.slice(-50).map(s => ({
      start_time: s.start_time,
      end_time: s.end_time,
      bytes_in: s.bytes_in,
      bytes_out: s.bytes_out,
      session_time: s.session_time,
      ip: s.framed_ip,
    })),
  };
}

module.exports = {
  radiusStore,
  handleAccounting,
  getTotalCustomerUsage,
  resetQuotas,
  getUsageReport,
};
