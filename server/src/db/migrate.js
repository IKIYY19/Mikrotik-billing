const db = require('./index');
const { runAuthMigrations } = require('./authMigrations');
const { runBillingMigrations } = require('./billingMigrations');
const { runIntegrationsMigration } = require('./integrationsMigration');
const provisioningMigrations = require('./provisionMigrations');

const coreMigrations = [
  // Users table (MUST be first - required for auth)
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_password_change TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,

  // Projects table
  `CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    routeros_version VARCHAR(10) DEFAULT 'v7',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Templates table
  `CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    generated_script TEXT,
    is_public BOOLEAN DEFAULT false,
    user_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Project modules (configurations)
  `CREATE TABLE IF NOT EXISTS project_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    module_type VARCHAR(100) NOT NULL,
    config_data JSONB NOT NULL,
    generated_script TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Version history
  `CREATE TABLE IF NOT EXISTS version_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    description TEXT,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // MikroTik API connections
  `CREATE TABLE IF NOT EXISTS mikrotik_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    api_port INTEGER DEFAULT 8728,
    ssh_port INTEGER DEFAULT 22,
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL,
    connection_type VARCHAR(10) DEFAULT 'api',
    use_tunnel BOOLEAN DEFAULT false,
    tunnel_host VARCHAR(255),
    tunnel_port INTEGER DEFAULT 22,
    tunnel_username VARCHAR(100),
    tunnel_password_encrypted TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Generated scripts history
  `CREATE TABLE IF NOT EXISTS script_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    module_types TEXT[],
    full_script TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_project_modules_project_id ON project_modules(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)`,
  `CREATE INDEX IF NOT EXISTS idx_version_history_project_id ON version_history(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_script_history_project_id ON script_history(project_id)`,

  // Customers table (for billing)
  `CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    status VARCHAR(50) DEFAULT 'active',
    balance NUMERIC(10, 2) DEFAULT 0,
    portal_pin_hash VARCHAR(255),
    pin_reset_code VARCHAR(10),
    pin_reset_expires TIMESTAMP,
    last_portal_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`,
  `CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)`,

  // Hotspot vouchers table
  `CREATE TABLE IF NOT EXISTS hotspot_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL,
    profile VARCHAR(100),
    valid_for VARCHAR(50),
    rate_limit VARCHAR(50),
    data_limit VARCHAR(50),
    price NUMERIC(10, 2) DEFAULT 0,
    company_name VARCHAR(255),
    connection_id UUID REFERENCES mikrotik_connections(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_username ON hotspot_vouchers(username)`,
  `CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_connection_id ON hotspot_vouchers(connection_id)`,

  // OLT connections table
  `CREATE TABLE IF NOT EXISTS olt_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    vendor VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    ip_address VARCHAR(45) NOT NULL,
    telnet_port INTEGER DEFAULT 23,
    snmp_port INTEGER DEFAULT 161,
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL,
    snmp_community_encrypted TEXT NOT NULL,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    custom_oids JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_olt_connections_vendor ON olt_connections(vendor)`,
  `CREATE INDEX IF NOT EXISTS idx_olt_connections_status ON olt_connections(status)`,

  // FUP (Fair Usage Policy) profiles table
  `CREATE TABLE IF NOT EXISTS fup_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    data_limit VARCHAR(50) NOT NULL,
    data_limit_unit VARCHAR(10) DEFAULT 'GB',
    reset_period VARCHAR(20) DEFAULT 'monthly',
    throttle_speed VARCHAR(50),
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fup_profiles_name ON fup_profiles(name)`,
  `CREATE INDEX IF NOT EXISTS idx_fup_profiles_active ON fup_profiles(is_active)`,

  // TR-069 CPE devices table
  `CREATE TABLE IF NOT EXISTS tr069_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(255) UNIQUE NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    firmware_version VARCHAR(50),
    connection_id UUID REFERENCES mikrotik_connections(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    status VARCHAR(50) DEFAULT 'unknown',
    last_inform TIMESTAMP,
    parameters JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tr069_devices_serial ON tr069_devices(serial_number)`,
  `CREATE INDEX IF NOT EXISTS idx_tr069_devices_status ON tr069_devices(status)`,
  `CREATE INDEX IF NOT EXISTS idx_tr069_devices_connection ON tr069_devices(connection_id)`,

  // Add FUP profile to customers table
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS fup_profile_id UUID REFERENCES fup_profiles(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_customers_fup_profile ON customers(fup_profile_id)`,

  // Add missing columns to mikrotik_connections
  `ALTER TABLE mikrotik_connections ADD COLUMN IF NOT EXISTS ssh_port INTEGER DEFAULT 22`,
  `ALTER TABLE mikrotik_connections ADD COLUMN IF NOT EXISTS connection_type VARCHAR(10) DEFAULT 'api'`,
  `ALTER TABLE mikrotik_connections ADD COLUMN IF NOT EXISTS use_tunnel BOOLEAN DEFAULT false`,
  `ALTER TABLE mikrotik_connections ADD COLUMN IF NOT EXISTS tunnel_host VARCHAR(255)`,
  `ALTER TABLE mikrotik_connections ADD COLUMN IF NOT EXISTS tunnel_port INTEGER DEFAULT 22`,
  `ALTER TABLE mikrotik_connections ADD COLUMN IF NOT EXISTS tunnel_username VARCHAR(100)`,
  `ALTER TABLE mikrotik_connections ADD COLUMN IF NOT EXISTS tunnel_password_encrypted TEXT`,

  // Add user activity tracking
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen)`,
  `CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online)`,

  // Monitoring and alerting tables
  `CREATE TABLE IF NOT EXISTS health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES mikrotik_connections(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    cpu_usage NUMERIC(5,2),
    memory_usage NUMERIC(5,2),
    uptime_seconds INTEGER,
    temperature NUMERIC(5,2),
    bandwidth_usage JSONB,
    latency_ms NUMERIC(10,2),
    error_message TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_health_checks_connection ON health_checks(connection_id)`,
  `CREATE INDEX IF NOT EXISTS idx_health_checks_type ON health_checks(check_type)`,
  `CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status)`,
  `CREATE INDEX IF NOT EXISTS idx_health_checks_time ON health_checks(checked_at)`,

  `CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES mikrotik_connections(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_connection ON alerts(connection_id)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(created_at)`,

  `CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    channel_type VARCHAR(20) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notification_channels_user ON notification_channels(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(channel_type)`,

  `CREATE TABLE IF NOT EXISTS monitoring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES mikrotik_connections(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,
    threshold_value NUMERIC(10,2) NOT NULL,
    comparison_operator VARCHAR(10) DEFAULT '>',
    is_enabled BOOLEAN DEFAULT true,
    alert_severity VARCHAR(20) DEFAULT 'warning',
    notification_channels TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_monitoring_rules_connection ON monitoring_rules(connection_id)`,
  `CREATE INDEX IF NOT EXISTS idx_monitoring_rules_type ON monitoring_rules(rule_type)`,
];

async function runMigrations() {
  console.log('Running database migrations...');
  try {
    for (const migration of coreMigrations) {
      await db.query(migration);
    }
    console.log('Core migrations completed successfully');

    const authOk = await runAuthMigrations();
    if (!authOk) {
      throw new Error('Auth migrations reported failure');
    }

    await runBillingMigrations(db);
    console.log('Billing migrations completed successfully');

    const integrationsOk = await runIntegrationsMigration();
    if (!integrationsOk) {
      throw new Error('Integrations migration reported failure');
    }

    // Run provisioning migrations (routers table)
    for (const migration of provisioningMigrations) {
      await db.query(migration);
    }
    console.log('Provisioning migrations completed successfully');

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations, migrations: coreMigrations, coreMigrations };
