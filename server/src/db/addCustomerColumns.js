const db = require('./index');

async function addCustomerColumns() {
  try {
    console.log('Adding customer portal columns...');
    
    await db.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS wifi_password VARCHAR(255)');
    console.log('✓ Added wifi_password column');
    
    await db.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP');
    console.log('✓ Added password_changed_at column');
    
    await db.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_token VARCHAR(255)');
    console.log('✓ Added portal_token column');
    
    await db.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_token_expires TIMESTAMP');
    console.log('✓ Added portal_token_expires column');
    
    await db.query('CREATE INDEX IF NOT EXISTS idx_customers_portal_token ON customers(portal_token)');
    console.log('✓ Created portal_token index');
    
    console.log('All columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding columns:', error.message);
    process.exit(1);
  }
}

addCustomerColumns();
