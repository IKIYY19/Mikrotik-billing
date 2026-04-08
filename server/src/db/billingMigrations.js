/**
 * PostgreSQL migrations for ISP Billing
 */

const billingMigrations = [
  // Service Plans
  `CREATE TABLE IF NOT EXISTS service_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    speed_up VARCHAR(20) NOT NULL DEFAULT '1M',
    speed_down VARCHAR(20) NOT NULL DEFAULT '1M',
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    quota_gb INTEGER,
    priority INTEGER DEFAULT 8,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Customers
  `CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    id_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Subscriptions
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES service_plans(id) ON DELETE SET NULL,
    router_id UUID,
    pppoe_username VARCHAR(100),
    pppoe_password VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    auto_provision BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Invoices
  `CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Payments
  `CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    method VARCHAR(50) DEFAULT 'cash',
    reference VARCHAR(255),
    receipt_number VARCHAR(50),
    gateway_transaction_id VARCHAR(255),
    notes TEXT,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Credit Notes
  `CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Usage Records (from RADIUS)
  `CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    bytes_in BIGINT DEFAULT 0,
    bytes_out BIGINT DEFAULT 0,
    session_time INTEGER DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Audit Trail
  `CREATE TABLE IF NOT EXISTS billing_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Tax Configuration
  `CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Notification Templates
  `CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) UNIQUE NOT NULL,
    channel VARCHAR(20) NOT NULL,
    subject VARCHAR(255),
    body TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Users (for auth)
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_received ON payments(received_at)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_customer ON usage_records(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_entity ON billing_audit_logs(entity_type, entity_id)`,

  // Hotspot Vouchers
  `CREATE TABLE IF NOT EXISTS hotspot_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL,
    profile VARCHAR(100),
    valid_for VARCHAR(50),
    rate_limit VARCHAR(50),
    data_limit VARCHAR(50),
    price DECIMAL(10,2) DEFAULT 0,
    company_name VARCHAR(255),
    connection_id UUID,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vouchers_connection ON hotspot_vouchers(connection_id)`,

  // RADIUS NAS clients
  `CREATE TABLE IF NOT EXISTS nas (
    id SERIAL PRIMARY KEY,
    nasname VARCHAR(128) NOT NULL,
    shortname VARCHAR(32),
    type VARCHAR(30) DEFAULT 'other',
    ports INTEGER,
    secret VARCHAR(60) NOT NULL,
    server VARCHAR(64),
    community VARCHAR(50),
    description VARCHAR(200) DEFAULT 'RADIUS Client',
    connection_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // RADIUS radcheck
  `CREATE TABLE IF NOT EXISTS radcheck (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op CHAR(2) NOT NULL DEFAULT '==',
    value VARCHAR(253) NOT NULL,
    customer_id UUID,
    subscription_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // RADIUS radreply
  `CREATE TABLE IF NOT EXISTS radreply (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op CHAR(2) NOT NULL DEFAULT '=',
    value VARCHAR(253) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // RADIUS radgroupcheck
  `CREATE TABLE IF NOT EXISTS radgroupcheck (
    id SERIAL PRIMARY KEY,
    groupname VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op CHAR(2) NOT NULL DEFAULT '==',
    value VARCHAR(253) NOT NULL
  )`,

  // RADIUS radgroupreply
  `CREATE TABLE IF NOT EXISTS radgroupreply (
    id SERIAL PRIMARY KEY,
    groupname VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op CHAR(2) NOT NULL DEFAULT '=',
    value VARCHAR(253) NOT NULL
  )`,

  // RADIUS radusergroup
  `CREATE TABLE IF NOT EXISTS radusergroup (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    groupname VARCHAR(64) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // RADIUS radacct
  `CREATE TABLE IF NOT EXISTS radacct (
    radacctid BIGSERIAL PRIMARY KEY,
    acctsessionid VARCHAR(64) NOT NULL,
    acctuniqueid VARCHAR(32),
    username VARCHAR(64) NOT NULL,
    realm VARCHAR(64),
    nasipaddress VARCHAR(50),
    nasportid VARCHAR(15),
    nasporttype VARCHAR(32),
    acctstarttime TIMESTAMP,
    acctupdatetime TIMESTAMP,
    acctstoptime TIMESTAMP,
    acctinterval INTEGER,
    acctsessiontime INTEGER,
    acctauthentic VARCHAR(32),
    connectinfo_start VARCHAR(50),
    connectinfo_stop VARCHAR(50),
    acctinputoctets BIGINT,
    acctoutputoctets BIGINT,
    calledstationid VARCHAR(50),
    callingstationid VARCHAR(50),
    acctterminatecause VARCHAR(32),
    servicetype VARCHAR(32),
    framedprotocol VARCHAR(32),
    framedipaddress VARCHAR(50),
    customer_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // RADIUS radpostauth
  `CREATE TABLE IF NOT EXISTS radpostauth (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    pass VARCHAR(64),
    reply VARCHAR(32) NOT NULL,
    authdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nasipaddress VARCHAR(50),
    calledstationid VARCHAR(50),
    callingstationid VARCHAR(50)
  )`,

  // RADIUS indexes
  `CREATE INDEX IF NOT EXISTS idx_radcheck_username ON radcheck(username)`,
  `CREATE INDEX IF NOT EXISTS idx_radreply_username ON radreply(username)`,
  `CREATE INDEX IF NOT EXISTS idx_radacct_username ON radacct(username)`,
  `CREATE INDEX IF NOT EXISTS idx_radacct_sessionid ON radacct(acctsessionid)`,
  `CREATE INDEX IF NOT EXISTS idx_radacct_starttime ON radacct(acctstarttime)`,

  // Resellers
  `CREATE TABLE IF NOT EXISTS resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    credit_limit DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES resellers(id) ON DELETE SET NULL`,

  // Captive Portals
  `CREATE TABLE IF NOT EXISTS captive_portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    elements JSONB DEFAULT '[]',
    styles JSONB,
    hotspot_profile VARCHAR(100),
    connection_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Support Tickets
  `CREATE TABLE IF NOT EXISTS ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sla_hours INTEGER DEFAULT 24,
    color VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    category_id UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sla_deadline TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255),
    file_type VARCHAR(50),
    file_size INTEGER,
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Indexes for tickets
  `CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id)`,
];

// Seed data
const seedData = async (db) => {
  try {
    // Seed plans
    const existingPlans = await db.query('SELECT id FROM service_plans LIMIT 1');
    if (existingPlans.rows.length === 0) {
      await db.query(`INSERT INTO service_plans (id, name, speed_up, speed_down, price, quota_gb, priority, description) VALUES
        ('plan-bronze-5m-fixed-uuid-000001', 'Bronze 5M', '5M', '5M', 15.00, NULL, 8, 'Basic browsing and email'),
        ('plan-silver-10m-fixed-uuid-000002', 'Silver 10M', '10M', '10M', 25.00, NULL, 6, 'Standard home internet'),
        ('plan-gold-25m-fixed-uuid-000003', 'Gold 25M', '25M', '25M', 45.00, NULL, 4, 'Streaming and gaming'),
        ('plan-platinum-50m-fixed-uuid-000004', 'Platinum 50M', '50M', '50M', 75.00, 500, 2, 'Heavy usage plan'),
        ('plan-enterprise-100m-fixed-uuid-000005', 'Enterprise 100M', '100M', '100M', 150.00, NULL, 1, 'Business unlimited')
      `);
    }

    // Seed tax rate
    const existingTax = await db.query('SELECT id FROM tax_rates LIMIT 1');
    if (existingTax.rows.length === 0) {
      await db.query(`INSERT INTO tax_rates (name, rate, is_default, is_active) VALUES
        ('VAT', 16.00, true, true)
      `);
    }

    // Seed notification templates
    const existingNotifs = await db.query('SELECT id FROM notification_templates LIMIT 1');
    if (existingNotifs.rows.length === 0) {
      await db.query(`INSERT INTO notification_templates (event_type, channel, subject, body) VALUES
        ('invoice_due_soon', 'email', 'Invoice {{invoice_number}} is due', 'Dear {{customer_name}}, your invoice {{invoice_number}} for ${{amount}} is due on {{due_date}}.'),
        ('invoice_overdue', 'email', 'Invoice {{invoice_number}} is overdue', 'Dear {{customer_name}}, your invoice {{invoice_number}} for ${{amount}} is now overdue.'),
        ('payment_received', 'email', 'Payment received - Receipt {{receipt_number}}', 'Dear {{customer_name}}, we received your payment of ${{amount}}. Receipt: {{receipt_number}}.'),
        ('subscription_suspended', 'email', 'Service suspended', 'Dear {{customer_name}}, your internet service has been suspended due to non-payment.'),
        ('subscription_activated', 'email', 'Service activated', 'Dear {{customer_name}}, your internet service has been reactivated.'),
        ('invoice_due_soon', 'sms', null, '{{customer_name}}, invoice {{invoice_number}} (${{amount}}) is due {{due_date}}.'),
        ('invoice_overdue', 'sms', null, '{{customer_name}}, invoice {{invoice_number}} (${{amount}}) is OVERDUE. Service will be suspended.')
      `);
    }

    // Seed admin user (password: admin123)
    const bcrypt = require('bcrypt');
    const existingUser = await db.query('SELECT id FROM users LIMIT 1');
    if (existingUser.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query(`INSERT INTO users (email, password_hash, name, role) VALUES
        ('admin@mikrotik.local', '${hash}', 'Admin User', 'admin')
      `);
    }
  } catch (error) {
    console.error('Seed error:', error.message);
  }
};

module.exports = { billingMigrations, seedData };
