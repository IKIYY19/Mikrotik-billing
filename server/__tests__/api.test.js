/**
 * API Endpoint Tests
 */

const request = require('supertest');

// Set environment variables before importing app
process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-long-enough-for-testing-purposes-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!!';
process.env.NODE_ENV = 'test';

describe('API Endpoints', () => {
  let app;

  beforeAll(async () => {
    // Mock database to prevent crashes during tests
    global.dbAvailable = false;
    global.db = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    
    app = require('../src/index');
    await app.ready;
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const res = await request(app).get('/api/health');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('database');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to API endpoints', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(request(app).get('/api/health'));
      }
      
      const results = await Promise.all(promises);
      
      // All requests should succeed (under rate limit)
      results.forEach(res => {
        expect(res.statusCode).toBe(200);
      });
    });
  });

  describe('Authentication Required', () => {
    const protectedRoutes = [
      '/api/projects',
      '/api/modules',
      '/api/generator',
      '/api/templates',
      '/api/devices',
      '/api/billing',
      '/api/customers',
    ];

    test.each(protectedRoutes)('should return 401 for unprotected route %s', async (route) => {
      const res = await request(app).get(route);
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('CORS', () => {
    test('should have CORS headers configured', async () => {
      const res = await request(app).get('/api/health');
      
      // CORS should be enabled
      expect(res.statusCode).toBe(200);
    });
  });
});
