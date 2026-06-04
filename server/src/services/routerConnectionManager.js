const logger = require("../utils/logger");

class RouterConnectionManager {
  constructor() {
    this.connections = new Map();
    this.queues = new Map();
    this.startIdleCleanup();
  }

  // Retrieve database connection
  getDb() {
    return global.dbAvailable ? global.db : require("../db/memory");
  }

  // Decrypt encrypted password
  decryptPassword(encrypted) {
    return require("../utils/encryption").decrypt(encrypted) || encrypted || "";
  }

  // Fetch router details from the database
  async fetchRouterConfig(routerId) {
    const db = this.getDb();
    const result = await db.query(
      "SELECT * FROM mikrotik_connections WHERE id = $1",
      [routerId]
    );
    return result.rows[0] || null;
  }

  // Get an existing cached connection or establish a new one
  async getOrCreateConnection(routerIdOrConfig) {
    let config = null;
    let routerId = null;

    if (typeof routerIdOrConfig === "string") {
      routerId = routerIdOrConfig;
      config = await this.fetchRouterConfig(routerId);
    } else {
      config = routerIdOrConfig;
      routerId = config.id || config.ip_address;
    }

    if (!config) {
      throw new Error("Router configuration not found");
    }

    // Check cached connection
    if (this.connections.has(routerId)) {
      const connObj = this.connections.get(routerId);
      connObj.lastUsed = Date.now();
      return connObj;
    }

    const password = this.decryptPassword(config.password_encrypted || config.password);
    const isSSL = config.connection_type === "api-ssl" || (config.api_port && Number(config.api_port) === 8729);
    const defaultPort = isSSL ? 8729 : 8728;
    const port = Number(config.api_port || defaultPort);

    logger.info(`Establishing new MikroTik connection to ${config.name || config.ip_address} on port ${port} (SSL: ${isSSL})`);

    const MikroNode = require("mikronode");
    const device = new MikroNode(config.ip_address, {
      port,
      ssl: isSSL,
      timeout: 5000, // 5s timeout for initial connect
    });

    const connection = await device.connect(config.username, password);

    const connObj = {
      connection,
      config,
      created: Date.now(),
      lastUsed: Date.now(),
    };

    this.connections.set(routerId, connObj);
    return connObj;
  }

  // Execute a command sequentially (using promise queuing) on the connection
  async executeCommand(routerIdOrConfig, command, args = {}) {
    let routerId = typeof routerIdOrConfig === "string" ? routerIdOrConfig : routerIdOrConfig.id;
    if (!routerId && typeof routerIdOrConfig === "object") {
      routerId = routerIdOrConfig.ip_address || "temp";
    }

    // Enforce sequential command execution per router
    if (!this.queues.has(routerId)) {
      this.queues.set(routerId, Promise.resolve());
    }

    const queuePromise = this.queues.get(routerId);
    const resultPromise = queuePromise.then(async () => {
      let retries = 1;
      while (retries >= 0) {
        let connObj = null;
        try {
          connObj = await this.getOrCreateConnection(routerIdOrConfig);
          const channel = connObj.connection.openChannel();
          channel.write(command, args);
          const result = await channel.done;
          connObj.lastUsed = Date.now();
          return result;
        } catch (error) {
          logger.warn(`Command execution failed on router ${routerId}: ${error.message}. Retries left: ${retries}`);
          this.closeConnection(routerId);
          if (retries === 0) {
            throw error;
          }
          retries--;
        }
      }
    });

    // Capture rejection on the queue level to prevent blocking subsequent commands
    this.queues.set(routerId, resultPromise.catch(() => {}));

    return resultPromise;
  }

  // Execute command but gracefully handle errors by returning a fallback value
  async executeCommandSafe(routerIdOrConfig, command, args = {}, fallback = []) {
    try {
      const result = await this.executeCommand(routerIdOrConfig, command, args);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      logger.debug(`Safe execution failed for command ${command}: ${error.message}`);
      return fallback;
    }
  }

  // Print command shorthand
  async print(routerIdOrConfig, path, proplist = null) {
    const args = proplist ? { ".proplist": proplist } : {};
    const result = await this.executeCommand(routerIdOrConfig, `${path}/print`, args);
    return Array.isArray(result) ? result : [];
  }

  // Close and delete a cached connection
  closeConnection(routerId) {
    if (this.connections.has(routerId)) {
      const connObj = this.connections.get(routerId);
      try {
        connObj.connection.close();
      } catch (err) {
        logger.debug(`Error closing MikroTik connection for router ${routerId}: ${err.message}`);
      }
      this.connections.delete(routerId);
    }
  }

  // Close all cached connections
  closeAll() {
    for (const routerId of this.connections.keys()) {
      this.closeConnection(routerId);
    }
  }

  // Test credentials/API connection without caching
  async testConnection(config) {
    const password = this.decryptPassword(config.password_encrypted || config.password);
    const isSSL = config.connection_type === "api-ssl" || (config.api_port && Number(config.api_port) === 8729);
    const defaultPort = isSSL ? 8729 : 8728;
    const port = Number(config.api_port || defaultPort);

    const MikroNode = require("mikronode");
    const device = new MikroNode(config.ip_address, {
      port,
      ssl: isSSL,
      timeout: 5000,
    });

    const connection = await device.connect(config.username, password);
    connection.close();
    return true;
  }

  // Test SSH connection
  async testSSHConnection(config) {
    const { NodeSSH } = require("node-ssh");
    const password = this.decryptPassword(config.password_encrypted || config.password);
    const ssh = new NodeSSH();
    await ssh.connect({
      host: config.ip_address,
      port: Number(config.ssh_port || 22),
      username: config.username,
      password: password,
      readyTimeout: 10000,
    });
    await ssh.execCommand("/system resource print");
    ssh.dispose();
    return true;
  }

  // Setup idle connections manager
  startIdleCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const idleTimeout = 2 * 60 * 1000; // 2 minutes

      for (const [routerId, connObj] of this.connections.entries()) {
        if (now - connObj.lastUsed > idleTimeout) {
          logger.info(`Closing idle MikroTik connection to ${connObj.config.name || connObj.config.ip_address}`);
          this.closeConnection(routerId);
        }
      }
    }, 30000); // 30s interval
    
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}

module.exports = new RouterConnectionManager();
