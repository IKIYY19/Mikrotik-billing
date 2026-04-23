const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { loadEnv } = require('./config/loadEnv');
loadEnv();
const logger = require('./utils/logger');
const { validateSecrets } = require('./utils/security');
const { initSentry, sentryErrorHandler } = require('./services/sentry');

const isTestEnv = process.env.NODE_ENV === 'test';
const isProductionEnv = process.env.NODE_ENV === 'production';


// Prevent crashes from unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { error: reason?.message || reason });
  const Sentry = require('./services/sentry').Sentry;
  Sentry.captureException(reason, {
    tags: { type: 'unhandledRejection' },
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  const Sentry = require('./services/sentry').Sentry;
  Sentry.captureException(error, {
    tags: { type: 'uncaughtException' },
  });
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
const defaultDevCorsOrigins = ['http://localhost:5173', 'http://localhost:5174'];

function parseAllowedOrigins(rawOrigins) {
  const values = (rawOrigins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (values.length > 0) {
    return values;
  }

  return isProductionEnv ? [] : defaultDevCorsOrigins;
}

function createCorsOriginHandler() {
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);

  return (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  };
}

function applySecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

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
    if (isProductionEnv) {
      logger.error('PostgreSQL is required in production startup', { error: err.message });
      throw err;
    }
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
app.disable('x-powered-by');
app.set('trust proxy', isProductionEnv ? 1 : false);

// Middleware
app.use(cors({
  origin: createCorsOriginHandler(),
  credentials: true,
}));
app.use(applySecurityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting to all API routes
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);

// Start server
const startServer = async () => {
  try {
    if (!isTestEnv) {
      const secretsValid = validateSecrets();
      if (!secretsValid && isProductionEnv) {
        throw new Error('Security validation failed: configure non-default JWT_SECRET and ENCRYPTION_KEY');
      }
    }

    // Initialize Sentry as early as possible after env validation
    initSentry();
    // Initialize database FIRST
    await initDB();

    // Export for routes AFTER database is connected
    global.db = db;
    global.dbAvailable = dbAvailable;
    global.billingRepo = billingRepo;

    // Run database migrations automatically
    if (dbAvailable) {
      const { runMigrations } = require('./db/migrate');
      await runMigrations();
      logger.info('Database migrations done');
    } else {
      logger.info('Skipping SQL migrations while running in memory mode');
    }

    // Bootstrap initial admin only when the user table is empty
    try {
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');
      const userCount = await db.query('SELECT COUNT(*) FROM users');
      if (parseInt(userCount.rows[0].count) === 0) {
        const configuredAdminEmail = process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
        const configuredAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';

        if (isProductionEnv && (!configuredAdminEmail || !configuredAdminPassword)) {
          throw new Error('INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required for a fresh production deployment');
        }

        const adminEmail = configuredAdminEmail || 'admin@example.com';
        const adminPassword = configuredAdminPassword || 'admin123';
        const adminHash = await bcrypt.hash(adminPassword, 10);
        await db.query(
          `INSERT INTO users (id, email, password_hash, name, role, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)`,
          [uuidv4(), adminEmail, adminHash, 'Administrator', 'admin']
        );
        logger.info('Initial admin created', { email: adminEmail, passwordConfigured: Boolean(configuredAdminPassword) });
      } else {
        const adminEmail = process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminCheck = await db.query('SELECT id, email, role FROM users WHERE email = $1', [adminEmail]);
        if (adminCheck.rows.length > 0 && adminCheck.rows[0].role !== 'admin') {
          await db.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', adminEmail]);
          logger.info('Fixed admin role to "admin"');
        }
      }
    } catch (e) {
      if (isProductionEnv) {
        throw e;
      }
      logger.warn('Admin user creation/fix skipped', { error: e.message });
    }

    app.get('/api/live', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      });
    });

    app.get('/api/ready', async (req, res) => {
      try {
        const ready = !isProductionEnv || dbAvailable;
        const payload = {
          status: ready ? 'ok' : 'degraded',
          timestamp: new Date().toISOString(),
          database: dbAvailable ? 'connected' : 'memory',
          environment: process.env.NODE_ENV || 'development',
        };

        if (!ready) {
          return res.status(503).json(payload);
        }

        return res.json(payload);
      } catch (error) {
        logger.error('Readiness check failed', { error: error.message });
        return res.status(503).json({ status: 'error', message: 'Service unavailable' });
      }
    });

    // Enhanced health check endpoint
    app.get('/api/health', async (req, res) => {
      try {
        const uptime = process.uptime();
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: dbAvailable ? 'connected' : 'memory',
          readiness: !isProductionEnv || dbAvailable ? 'ready' : 'degraded',
          uptime: Math.floor(uptime),
          version: process.env.npm_package_version || '2.0.0',
          environment: process.env.NODE_ENV || 'development',
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
    const customerAliasRouter = express.Router();
    const resellerRoutes = require('./routes/resellers');
    const networkRoutes = require('./routes/network');

    customerAliasRouter.use((req, res, next) => {
      req.url = `/customers${req.url === '/' ? '' : req.url}`;
      next();
    });
    customerAliasRouter.use(billingRoutes);

    app.use('/api/customers', auth, (req, res, next) => {
      const permission = req.method === 'GET' ? 'customers:read' : 'customers:write';
      return perm(permission)(req, res, next);
    }, customerAliasRouter);

    const createPrefixedAliasRouter = (prefixResolver, targetRouter) => {
      const aliasRouter = express.Router();
      aliasRouter.use((req, res, next) => {
        const suffix = req.url === '/' ? '' : req.url;
        req.url = prefixResolver(suffix);
        next();
      });
      aliasRouter.use(targetRouter);
      return aliasRouter;
    };

    const requireNetworkPermission = (req, res, next) => {
      const permission = req.method === 'GET' ? 'network:read' : 'network:write';
      return perm(permission)(req, res, next);
    };

    const networkAliasRouter = createPrefixedAliasRouter((suffix) => {
      if (suffix.startsWith('/pppoe/') || suffix.startsWith('/hotspot/')) {
        return suffix;
      }
      return `/network${suffix}`;
    }, networkRoutes);
    const pppoeAliasRouter = createPrefixedAliasRouter((suffix) => `/pppoe${suffix}`, networkRoutes);
    const hotspotAliasRouter = createPrefixedAliasRouter((suffix) => `/hotspot${suffix}`, networkRoutes);
    const captivePortalAliasRouter = createPrefixedAliasRouter((suffix) => `/captive-portals${suffix}`, resellerRoutes);

    app.use('/api/network', authenticate, requireNetworkPermission, networkAliasRouter);
    app.use('/api/pppoe', authenticate, requireNetworkPermission, pppoeAliasRouter);
    app.use('/api/hotspot', authenticate, requireNetworkPermission, hotspotAliasRouter);
    app.use('/api/captive-portals', authenticate, captivePortalAliasRouter);

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
    app.use('/api/resellers', authenticate, resellerRoutes);
    app.use('/api/olt', authenticate, require('./routes/olt'));
    app.use('/api/integrations', authenticate, require('./routes/integrations'));
    app.use('/api/dashboard', authenticate, require('./routes/dashboard'));

    // Sentry error handler (MUST be before global error handler)
    app.use(sentryErrorHandler());

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

    if (!isTestEnv) {
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

      const server = app.listen(PORT, () => {
        logger.info('Server started', { 
          port: PORT, 
          environment: process.env.NODE_ENV || 'development',
          database: dbAvailable ? 'postgres' : 'memory'
        });
        
        // Initialize WebSocket service for real-time monitoring
        const websocketService = require('./services/websocketService');
        websocketService.initialize(server);
        
        logger.info('WebSocket service initialized for real-time bandwidth monitoring');
      });
    }
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    if (isTestEnv) {
      throw error;
    }
    process.exit(1);
  }
};

const ready = startServer();

module.exports = app;
module.exports.ready = ready;
