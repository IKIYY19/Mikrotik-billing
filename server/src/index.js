const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const logger = require('./utils/logger');

dotenv.config();

// Prevent crashes from unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { error: reason?.message || reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
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
    logger.info('Using PostgreSQL database');

    // Load billing repo
    billingRepo = require('./db/billingRepository');
  } catch (err) {
    logger.warn('PostgreSQL not available, using in-memory storage', { error: err.message });
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

// Apply general rate limiting to all API routes
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);

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
      logger.info('Core migrations done');
    } catch (e) {
      logger.warn('Core migrations skipped', { error: e.message });
    }

    try {
      const { runAuthMigrations } = require('./db/authMigrations');
      await runAuthMigrations();
      logger.info('Auth migrations done');
    } catch (e) {
      logger.warn('Auth migrations skipped', { error: e.message });
    }

    // Run billing migrations
    try {
      const { billingMigrations } = require('./db/billingMigrations');
      for (const migration of billingMigrations) {
        await db.query(migration);
      }
      logger.info('Billing migrations done');
    } catch (e) {
      logger.warn('Billing migrations skipped', { error: e.message });
    }

    // Run integrations migration
    try {
      const { runIntegrationsMigration } = require('./db/integrationsMigration');
      await runIntegrationsMigration();
      logger.info('Integrations migration done');
    } catch (e) {
      logger.warn('Integrations migration skipped', { error: e.message });
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
        logger.info('Default admin created', { email: 'admin@example.com', passwordSet: !!process.env.ADMIN_PASSWORD });
      } else {
        // Ensure admin user has correct role
        const adminCheck = await db.query('SELECT id, email, role FROM users WHERE email = $1', ['admin@example.com']);
        if (adminCheck.rows.length > 0 && adminCheck.rows[0].role !== 'admin') {
          await db.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', 'admin@example.com']);
          logger.info('Fixed admin role to "admin"');
        }
      }
    } catch (e) {
      logger.warn('Admin user creation/fix skipped', { error: e.message });
    }

    // Enhanced health check endpoint
    app.get('/api/health', async (req, res) => {
      try {
        const dbCheck = dbAvailable ? 'connected' : 'memory';
        const uptime = process.uptime();
        res.json({ 
          status: 'ok', 
          timestamp: new Date().toISOString(), 
          database: dbCheck,
          uptime: Math.floor(uptime),
          version: process.env.npm_package_version || '2.0.0',
          environment: process.env.NODE_ENV || 'development'
        });
      } catch (error) {
        logger.error('Health check failed', { error: error.message });
        res.status(503).json({ status: 'error', message: 'Service unavailable' });
      }
    });

    // Public routes (no auth required)
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
      logger.info('Serving frontend', { path: frontendPath });
      app.use(express.static(frontendPath));
    } else {
      logger.warn('Frontend dist not found, skipping static file serving');
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

    // PPPoE and Hotspot route aliases (frontend calls these directly)
    app.use('/api/pppoe', authenticate, require('./routes/network'));
    app.use('/api/hotspot', authenticate, require('./routes/network'));

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
      logger.error('Unhandled error', { 
        error: err.message, 
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
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
        logger.info('Auto-suspend cron started');
        cronStarted = true;
      } catch (e) {
        logger.warn('Could not start auto-suspend cron', { error: e.message });
      }
    }

    // Start metrics collection cron
    try {
      const { startCron: startMetricsCron } = require('./cron/collectMetrics');
      startMetricsCron();
      logger.info('Metrics collection cron started');
    } catch (e) {
      logger.warn('Could not start metrics collection cron', { error: e.message });
    }

    app.listen(PORT, () => {
      logger.info('Server started', { 
        port: PORT, 
        environment: process.env.NODE_ENV || 'development',
        database: dbAvailable ? 'postgres' : 'memory'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

startServer();

module.exports = app;
