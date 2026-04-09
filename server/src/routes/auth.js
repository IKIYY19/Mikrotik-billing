const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// Valid RBAC roles
const VALID_ROLES = ['admin', 'staff', 'technician', 'reseller', 'customer'];

// Lazy db getter - avoids requiring pg at module load time
const getDb = () => global.dbAvailable ? global.db : require('../db/memory');

// ─── REGISTER ───
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, and name required' });

    // Validate role if provided, default to 'staff'
    const userRole = role && VALID_ROLES.includes(role) ? role : 'staff';

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, created_at`,
      [uuidv4(), email, hash, name, userRole]
    );

    const token = jwt.sign({ id: result.rows[0].id, email: result.rows[0].email, role: result.rows[0].role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(201).json({ user: result.rows[0], token });
  } catch (e) { console.error('Auth register error:', JSON.stringify(e)); res.status(500).json({ error: e.message || String(e) }); }
});

// ─── LOGIN ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.rows[0].id]);

    const token = jwt.sign({ id: user.rows[0].id, email: user.rows[0].email, role: user.rows[0].role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({
      user: { id: user.rows[0].id, email: user.rows[0].email, name: user.rows[0].name, role: user.rows[0].role },
      token,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET ME ───
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const user = await db.query('SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = $1', [decoded.id]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(user.rows[0]);
  } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
module.exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) { res.status(401).json({ error: 'Invalid or expired token' }); }
};
