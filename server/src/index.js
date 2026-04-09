const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

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

// Export for routes
global.db = db;
global.dbAvailable = dbAvailable;
global.billingRepo = billingRepo;

const { runMigrations } = { runMigrations: async () => {} };

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/projects', require('./routes/projects'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/generator', require('./routes/generator'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/mikrotik', require('./routes/mikrotik'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/features', require('./routes/features'));
app.use('/api/portal', require('./routes/customerPortal'));
app.use('/api/advanced', require('./routes/advanced'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/network', require('./routes/network'));
app.use('/api/radius', require('./routes/radius'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/resellers', require('./routes/resellers'));
app.use('/mikrotik', require('./routes/provision'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), database: dbAvailable ? 'postgres' : 'memory' });
});

// Serve static frontend (frontend is always bundled in Docker)
const fs = require('fs');

// Try multiple possible paths for the built frontend
const possiblePaths = [
  path.join(__dirname, '..', '..', 'client', 'dist'),  // Docker: /app/server/src/../.. -> /app/client/dist
  path.join(__dirname, '..', 'client', 'dist'),        // Docker alt: /app/server/src/.. -> /app/server/client/dist
  path.join(process.cwd(), 'client', 'dist'),          // Absolute: /app/client/dist
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

// Start server
const startServer = async () => {
  try {
    await initDB();

    global.db = db;
    global.dbAvailable = dbAvailable;
    global.billingRepo = billingRepo;

    // Start auto-suspend cron
    if (!cronStarted) {
      try {
        const { startCron } = require('./cron/autoSuspend');
        startCron();
        cronStarted = true;
      } catch (e) {
        console.warn('⚠️  Could not start cron:', e.message);
      }
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
