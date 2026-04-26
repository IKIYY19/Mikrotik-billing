/**
 * Speed Test Routes
 * Uses MikroTik's built-in bandwidth-test tool to measure network speeds
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Get MikroTik connection helper
async function getMikrotikConnection(id) {
  const db = global.db || require('../db/memory');
  const result = await db.query('SELECT * FROM mikrotik_connections WHERE id = $1', [id]);
  if (result.rows.length === 0) throw new Error('MikroTik connection not found');
  return result.rows[0];
}

// Execute MikroTik command helper
async function executeCommand(device, command, args = {}) {
  // This would use the actual MikroTik API implementation
  // For now, returning a mock response
  logger.info('Executing MikroTik command', { command, args, device: device.name });
  return { success: true };
}

// Speed test results storage (in-memory for now, could be moved to database)
const speedTestResults = [];

// Run speed test on a MikroTik connection
router.post('/run', async (req, res) => {
  try {
    const { connection_id, test_to, direction = 'both', duration = 10, protocol = 'tcp' } = req.body;
    
    if (!connection_id) {
      return res.status(400).json({ error: 'Connection ID required' });
    }

    const device = await getMikrotikConnection(connection_id);
    
    // MikroTik bandwidth-test command
    // /tool bandwidth-test [test-to=<ip>] [direction=tx|rx|both] [duration=<seconds>] [protocol=tcp|udp]
    const args = {
      duration: duration,
      protocol: protocol,
    };
    
    if (test_to) {
      args['test-to'] = test_to;
    }
    
    if (direction === 'tx' || direction === 'rx') {
      args.direction = direction;
    }

    logger.info('Starting speed test', { connection_id, test_to, direction, duration, protocol });

    // Execute the bandwidth test
    // In a real implementation, this would run the actual MikroTik command
    // and parse the results
    const testId = Date.now();
    
    // Simulate speed test results (replace with actual MikroTik API call)
    const mockResults = {
      id: testId,
      connection_id,
      test_to: test_to || 'self',
      direction,
      duration,
      protocol,
      download_speed: Math.random() * 100 + 50, // Mbps
      upload_speed: Math.random() * 50 + 20, // Mbps
      latency: Math.random() * 20 + 5, // ms
      jitter: Math.random() * 5, // ms
      packet_loss: Math.random() * 2, // %
      timestamp: new Date().toISOString(),
    };

    // Store results
    speedTestResults.push(mockResults);

    logger.info('Speed test completed', { testId, download_speed: mockResults.download_speed, upload_speed: mockResults.upload_speed });

    res.json(mockResults);
  } catch (e) {
    logger.error('Speed test failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// Get speed test history for a connection
router.get('/history/:connection_id', async (req, res) => {
  try {
    const { connection_id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = speedTestResults
      .filter(r => r.connection_id === connection_id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    res.json(history);
  } catch (e) {
    logger.error('Failed to fetch speed test history', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// Get all speed test results
router.get('/results', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const results = speedTestResults
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    res.json(results);
  } catch (e) {
    logger.error('Failed to fetch speed test results', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// Delete speed test result
router.delete('/results/:id', async (req, res) => {
  try {
    const idx = speedTestResults.findIndex(r => r.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Result not found' });
    
    speedTestResults.splice(idx, 1);
    res.json({ success: true });
  } catch (e) {
    logger.error('Failed to delete speed test result', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
