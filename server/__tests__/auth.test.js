/**
 * Authentication Middleware Tests
 */

const jwt = require('jsonwebtoken');

// Mock environment variables before requiring auth module
process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-long-enough-for-testing-purposes-only';

describe('Authentication Middleware', () => {
  let authMiddleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Clear module cache to ensure fresh import
    jest.resetModules();
    
    authMiddleware = require('../src/middleware/auth');
    
    mockReq = {
      headers: {},
      user: null,
      ip: '127.0.0.1',
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    mockNext = jest.fn();
  });

  describe('JWT_SECRET validation', () => {
    test('should export JWT_SECRET from environment', () => {
      expect(authMiddleware.JWT_SECRET).toBe(process.env.JWT_SECRET);
    });

    test('should have ROLES defined', () => {
      expect(authMiddleware.ROLES).toBeDefined();
      expect(authMiddleware.ROLES.ADMIN).toBe('admin');
      expect(authMiddleware.ROLES.STAFF).toBe('staff');
    });

    test('should have PERMISSIONS defined', () => {
      expect(authMiddleware.PERMISSIONS).toBeDefined();
      expect(authMiddleware.PERMISSIONS.admin).toContain('*');
    });
  });

  describe('authenticate middleware', () => {
    test('should return 401 if no authorization header', async () => {
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    test('should return 401 if authorization header is not Bearer', async () => {
      mockReq.headers.authorization = 'Basic token123';
      
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    test('should return 403 if token is invalid', async () => {
      mockReq.headers.authorization = 'Bearer invalidtoken123';
      
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    test('should authenticate with valid token', async () => {
      const validToken = jwt.sign(
        { id: 'test-user-id', email: 'test@example.com', role: 'admin' },
        process.env.JWT_SECRET
      );
      
      mockReq.headers.authorization = `Bearer ${validToken}`;
      
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.email).toBe('test@example.com');
    });

    test('should return 401 if token is expired', async () => {
      const expiredToken = jwt.sign(
        { id: 'test-user-id', email: 'test@example.com', role: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET
      );
      
      mockReq.headers.authorization = `Bearer ${expiredToken}`;
      
      await authMiddleware.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired, please login again' });
    });
  });

  describe('requireRole middleware', () => {
    test('should allow access if user has required role', () => {
      mockReq.user = { id: 'user-id', email: 'admin@example.com', role: 'admin' };
      
      const middleware = authMiddleware.requireRole('admin');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should deny access if user does not have required role', () => {
      mockReq.user = { id: 'user-id', email: 'user@example.com', role: 'staff' };
      
      const middleware = authMiddleware.requireRole('admin');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    });
  });

  describe('requirePermission middleware', () => {
    test('should allow access if user has permission', () => {
      mockReq.user = { id: 'user-id', email: 'staff@example.com', role: 'staff' };
      
      const middleware = authMiddleware.requirePermission('billing:read');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should allow access if user is admin (has all permissions)', () => {
      mockReq.user = { id: 'user-id', email: 'admin@example.com', role: 'admin' };
      
      const middleware = authMiddleware.requirePermission('any:permission');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should deny access if user lacks permission', () => {
      mockReq.user = { id: 'user-id', email: 'customer@example.com', role: 'customer' };
      
      const middleware = authMiddleware.requirePermission('billing:write');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    });
  });
});
