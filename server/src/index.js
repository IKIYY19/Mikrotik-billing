const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

// Prevent crashes from unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Promise Rejection:', reason?.message || reason);
  // Don't exit - log and continue
});

process.on('uncaughtException', (error) => {
  console.error('⚠️  Uncaught Exception:', error.message);
  console.error(error.stack);
  // Don't exit - log and continue
});

// Try to use PostgreSQL, fall back to in-memory storage
let db;
let dbAvailable = false;
let billingRepo = null;

async function initDB() {
  try {
    const pgDb = require('./db');
    await pgDb.query('SELECT 1');
    db = pgDb;
    dbAvailable = true;
    console.log('✅ Using PostgreSQL database');

    // Load billing repo
    billingRepo = require('./db/billingRepository');
  } catch (err) {
    console.warn('⚠️  PostgreSQL not available, using in-memory storage:', err.message);
    db = require('./db/memory');
    billingRepo = require('./db/billingStore');
    dbAvailable = false;
    return false;
  }
  return true;
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Start server
const startServer = async () => {
  try {
    // Initialize database FIRST
    await initDB();

    // Export for routes AFTER database is connected
    global.db = db;
    global.dbAvailable = dbAvailable;
    global.billingRepo = billingRepo;

    // Run database migrations automatically
    try {
      const { runMigrations } = require('./db/migrate');
      await runMigrations();
      console.log('✅ Core migrations done');
    } catch (e) {
      console.warn('⚠️  Core migrations skipped:', e.message);
    }

    try {
      const { runAuthMigrations } = require('./db/authMigrations');
      await runAuthMigrations();
    } catch (e) {
      console.warn('⚠️  Auth migrations skipped:', e.message);
    }

    // Run billing migrations
    try {
      const { billingMigrations } = require('./db/billingMigrations');
      for (const migration of billingMigrations) {
        await db.query(migration);
      }
      console.log('✅ Billing migrations done');
    } catch (e) {
      console.warn('⚠️  Billing migrations skipped:', e.message);
    }

    // Run integrations migration
    try {
      const { runIntegrationsMigration } = require('./db/integrationsMigration');
      await runIntegrationsMigration();
    } catch (e) {
      console.warn('⚠️  Integrations migration skipped:', e.message);
    }

    // Create default admin user if no users exist
    try {
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');
      const userCount = await db.query('SELECT COUNT(*) FROM users');
      if (parseInt(userCount.rows[0].count) === 0) {
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const adminHash = await bcrypt.hash(adminPassword, 10);
        await db.query(
          `INSERT INTO users (id, email, password_hash, name, role, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)`,
          [uuidv4(), 'admin@example.com', adminHash, 'Administrator', 'admin']
        );
        console.log('✅ Default admin created: admin@example.com');
        console.log(`🔑 Password: ${process.env.ADMIN_PASSWORD ? '(check env var)' : 'admin123'}`);
      } else {
        // Ensure admin user has correct role
        const adminCheck = await db.query('SELECT id, email, role FROM users WHERE email = $1', ['admin@example.com']);
        if (adminCheck.rows.length > 0 && adminCheck.rows[0].role !== 'admin') {
          await db.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', 'admin@example.com']);
          console.log('🔧 Fixed admin role to "admin"');
        }
      }
    } catch (e) {
      console.warn('⚠️  Admin user creation/fix skipped:', e.message);
    }

    // Public routes (no auth required)
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString(), database: dbAvailable ? 'postgres' : 'memory' });
    });
    app.use('/api/auth', require('./routes/auth'));
    app.use('/mikrotik', require('./routes/provision'));
    app.use('/api/portal/auth', require('./routes/customerAuth'));

    // Serve static frontend files
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'client', 'dist'),
      path.join(__dirname, '..', 'client', 'dist'),
      path.join(process.cwd(), 'client', 'dist'),
    ];

    let frontendPath = possiblePaths.find(p => fs.existsSync(path.join(p, 'index.html')));

    if (frontendPath) {
      console.log(`📦 Serving frontend from: ${frontendPath}`);
      app.use(express.static(frontendPath));
    } else {
      console.warn('⚠️  Frontend dist not found, skipping static file serving');
    }

    // Protected routes (require authentication)
    // Each route has auth middleware applied individually
    const { authenticate, requirePermission, requireRole, ROLES } = require('./middleware/auth');

    // Admin-only routes
    app.use('/api/users', authenticate, requireRole(ROLES.ADMIN), require('./routes/users'));

    // Role-protected routes - separate read and write permissions
    // Billing routes - read for GET, write for POST/PUT/DELETE
    app.use('/api/billing', authenticate, requirePermission('billing:read'), require('./routes/billing'));
    
    // Customer routes - check permissions per method
    const { authenticate: auth, requirePermission: perm } = require('./middleware/auth');
    const billingRoutes = require('./routes/billing');
    
    app.get('/api/customers', auth, perm('customers:read'), billingRoutes);
    app.get('/api/customers/:id', auth, perm('customers:read'), billingRoutes);
    app.post('/api/customers', auth, perm('customers:write'), billingRoutes);
    app.put('/api/customers/:id', auth, perm('customers:write'), billingRoutes);
    app.delete('/api/customers/:id', auth, perm('customers:write'), billingRoutes);

    // Network routes - separate read and write
    app.get('/api/network', authenticate, requirePermission('network:read'), require('./routes/network'));
    app.post('/api/network', authenticate, requirePermission('network:write'), require('./routes/network'));
    app.put('/api/network/*', authenticate, requirePermission('network:write'), require('./routes/network'));
    app.delete('/api/network/*', authenticate, requirePermission('network:write'), require('./routes/network'));

    // Standard authenticated routes
    app.use('/api/projects', authenticate, require('./routes/projects'));
    app.use('/api/modules', authenticate, require('./routes/modules'));
    app.use('/api/generator', authenticate, require('./routes/generator'));
    app.use('/api/templates', authenticate, require('./routes/templates'));
    app.use('/api/mikrotik', authenticate, require('./routes/mikrotik'));
    app.use('/api/devices', authenticate, require('./routes/devices'));
    app.use('/api/payments', authenticate, require('./routes/payments'));
    app.use('/api/sms', authenticate, require('./routes/sms'));
    app.use('/api/features', authenticate, require('./routes/features'));
    app.use('/api/portal', authenticate, require('./routes/customerPortal'));
    app.use('/api/advanced', authenticate, require('./routes/advanced'));
    app.use('/api/inventory', authenticate, require('./routes/inventory'));
    app.use('/api/analytics', authenticate, require('./routes/analytics'));
    app.use('/api/radius', authenticate, require('./routes/radius'));
    app.use('/api/tickets', authenticate, require('./routes/tickets'));
    app.use('/api/resellers', authenticate, require('./routes/resellers'));
    app.use('/api/integrations', authenticate, require('./routes/integrations'));
    app.use('/api/dashboard', authenticate, require('./routes/dashboard'));

    // Global error handler
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
    });

    // SPA catch-all route MUST be last - serves index.html for all non-API routes
    if (frontendPath) {
      app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    }

    // Start cron jobs
    let cronStarted = false;

    // Start auto-suspend cron
    if (!cronStarted) {
      try {
        const { startCron } = require('./cron/autoSuspend');
        startCron();
        cronStarted = true;
      } catch (e) {
        console.warn('⚠️  Could not start auto-suspend cron:', e.message);
      }
    }

    // Start metrics collection cron
    try {
      const { startCron: startMetricsCron } = require('./cron/collectMetrics');
      startMetricsCron();
    } catch (e) {
      console.warn('⚠️  Could not start metrics collection cron:', e.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Railway PostgreSQL' : process.env.DB_HOST ? 'Custom PostgreSQL' : dbAvailable ? 'PostgreSQL' : 'In-Memory (Preview Mode)'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
