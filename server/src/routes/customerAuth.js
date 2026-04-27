/**
 * Customer Portal Authentication
 * Secure token-based auth for customer self-service portal
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const db = global.dbAvailable ? global.db : require('../db/memory');

const CUSTOMER_JWT_SECRET = JWT_SECRET + '_customer';
const CUSTOMER_JWT_EXPIRES = '24h';

// Generate secure PIN hash
const hashPIN = async (pin) => await bcrypt.hash(pin, 10);
const verifyPIN = async (pin, hash) => await bcrypt.compare(pin, hash);
const isValidPIN = (pin) => /^\d{4,8}$/.test(String(pin || ''));

// POST /api/portal/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ error: 'Phone and PIN required' });
    }
    if (!isValidPIN(pin)) {
      return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    }

    const customer = await db.query(
      'SELECT * FROM customers WHERE phone = $1 AND status = $2',
      [phone, 'active']
    );

    if (customer.rows.length === 0) {
      return res.status(401).json({ error: 'Customer not found or inactive' });
    }

    const cust = customer.rows[0];

    // If no PIN set, use last 4 of phone as default
    const pinHash = cust.portal_pin_hash;
    if (!pinHash) {
      // First login - set PIN
      const newPinHash = await hashPIN(pin);
      await db.query(
        'UPDATE customers SET portal_pin_hash = $1, last_portal_login = CURRENT_TIMESTAMP WHERE id = $2',
        [newPinHash, cust.id]
      );
    } else {
      const valid = await verifyPIN(pin, pinHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid PIN' });
      }

      await db.query(
        'UPDATE customers SET last_portal_login = CURRENT_TIMESTAMP WHERE id = $1',
        [cust.id]
      );
    }

    // Generate customer-specific token
    const token = jwt.sign(
      {
        customerId: cust.id,
        phone: cust.phone,
        type: 'customer',
      },
      CUSTOMER_JWT_SECRET,
      { expiresIn: CUSTOMER_JWT_EXPIRES }
    );

    res.json({
      token,
      customer: {
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        email: cust.email,
        status: cust.status,
      },
    });
  } catch (error) {
    console.error('Portal login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/portal/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(authHeader.split(' ')[1], CUSTOMER_JWT_SECRET);
    const customer = await db.query(
      'SELECT id, name, phone, email, status, address, created_at FROM customers WHERE id = $1',
      [decoded.customerId]
    );

    if (customer.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer.rows[0]);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/portal/auth/change-pin
router.post('/change-pin', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(authHeader.split(' ')[1], CUSTOMER_JWT_SECRET);
    const { currentPIN, newPIN } = req.body;

    if (!currentPIN || !newPIN) {
      return res.status(400).json({ error: 'Current PIN and new PIN required' });
    }

    if (!isValidPIN(newPIN)) {
      return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    }

    const customer = await db.query(
      'SELECT portal_pin_hash FROM customers WHERE id = $1',
      [decoded.customerId]
    );

    if (customer.rows.length === 0 || !customer.rows[0].portal_pin_hash) {
      return res.status(400).json({ error: 'No PIN set. Please login first.' });
    }

    const valid = await verifyPIN(currentPIN, customer.rows[0].portal_pin_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    const newPinHash = await hashPIN(newPIN);
    await db.query(
      'UPDATE customers SET portal_pin_hash = $1 WHERE id = $2',
      [newPinHash, decoded.customerId]
    );

    res.json({ message: 'PIN changed successfully' });
  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({ error: 'Failed to change PIN' });
  }
});

// POST /api/portal/auth/forgot-pin
router.post('/forgot-pin', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const customer = await db.query(
      'SELECT id, phone FROM customers WHERE phone = $1 AND status = $2',
      [phone, 'active']
    );

    if (customer.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Generate reset code (6 digits)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await db.query(
      'UPDATE customers SET pin_reset_code = $1, pin_reset_expires = $2 WHERE id = $3',
      [resetCode, resetExpiry, customer.rows[0].id]
    );

    // In production: Send SMS with reset code
    // For now: Return code in response (TODO: Integrate SMS)
    res.json({
      message: 'Reset code sent',
      resetCode: process.env.NODE_ENV === 'production' ? undefined : resetCode,
    });
  } catch (error) {
    console.error('Forgot PIN error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/portal/auth/reset-pin
router.post('/reset-pin', async (req, res) => {
  try {
    const { phone, resetCode, newPIN } = req.body;

    if (!phone || !resetCode || !newPIN) {
      return res.status(400).json({ error: 'Phone, reset code, and new PIN required' });
    }
    if (!isValidPIN(newPIN)) {
      return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    }

    const customer = await db.query(
      `SELECT id, pin_reset_code, pin_reset_expires 
       FROM customers WHERE phone = $1`,
      [phone]
    );

    if (customer.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const cust = customer.rows[0];

    if (cust.pin_reset_code !== resetCode) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    if (new Date(cust.pin_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset code expired' });
    }

    const newPinHash = await hashPIN(newPIN);
    await db.query(
      `UPDATE customers 
       SET portal_pin_hash = $1, pin_reset_code = NULL, pin_reset_expires = NULL 
       WHERE id = $2`,
      [newPinHash, cust.id]
    );

    res.json({ message: 'PIN reset successfully' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
});

// Middleware for customer portal auth
const authenticateCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, CUSTOMER_JWT_SECRET);
    req.customerId = decoded.customerId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = router;
module.exports.authenticateCustomer = authenticateCustomer;
