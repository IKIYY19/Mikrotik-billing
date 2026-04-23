const WebSocket = require('ws');
const logger = require('../utils/logger');
const { MikroTikAPI } = require('./mikrotik');

class BandwidthWebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.bandwidthData = new Map();
    this.collectionInterval = null;
    this.isRunning = false;
  }

  initialize(server) {
    try {
      this.wss = new WebSocket.Server({ server });
      
      this.wss.on('connection', (ws, req) => {
        const clientId = this.generateClientId();
        const clientInfo = {
          id: clientId,
          ws: ws,
          ip: req.socket.remoteAddress,
          connectedAt: new Date(),
          subscriptions: new Set()
        };
        
        this.clients.set(clientId, clientInfo);
        logger.info('WebSocket client connected', { clientId, ip: req.socket.remoteAddress });
        
        // Send initial data
        this.sendInitialData(clientId);
        
        ws.on('message', (message) => {
          this.handleMessage(clientId, message);
        });
        
        ws.on('close', () => {
          this.clients.delete(clientId);
          logger.info('WebSocket client disconnected', { clientId });
        });
        
        ws.on('error', (error) => {
          logger.error('WebSocket error', { clientId, error: error.message });
          this.clients.delete(clientId);
        });
      });
      
      // Start bandwidth collection
      this.startBandwidthCollection();
      
      logger.info('Bandwidth WebSocket service initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket service', { error: error.message });
    }
  }

  generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9);
  }

  async handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);
      
      if (!client) return;
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscription(clientId, data.channels);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(clientId, data.channels);
          break;
        case 'getHistoricalData':
          this.sendHistoricalData(clientId, data.timeRange);
          break;
        default:
          logger.warn('Unknown message type', { type: data.type, clientId });
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', { clientId, error: error.message });
    }
  }

  handleSubscription(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    channels.forEach(channel => {
      client.subscriptions.add(channel);
    });
    
    logger.info('Client subscribed to channels', { clientId, channels });
  }

  handleUnsubscription(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    channels.forEach(channel => {
      client.subscriptions.delete(channel);
    });
    
    logger.info('Client unsubscribed from channels', { clientId, channels });
  }

  async sendInitialData(clientId) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;
    
    try {
      const initialData = {
        type: 'initial_data',
        timestamp: new Date().toISOString(),
        data: {
          currentBandwidth: this.getCurrentBandwidthData(),
          activeConnections: await this.getActiveConnections(),
          systemStatus: await this.getSystemStatus()
        }
      };
      
      client.ws.send(JSON.stringify(initialData));
    } catch (error) {
      logger.error('Error sending initial data', { clientId, error: error.message });
    }
  }

  async sendHistoricalData(clientId, timeRange) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;
    
    try {
      const historicalData = {
        type: 'historical_data',
        timeRange,
        data: await this.getHistoricalBandwidthData(timeRange)
      };
      
      client.ws.send(JSON.stringify(historicalData));
    } catch (error) {
      logger.error('Error sending historical data', { clientId, error: error.message });
    }
  }

  startBandwidthCollection() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.collectionInterval = setInterval(async () => {
      await this.collectBandwidthData();
    }, 2000); // Collect every 2 seconds
    
    logger.info('Bandwidth collection started');
  }

  stopBandwidthCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    this.isRunning = false;
    logger.info('Bandwidth collection stopped');
  }

  async collectBandwidthData() {
    try {
      const bandwidthData = await this.getMikroTikBandwidthData();
      const timestamp = new Date().toISOString();
      
      // Store latest data
      this.bandwidthData.set('latest', {
        timestamp,
        ...bandwidthData
      });
      
      // Keep history for last 100 data points
      const history = this.bandwidthData.get('history') || [];
      history.push({ timestamp, ...bandwidthData });
      if (history.length > 100) {
        history.shift();
      }
      this.bandwidthData.set('history', history);
      
      // Broadcast to subscribed clients
      this.broadcastToSubscribers('bandwidth', {
        type: 'bandwidth_update',
        timestamp,
        data: bandwidthData
      });
      
      // Check for alerts
      this.checkBandwidthAlerts(bandwidthData);
      
    } catch (error) {
      logger.error('Error collecting bandwidth data', { error: error.message });
    }
  }

  async getMikroTikBandwidthData() {
    try {
      // This would connect to your actual MikroTik devices
      // For now, returning simulated data
      const simulatedData = {
        totalBandwidth: Math.floor(Math.random() * 1000000000), // 1 Gbps max
        usedBandwidth: Math.floor(Math.random() * 800000000),   // Up to 800 Mbps
        downloadSpeed: Math.floor(Math.random() * 500000000),   // Up to 500 Mbps
        uploadSpeed: Math.floor(Math.random() * 300000000),     // Up to 300 Mbps
        activeConnections: Math.floor(Math.random() * 100) + 20,
        latency: Math.floor(Math.random() * 50) + 5,
        packetLoss: Math.random() * 2,
        interfaces: [
          {
            name: 'ether1',
            status: 'up',
            rx: Math.floor(Math.random() * 1000000000),
            tx: Math.floor(Math.random() * 1000000000)
          },
          {
            name: 'wlan1',
            status: 'up',
            rx: Math.floor(Math.random() * 500000000),
            tx: Math.floor(Math.random() * 500000000)
          }
        ],
        customerUsage: await this.getCustomerUsageData()
      };
      
      return simulatedData;
    } catch (error) {
      logger.error('Error getting MikroTik bandwidth data', { error: error.message });
      return this.getDefaultBandwidthData();
    }
  }

  async getCustomerUsageData() {
    // Simulate customer usage data
    return [
      {
        id: 'cust_1',
        name: 'Customer A',
        usage: Math.floor(Math.random() * 10000000000), // bytes
        limit: 50000000000, // 50GB limit
        percentage: Math.random() * 100
      },
      {
        id: 'cust_2',
        name: 'Customer B',
        usage: Math.floor(Math.random() * 10000000000),
        limit: 30000000000, // 30GB limit
        percentage: Math.random() * 100
      }
    ];
  }

  getDefaultBandwidthData() {
    return {
      totalBandwidth: 1000000000,
      usedBandwidth: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      activeConnections: 0,
      latency: 0,
      packetLoss: 0,
      interfaces: [],
      customerUsage: []
    };
  }

  getCurrentBandwidthData() {
    return this.bandwidthData.get('latest') || this.getDefaultBandwidthData();
  }

  async getActiveConnections() {
    // Simulate active connections data
    return {
      total: Math.floor(Math.random() * 100) + 50,
      active: Math.floor(Math.random() * 80) + 20,
      authenticated: Math.floor(Math.random() * 60) + 10
    };
  }

  async getSystemStatus() {
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      uptime: Math.floor(Math.random() * 86400), // seconds
      temperature: Math.random() * 30 + 40 // Celsius
    };
  }

  async getHistoricalBandwidthData(timeRange) {
    const history = this.bandwidthData.get('history') || [];
    
    // Filter data based on time range
    const now = new Date();
    let startTime;
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
    }
    
    return history.filter(data => new Date(data.timestamp) >= startTime);
  }

  broadcastToSubscribers(channel, message) {
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          logger.error('Error broadcasting to client', { clientId, error: error.message });
        }
      }
    });
  }

  checkBandwidthAlerts(bandwidthData) {
    const usagePercentage = (bandwidthData.usedBandwidth / bandwidthData.totalBandwidth) * 100;
    
    // High bandwidth usage alert
    if (usagePercentage > 90) {
      this.broadcastToSubscribers('alerts', {
        type: 'alert',
        level: 'warning',
        message: `High bandwidth usage: ${usagePercentage.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        data: { usagePercentage }
      });
    }
    
    // High latency alert
    if (bandwidthData.latency > 100) {
      this.broadcastToSubscribers('alerts', {
        type: 'alert',
        level: 'warning',
        message: `High latency detected: ${bandwidthData.latency}ms`,
        timestamp: new Date().toISOString(),
        data: { latency: bandwidthData.latency }
      });
    }
    
    // Customer usage alerts
    bandwidthData.customerUsage.forEach(customer => {
      if (customer.percentage > 90) {
        this.broadcastToSubscribers('alerts', {
          type: 'alert',
          level: 'info',
          message: `Customer ${customer.name} at ${customer.percentage.toFixed(1)}% data limit`,
          timestamp: new Date().toISOString(),
          data: { customerId: customer.id, percentage: customer.percentage }
        });
      }
    });
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      isRunning: this.isRunning,
      dataPoints: this.bandwidthData.get('history')?.length || 0
    };
  }
}

module.exports = new BandwidthWebSocketService();
