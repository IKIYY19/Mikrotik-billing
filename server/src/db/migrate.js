const db = require('./index');

const migrations = [
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
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL,
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
];

async function runMigrations() {
  console.log('Running database migrations...');
  try {
    for (const migration of migrations) {
      await db.query(migration);
    }
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

module.exports = { runMigrations, migrations };
