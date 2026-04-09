/**
 * Auto Migration
 * Runs on server startup to ensure database schema is up to date
 */

const db = require('./index');

const authMigrations = [
  // Add auth-related columns to users table if they don't exist
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'staff'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`,

  // Customer portal auth columns
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_pin_hash VARCHAR(255)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS pin_reset_code VARCHAR(10)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS pin_reset_expires TIMESTAMP`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_portal_login TIMESTAMP`,
];

async function runAuthMigrations() {
  console.log('🔧 Running auth migrations...');
  try {
    for (const migration of authMigrations) {
      await db.query(migration);
    }
    console.log('✅ Auth migrations completed');
    return true;
  } catch (error) {
    console.error('❌ Auth migration error:', error.message);
    return false;
  }
}

module.exports = { runAuthMigrations };
