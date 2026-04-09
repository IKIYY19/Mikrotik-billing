const { Pool } = require('pg');
require('dotenv').config();

// Support multiple database URL formats (Railway, Render, etc.)
let dbConfig;

if (process.env.DATABASE_URL) {
  // Railway, Heroku, Render style
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
} else if (process.env.DB_HOST || process.env.PGHOST) {
  // Manual config or Dokploy style
  dbConfig = {
    host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
    port: process.env.DB_PORT || process.env.PGPORT || 5432,
    database: process.env.DB_NAME || process.env.PGDATABASE || 'mikrotik_config_builder',
    user: process.env.DB_USER || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
} else {
  // Fallback to localhost for local development
  dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'mikrotik_config_builder',
    user: 'postgres',
    password: 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log('Database connected successfully');
});

// Handle pool errors gracefully (don't crash the server)
pool.on('error', (err) => {
  console.error('⚠️  Database pool error:', err.message);
  // Don't exit - let the server continue with fallback behavior
});

module.exports = {
  query: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error('⚠️  Database query error:', err.message);
      throw err;
    }
  },
  pool,
};
