/**
 * Authentication Middleware
 * Protects API routes with JWT authentication
 * Includes Role-Based Access Control (RBAC)
 */

const jwt = require('jsonwebtoken');

// IMPORTANT: JWT_SECRET must be consistent across restarts!
// If not set in env, use a fixed default (change this in production!)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production-do-not-use-random-keys';

// Warn if using default secret
if (JWT_SECRET === 'your-jwt-secret-change-this-in-production-do-not-use-random-keys') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET! Set JWT_SECRET environment variable for production!');
}

// Role hierarchy
const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  TECHNICIAN: 'technician',
  RESELLER: 'reseller',
  CUSTOMER: 'customer',
};

// Permission matrix
const PERMISSIONS = {
  admin: ['*'], // all permissions
  staff: ['billing:read', 'billing:write', 'customers:read', 'customers:write', 'reports:read'],
  technician: ['network:read', 'network:write', 'monitoring:read', 'devices:read', 'devices:write'],
  reseller: ['customers:read', 'customers:write', 'billing:read', 'invoices:write'],
  customer: ['own:read', 'billing:read', 'tickets:write'],
};

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }
  } catch (error) {
    // Ignore errors - user will be treated as unauthenticated
  }
  next();
};

// Role-based authorization
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPerms = PERMISSIONS[req.user.role] || [];
    if (userPerms.includes('*') || userPerms.includes(permission)) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requirePermission,
  ROLES,
  PERMISSIONS,
  JWT_SECRET,
};
