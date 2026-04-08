/**
 * Multi-Feature Store: Branches, Agents, Vouchers, Monitoring, Grace Periods
 * Extends billingStore with production-ready features
 */

const { v4: uuidv4 } = require('uuid');

// ─── Branches ───
const branches = [
  { id: 'branch-nairobi-main', name: 'Nairobi Main POP', city: 'Nairobi', address: 'Moi Avenue', contact: '+254700000001', status: 'active', created_at: new Date().toISOString() },
  { id: 'branch-mombasa', name: 'Mombasa POP', city: 'Mombasa', address: 'Moi Road', contact: '+254700000002', status: 'active', created_at: new Date().toISOString() },
  { id: 'branch-kisumu', name: 'Kisumu POP', city: 'Kisumu', address: 'Oginga Odinga St', contact: '+254700000003', status: 'active', created_at: new Date().toISOString() },
];

// ─── Agents/Resellers ───
const agents = [];

// ─── Vouchers ───
const vouchers = [];

// ─── Network Monitoring ───
const deviceMetrics = [];
const pppoeSessions = [];

// ─── Grace Period Configuration ───
const graceConfig = {
  warn_days: 7,       // Send warning SMS
  throttle_days: 14,  // Throttle speed
  suspend_days: 30,   // Full suspension
  throttle_speed_up: '1M',
  throttle_speed_down: '1M',
};

// ─── Seed sample agents ───
const seedAgents = () => {
  if (agents.length > 0) return;
  agents.push(
    { id: 'agent-001', name: 'James Ochieng', phone: '+254711111111', email: 'james@agent.co.ke', branch_id: 'branch-nairobi-main', commission_rate: 10, balance: 5000, status: 'active', created_at: new Date().toISOString() },
    { id: 'agent-002', name: 'Amina Hassan', phone: '+254722222222', email: 'amina@agent.co.ke', branch_id: 'branch-mombasa', commission_rate: 12, balance: 3500, status: 'active', created_at: new Date().toISOString() },
    { id: 'agent-003', name: 'Peter Kamau', phone: '+254733333333', email: 'peter@agent.co.ke', branch_id: 'branch-kisumu', commission_rate: 10, balance: 2000, status: 'active', created_at: new Date().toISOString() },
  );
};
seedAgents();

// ─── Seed sample vouchers ───
const seedVouchers = () => {
  if (vouchers.length > 0) return;
  const codes = ['VCH-A1B2C3', 'VCH-D4E5F6', 'VCH-G7H8I9', 'VCH-J0K1L2', 'VCH-M3N4O5'];
  codes.forEach((code, i) => {
    vouchers.push({
      id: `voucher-${i + 1}`,
      code,
      plan_name: ['Bronze 5M', 'Silver 10M', 'Gold 25M', 'Silver 10M', 'Bronze 5M'][i],
      duration_days: 30,
      price: [15, 25, 45, 25, 15][i],
      sold_by: ['agent-001', 'agent-002', 'agent-001', null, null][i],
      sold_to: ['', '', 'John Kamau', '', ''][i],
      status: i < 2 ? 'sold' : i < 3 ? 'redeemed' : 'available',
      redeemed_at: i === 2 ? '2026-04-01T10:00:00Z' : null,
      created_at: new Date().toISOString(),
    });
  });
};
seedVouchers();

// ─── Seed network metrics ───
const seedMetrics = () => {
  if (deviceMetrics.length > 0) return;
  const now = Date.now();
  branches.forEach(branch => {
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
  if (pppoeSessions.length > 0) return;
  const subs = require('./billingStore').store.subscriptions || [];
  subs.filter(s => s.pppoe_username && s.status === 'active').forEach(sub => {
    pppoeSessions.push({
      id: uuidv4(),
      username: sub.pppoe_username,
      customer_name: sub.customer?.name || 'Unknown',
      ip_address: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      bytes_in: Math.floor(Math.random() * 5000000000),
      bytes_out: Math.floor(Math.random() * 10000000000),
      uptime_seconds: Math.floor(Math.random() * 86400 * 7),
      connected_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    });
  });
  // Add some fake sessions if none exist
  if (pppoeSessions.length === 0) {
    ['kamau01', 'jane02', 'alice03', 'bob04'].forEach((user, i) => {
      pppoeSessions.push({
        id: uuidv4(),
        username: user,
        customer_name: `Customer ${i + 1}`,
        ip_address: `10.10.${i + 1}.${Math.floor(Math.random() * 254) + 1}`,
        bytes_in: Math.floor(Math.random() * 5000000000),
        bytes_out: Math.floor(Math.random() * 10000000000),
        uptime_seconds: Math.floor(Math.random() * 86400 * 7),
        connected_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      });
    });
  }
};
seedPPPoE();

module.exports = {
  branches,
  agents,
  vouchers,
  deviceMetrics,
  pppoeSessions,
  graceConfig,
};
