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

// Public health endpoint (defined outside startServer to ensure it's always available)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), database: global.dbAvailable ? 'postgres' : 'memory' });
});

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
      }
    } catch (e) {
      console.warn('⚠️  Admin user creation skipped:', e.message);
    }

    // Public routes (no auth required)
    app.use('/api/auth', require('./routes/auth'));
    app.use('/mikrotik', require('./routes/provision'));
    app.use('/api/portal/auth', require('./routes/customerAuth'));

    // Protected routes (require authentication)
    const { authenticate, requirePermission, requireRole, ROLES } = require('./middleware/auth');

    app.use(authenticate);

    // Admin-only routes
    app.use('/api/users', requireRole(ROLES.ADMIN), require('./routes/users'));

    // Role-protected routes
    app.use('/api/billing', requirePermission('billing:read'), require('./routes/billing'));
    app.use('/api/network', requirePermission('network:read'), require('./routes/network'));
    app.use('/api/customers', requirePermission('customers:read'), require('./routes/billing'));

    // Standard authenticated routes
    app.use('/api/projects', require('./routes/projects'));
    app.use('/api/modules', require('./routes/modules'));
    app.use('/api/generator', require('./routes/generator'));
    app.use('/api/templates', require('./routes/templates'));
    app.use('/api/mikrotik', require('./routes/mikrotik'));
    app.use('/api/devices', require('./routes/devices'));
    app.use('/api/payments', require('./routes/payments'));
    app.use('/api/sms', require('./routes/sms'));
    app.use('/api/features', require('./routes/features'));
    app.use('/api/portal', require('./routes/customerPortal'));
    app.use('/api/advanced', require('./routes/advanced'));
    app.use('/api/inventory', require('./routes/inventory'));
    app.use('/api/analytics', require('./routes/analytics'));
    app.use('/api/radius', require('./routes/radius'));
    app.use('/api/tickets', require('./routes/tickets'));
    app.use('/api/resellers', require('./routes/resellers'));

    // Serve static frontend (frontend is always bundled in Docker)
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'client', 'dist'),
      path.join(__dirname, '..', 'client', 'dist'),
      path.join(process.cwd(), 'client', 'dist'),
    ];

    let frontendPath = possiblePaths.find(p => fs.existsSync(path.join(p, 'index.html')));

    if (frontendPath) {
      console.log(`📦 Serving frontend from: ${frontendPath}`);
      app.use(express.static(frontendPath));

      // Catch-all: serve index.html for all non-API routes (SPA routing)
      app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    } else {
      console.warn('⚠️  Frontend dist not found, skipping static file serving');
    }

    // Global error handler
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
    });

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
