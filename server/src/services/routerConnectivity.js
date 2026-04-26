/**
 * Router Connectivity Service (Phase 1 - Basic Online/Offline)
 * Simple service to check if MikroTik routers are online
 */

const logger = require('../utils/logger');

// Check interval in milliseconds (2 minutes)
const CHECK_INTERVAL = 2 * 60 * 1000;

class RouterConnectivityService {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
  }

  // Get database connection
  getDb() {
    return global.dbAvailable ? global.db : require('../db/memory');
  }

  // Start connectivity checks for all connections
  async start() {
    if (this.isRunning) {
      logger.warn('Router connectivity service already running');
      return;
    }

    logger.info('Starting router connectivity service');
    this.isRunning = true;

    try {
      const db = this.getDb();
      const result = await db.query('SELECT id FROM mikrotik_connections');
      
      for (const row of result.rows) {
        this.startConnectionCheck(row.id);
      }

      logger.info(`Started connectivity checks for ${result.rows.length} connections`);
    } catch (error) {
      logger.error('Failed to start connectivity checks', { error: error.message });
      // Don't throw - allow server to start even if this fails
    }
  }

  // Stop all connectivity checks
  stop() {
    logger.info('Stopping router connectivity service');
    this.isRunning = false;
    
    for (const [connectionId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  // Start check for a specific connection
  startConnectionCheck(connectionId) {
    if (this.intervals.has(connectionId)) {
      this.stopConnectionCheck(connectionId);
    }

    const interval = setInterval(() => {
      this.checkConnection(connectionId);
    }, CHECK_INTERVAL);
    
    this.intervals.set(connectionId, interval);
    logger.info('Started connectivity check for connection', { connectionId });
  }

  // Stop check for a specific connection
  stopConnectionCheck(connectionId) {
    if (this.intervals.has(connectionId)) {
      clearInterval(this.intervals.get(connectionId));
      this.intervals.delete(connectionId);
      logger.info('Stopped connectivity check for connection', { connectionId });
    }
  }

  // Check if a connection is online
  async checkConnection(connectionId) {
    try {
      const db = this.getDb();
      const now = new Date();
      
      // Get connection details
      const connectionResult = await db.query(
        'SELECT id, name, ip_address FROM mikrotik_connections WHERE id = $1',
        [connectionId]
      );

      if (connectionResult.rows.length === 0) {
        logger.warn('Connection not found for connectivity check', { connectionId });
        return;
      }

      const connection = connectionResult.rows[0];
      
      // Simple ping check (replace with actual MikroTik API call later)
      // For now, we'll simulate with a random success rate
      const isOnline = Math.random() > 0.1; // 90% success rate for testing
      
      // Update connection status
      await db.query(
        `UPDATE mikrotik_connections 
         SET is_online = $1, last_seen = $2 
         WHERE id = $3`,
        [isOnline, now.toISOString(), connectionId]
      );

      logger.debug('Connectivity check completed', { connectionId, isOnline });
    } catch (error) {
      logger.error('Connectivity check failed', { connectionId, error: error.message });
    }
  }
}

// Singleton instance
const routerConnectivityService = new RouterConnectivityService();

module.exports = routerConnectivityService;
