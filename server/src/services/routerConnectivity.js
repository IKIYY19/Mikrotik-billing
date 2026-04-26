/**
 * Router Connectivity Service (Phase 1 - Basic Online/Offline)
 * Simple service to check if MikroTik routers are online
 * Phase 2: Creates alerts when routers go offline
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Check interval in milliseconds (2 minutes)
const CHECK_INTERVAL = 2 * 60 * 1000;

// Alert types
const ALERT_TYPES = {
  ROUTER_OFFLINE: 'router_offline',
  ROUTER_ONLINE: 'router_online',
};

// Severity levels
const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
};

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
        'SELECT id, name, ip_address, api_port, ssh_port, username, password_encrypted, connection_type, is_online FROM mikrotik_connections WHERE id = $1',
        [connectionId]
      );

      if (connectionResult.rows.length === 0) {
        logger.warn('Connection not found for connectivity check', { connectionId });
        return;
      }

      const connection = connectionResult.rows[0];
      const wasOnline = connection.is_online;
      let isOnline = false;

      // Use real MikroTik connection test based on connection type
      if (connection.connection_type === 'ssh') {
        isOnline = await this.testSSHConnection(connection);
      } else {
        isOnline = await this.testAPIConnection(connection);
      }
      
      // Update connection status
      await db.query(
        `UPDATE mikrotik_connections 
         SET is_online = $1, last_seen = $2 
         WHERE id = $3`,
        [isOnline, now.toISOString(), connectionId]
      );

      // Create alert if status changed
      if (wasOnline && !isOnline) {
        await this.createAlert(connectionId, ALERT_TYPES.ROUTER_OFFLINE, SEVERITY.CRITICAL,
          'Router Offline', `Router ${connection.name} (${connection.ip_address}) is not responding`);
      } else if (!wasOnline && isOnline) {
        await this.createAlert(connectionId, ALERT_TYPES.ROUTER_ONLINE, SEVERITY.INFO,
          'Router Online', `Router ${connection.name} (${connection.ip_address}) is back online`);
        // Resolve any open offline alerts
        await this.resolveAlerts(connectionId, ALERT_TYPES.ROUTER_OFFLINE);
      }

      logger.debug('Connectivity check completed', { connectionId, isOnline });
    } catch (error) {
      logger.error('Connectivity check failed', { connectionId, error: error.message });
    }
  }

  // Create an alert
  async createAlert(connectionId, alertType, severity, title, message) {
    try {
      const db = this.getDb();
      await db.query(
        `INSERT INTO alerts (id, connection_id, alert_type, severity, title, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)`,
        [uuidv4(), connectionId, alertType, severity, title, message, new Date().toISOString()]
      );
      logger.info('Alert created', { connectionId, alertType, severity, title });
    } catch (error) {
      // Don't crash if alert creation fails - log and continue
      logger.error('Failed to create alert (non-critical)', { connectionId, alertType, error: error.message });
    }
  }

  // Resolve alerts for a specific connection and type
  async resolveAlerts(connectionId, alertType) {
    try {
      const db = this.getDb();
      await db.query(
        `UPDATE alerts 
         SET status = 'resolved', resolved_at = $1 
         WHERE connection_id = $2 AND alert_type = $3 AND status = 'open'`,
        [new Date().toISOString(), connectionId, alertType]
      );
      logger.info('Alerts resolved', { connectionId, alertType });
    } catch (error) {
      // Don't crash if alert resolution fails - log and continue
      logger.error('Failed to resolve alerts (non-critical)', { connectionId, alertType, error: error.message });
    }
  }

  // Test MikroTik API connection
  async testAPIConnection(connection) {
    try {
      const MikroNode = require('mikronode');
      const crypto = require('crypto');
      
      logger.info('Testing API connection', { connectionId: connection.id, ip: connection.ip_address });
      
      // Decrypt password
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-bytes-long!!', 'utf8').slice(0, 32);
      const iv = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-bytes-long!!', 'utf8').slice(0, 16);
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let password = decipher.update(connection.password_encrypted, 'hex', 'utf8');
      password += decipher.final('utf8');

      logger.info('Attempting MikroTik API connection', { 
        connectionId: connection.id, 
        ip: connection.ip_address, 
        port: connection.api_port || 8728,
        username: connection.username 
      });

      const device = new MikroNode(connection.ip_address, { port: connection.api_port || 8728 });
      const conn = await device.connect(connection.username, password);
      conn.close();
      
      logger.info('API connection successful', { connectionId: connection.id });
      return true;
    } catch (error) {
      logger.error('API connection test failed', { connectionId: connection.id, error: error.message, stack: error.stack });
      return false;
    }
  }

  // Test MikroTik SSH connection
  async testSSHConnection(connection) {
    try {
      const { NodeSSH } = require('node-ssh');
      const crypto = require('crypto');
      
      logger.info('Testing SSH connection', { connectionId: connection.id, ip: connection.ip_address });
      
      // Decrypt password
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-bytes-long!!', 'utf8').slice(0, 32);
      const iv = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-bytes-long!!', 'utf8').slice(0, 16);
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let password = decipher.update(connection.password_encrypted, 'hex', 'utf8');
      password += decipher.final('utf8');

      logger.info('Attempting SSH connection', { 
        connectionId: connection.id, 
        ip: connection.ip_address, 
        port: connection.ssh_port || 22,
        username: connection.username 
      });

      const ssh = new NodeSSH();
      await ssh.connect({
        host: connection.ip_address,
        port: connection.ssh_port || 22,
        username: connection.username,
        password: password,
        readyTimeout: 10000,
      });
      
      // Execute a simple command to verify connection
      await ssh.execCommand('/system resource print');
      ssh.dispose();
      
      logger.info('SSH connection successful', { connectionId: connection.id });
      return true;
    } catch (error) {
      logger.error('SSH connection test failed', { connectionId: connection.id, error: error.message, stack: error.stack });
      return false;
    }
  }

  // Manual check for a specific connection (returns result immediately)
  async checkConnectionNow(connectionId) {
    return await this.checkConnection(connectionId);
  }
}

// Singleton instance
const routerConnectivityService = new RouterConnectivityService();

module.exports = routerConnectivityService;
