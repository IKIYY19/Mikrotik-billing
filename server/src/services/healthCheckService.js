/**
 * Health Check Service
 * Periodically monitors MikroTik router health and creates alerts
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Health check intervals (in milliseconds)
const CHECK_INTERVALS = {
  connectivity: 60000, // 1 minute
  resources: 300000, // 5 minutes
  bandwidth: 600000, // 10 minutes
};

// Alert types
const ALERT_TYPES = {
  ROUTER_OFFLINE: 'router_offline',
  HIGH_CPU: 'high_cpu',
  HIGH_MEMORY: 'high_memory',
  HIGH_LATENCY: 'high_latency',
  INTERFACE_DOWN: 'interface_down',
  BANDWIDTH_EXCEEDED: 'bandwidth_exceeded',
};

// Severity levels
const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

class HealthCheckService {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
  }

  // Get database connection
  getDb() {
    return global.dbAvailable ? global.db : require('../db/memory');
  }

  // Start health checks for all connections (opt-in - disabled by default)
  async start() {
    if (this.isRunning) {
      logger.warn('Health check service already running');
      return;
    }

    logger.info('Health check service is ready - use startConnectionChecks() to enable monitoring for specific connections');
    this.isRunning = true;
  }

  // Stop all health checks
  stop() {
    logger.info('Stopping health check service');
    this.isRunning = false;
    
    for (const [connectionId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  // Start checks for a specific connection
  startConnectionChecks(connectionId) {
    if (this.intervals.has(connectionId)) {
      this.stopConnectionChecks(connectionId);
    }

    // Connectivity check (every minute)
    const connectivityInterval = setInterval(() => {
      this.checkConnectivity(connectionId);
    }, CHECK_INTERVALS.connectivity);
    this.intervals.set(`${connectionId}_connectivity`, connectivityInterval);

    // Resource check (every 5 minutes)
    const resourcesInterval = setInterval(() => {
      this.checkResources(connectionId);
    }, CHECK_INTERVALS.resources);
    this.intervals.set(`${connectionId}_resources`, resourcesInterval);

    // Bandwidth check (every 10 minutes)
    const bandwidthInterval = setInterval(() => {
      this.checkBandwidth(connectionId);
    }, CHECK_INTERVALS.bandwidth);
    this.intervals.set(`${connectionId}_bandwidth`, bandwidthInterval);

    logger.info('Started health checks for connection', { connectionId });
  }

  // Stop checks for a specific connection
  stopConnectionChecks(connectionId) {
    const keys = [
      `${connectionId}_connectivity`,
      `${connectionId}_resources`,
      `${connectionId}_bandwidth`,
    ];

    for (const key of keys) {
      if (this.intervals.has(key)) {
        clearInterval(this.intervals.get(key));
        this.intervals.delete(key);
      }
    }

    logger.info('Stopped health checks for connection', { connectionId });
  }

  // Check router connectivity
  async checkConnectivity(connectionId) {
    try {
      const db = this.getDb();
      const now = new Date();
      
      // Get connection details
      const connectionResult = await db.query(
        'SELECT id, name, ip_address FROM mikrotik_connections WHERE id = $1',
        [connectionId]
      );

      if (connectionResult.rows.length === 0) {
        logger.warn('Connection not found for health check', { connectionId });
        return;
      }

      const connection = connectionResult.rows[0];
      
      // Simulate connectivity check (replace with actual MikroTik API call)
      const isOnline = await this.testConnection(connection);
      
      // Record health check
      await db.query(
        `INSERT INTO health_checks (id, connection_id, check_type, status, latency_ms, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), connectionId, 'connectivity', isOnline ? 'healthy' : 'unhealthy', isOnline ? Math.random() * 50 + 5 : null, now.toISOString()]
      );

      // Create alert if offline
      if (!isOnline) {
        await this.createAlert(connectionId, ALERT_TYPES.ROUTER_OFFLINE, SEVERITY.CRITICAL, 
          'Router Offline', `Router ${connection.name} (${connection.ip_address}) is not responding`);
      } else {
        // Resolve any open offline alerts
        await this.resolveAlerts(connectionId, ALERT_TYPES.ROUTER_OFFLINE);
      }

      logger.debug('Connectivity check completed', { connectionId, isOnline });
    } catch (error) {
      logger.error('Connectivity check failed', { connectionId, error: error.message });
    }
  }

  // Check router resources (CPU, memory)
  async checkResources(connectionId) {
    try {
      const db = this.getDb();
      const now = new Date();
      
      // Get monitoring rules for this connection
      const rulesResult = await db.query(
        'SELECT rule_type, threshold_value, comparison_operator, alert_severity FROM monitoring_rules WHERE connection_id = $1 AND is_enabled = true',
        [connectionId]
      );

      const rules = rulesResult.rows;
      
      // Simulate resource metrics (replace with actual MikroTik API call)
      const cpuUsage = Math.random() * 100;
      const memoryUsage = Math.random() * 100;
      
      // Record health check
      await db.query(
        `INSERT INTO health_checks (id, connection_id, check_type, status, cpu_usage, memory_usage, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), connectionId, 'resources', cpuUsage > 90 || memoryUsage > 90 ? 'warning' : 'healthy', cpuUsage, memoryUsage, now.toISOString()]
      );

      // Check against rules
      for (const rule of rules) {
        if (rule.rule_type === 'high_cpu' && this.checkThreshold(cpuUsage, rule.threshold_value, rule.comparison_operator)) {
          await this.createAlert(connectionId, ALERT_TYPES.HIGH_CPU, rule.alert_severity,
            'High CPU Usage', `CPU usage is ${cpuUsage.toFixed(1)}% (threshold: ${rule.threshold_value}%)`);
        }
        
        if (rule.rule_type === 'high_memory' && this.checkThreshold(memoryUsage, rule.threshold_value, rule.comparison_operator)) {
          await this.createAlert(connectionId, ALERT_TYPES.HIGH_MEMORY, rule.alert_severity,
            'High Memory Usage', `Memory usage is ${memoryUsage.toFixed(1)}% (threshold: ${rule.threshold_value}%)`);
        }
      }

      logger.debug('Resource check completed', { connectionId, cpuUsage, memoryUsage });
    } catch (error) {
      logger.error('Resource check failed', { connectionId, error: error.message });
    }
  }

  // Check bandwidth usage
  async checkBandwidth(connectionId) {
    try {
      const db = this.getDb();
      const now = new Date();
      
      // Simulate bandwidth metrics (replace with actual MikroTik API call)
      const bandwidthUsage = {
        download: Math.random() * 1000,
        upload: Math.random() * 500,
      };
      
      // Record health check
      await db.query(
        `INSERT INTO health_checks (id, connection_id, check_type, status, bandwidth_usage, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), connectionId, 'bandwidth', 'healthy', JSON.stringify(bandwidthUsage), now.toISOString()]
      );

      logger.debug('Bandwidth check completed', { connectionId, bandwidthUsage });
    } catch (error) {
      logger.error('Bandwidth check failed', { connectionId, error: error.message });
    }
  }

  // Test connection to router (placeholder - implement actual MikroTik API call)
  async testConnection(connection) {
    // In production, this would use the actual MikroTik API
    // For now, simulating with random success
    return Math.random() > 0.1; // 90% success rate
  }

  // Check if value meets threshold condition
  checkThreshold(value, threshold, operator) {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      default: return value > threshold;
    }
  }

  // Create an alert
  async createAlert(connectionId, alertType, severity, title, message) {
    try {
      const db = this.getDb();
      
      // Check if there's already an open alert of this type for this connection
      const existingAlert = await db.query(
        `SELECT id FROM alerts 
         WHERE connection_id = $1 AND alert_type = $2 AND status = 'open'
         ORDER BY created_at DESC LIMIT 1`,
        [connectionId, alertType]
      );

      if (existingAlert.rows.length > 0) {
        // Alert already exists, don't create duplicate
        return;
      }

      // Create new alert
      await db.query(
        `INSERT INTO alerts (id, connection_id, alert_type, severity, title, message, status, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uuidv4(), connectionId, alertType, severity, title, message, 'open', '{}', new Date().toISOString()]
      );

      logger.info('Alert created', { connectionId, alertType, severity, title });
      
      // Trigger notifications (to be implemented)
      await this.sendNotifications(connectionId, alertType, severity, title, message);
    } catch (error) {
      logger.error('Failed to create alert', { connectionId, alertType, error: error.message });
    }
  }

  // Resolve open alerts
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
      logger.error('Failed to resolve alerts', { connectionId, alertType, error: error.message });
    }
  }

  // Send notifications (placeholder - integrate with SMS/Email/WhatsApp services)
  async sendNotifications(connectionId, alertType, severity, title, message) {
    try {
      const db = this.getDb();
      
      // Get enabled notification channels for admin users
      const channelsResult = await db.query(
        `SELECT nc.channel_type, nc.config, u.email 
         FROM notification_channels nc
         JOIN users u ON u.id = nc.user_id
         WHERE nc.is_enabled = true AND u.role = 'admin'`
      );

      for (const channel of channelsResult.rows) {
        if (channel.channel_type === 'email') {
          // Send email notification
          logger.info('Sending email notification', { email: channel.email, title });
          // Integrate with your existing email service
        } else if (channel.channel_type === 'sms') {
          // Send SMS notification
          logger.info('Sending SMS notification', { phone: channel.config.phone, title });
          // Integrate with your existing SMS service
        } else if (channel.channel_type === 'whatsapp') {
          // Send WhatsApp notification
          logger.info('Sending WhatsApp notification', { phone: channel.config.phone, title });
          // Integrate with your existing WhatsApp service
        }
      }
    } catch (error) {
      logger.error('Failed to send notifications', { error: error.message });
    }
  }
}

// Singleton instance
const healthCheckService = new HealthCheckService();

module.exports = healthCheckService;
