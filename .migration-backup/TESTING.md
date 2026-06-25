# Testing Guide

This document explains how to test the MikroTik Billing application to ensure quality and catch bugs early.

## Quick Start

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Run backend tests
cd server
npm test              # Run all tests with coverage
npm run test:watch    # Run tests in watch mode

# Run frontend linting
cd client
npm run lint          # Check for code issues
```

## Test Types

### 1. Unit Tests
Test individual functions and utilities in isolation.

**Location:** `server/__tests__/*.test.js`

**Run:** `npm test`

**Coverage:** Authentication, Encryption, Utilities

### 2. Integration Tests
Test complete user flows across multiple components.

**Location:** `server/__tests__/integration.test.js`

**Flows Tested:**
- ✅ User Registration → Login → Profile
- ✅ Create Reseller → Update → Delete
- ✅ Create Customer → Create Invoice → Record Payment
- ✅ Rate Limiting Protection
- ✅ Error Handling

### 3. Manual Testing Checklist

Use this checklist for end-to-end testing before releases:

#### Authentication
- [ ] User can register with valid data
- [ ] User registration rejects invalid email
- [ ] User can login with correct credentials
- [ ] User cannot login with wrong password
- [ ] User can access protected routes after login
- [ ] User is redirected to login when token expires
- [ ] User can logout successfully

#### Dashboard
- [ ] Dashboard loads without errors
- [ ] Stats show correct data
- [ ] Recent activity displays
- [ ] Navigation works correctly

#### Reseller Management
- [ ] Can create new reseller with all fields
- [ ] Can update reseller details
- [ ] Can delete reseller
- [ ] Customer count displays correctly
- [ ] Revenue calculation is accurate
- [ ] Commission rate validates (0-100%)
- [ ] Error messages show for invalid data

#### Customer Management
- [ ] Can create new customer
- [ ] Can assign customer to reseller
- [ ] Can update customer details
- [ ] Can deactivate customer
- [ ] Search/filter works
- [ ] Pagination works with many customers

#### Billing & Invoices
- [ ] Can generate invoice
- [ ] Invoice shows correct amount
- [ ] Can mark invoice as paid
- [ ] Payment reduces outstanding balance
- [ ] Overdue invoices highlight correctly
- [ ] Auto-suspend works for overdue accounts

#### Payments
- [ ] Can record cash payment
- [ ] Can record bank transfer
- [ ] M-Pesa integration works (if configured)
- [ ] Payment reflects in customer balance
- [ ] Payment history displays correctly

#### Network Management
- [ ] Can connect to MikroTik router
- [ ] PPPoE sessions display
- [ ] Can create PPPoE user
- [ ] Hotspot vouchers generate
- [ ] Bandwidth monitoring works

#### Script Generator
- [ ] Can create new project
- [ ] Can configure modules (VLAN, Firewall, etc.)
- [ ] Generates valid RouterOS script
- [ ] Script downloads correctly
- [ ] Can save project for later

#### Error Handling
- [ ] Invalid data shows helpful error messages
- [ ] Network errors display user-friendly message
- [ ] App doesn't crash on invalid input
- [ ] Error boundary catches unexpected errors
- [ ] Toast notifications appear and disappear

## Running Tests Locally

### Backend Tests

```bash
cd server

# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Watch mode (re-runs on file changes)
npm run test:watch

# Run specific test file
npm test -- auth.test.js

# Run integration tests only
npm test -- integration.test.js
```

### Frontend Testing

```bash
cd client

# Lint check
npm run lint

# Type check (if using TypeScript/JSDoc)
npm run type-check
```

## Test Environment Variables

The tests use these environment variables (set automatically in test files):

```bash
JWT_SECRET=test-jwt-secret-key-that-is-long-enough-for-testing-purposes-only
ENCRYPTION_KEY=test-encryption-key-32-bytes-long!!
NODE_ENV=test
```

**Never use production secrets in tests!**

## Writing New Tests

### Unit Test Example

```javascript
describe('My Utility', () => {
  test('should do something specific', () => {
    const result = myUtility.doSomething(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### Integration Test Example

```javascript
test('should complete user flow', async () => {
  // Step 1: Create resource
  const createRes = await request(app)
    .post('/api/resource')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test' });
  
  expect(createRes.statusCode).toBe(201);
  
  // Step 2: Verify it exists
  const getRes = await request(app)
    .get('/api/resource')
    .set('Authorization', `Bearer ${token}`);
  
  expect(getRes.body).toHaveLength(1);
});
```

## Continuous Integration

Tests run automatically on every push via GitHub Actions (coming soon).

### Pre-commit Checks (Recommended)

Add to `package.json`:

```json
{
  "scripts": {
    "precommit": "npm run lint && npm test"
  }
}
```

## Debugging Tests

### View Test Output

```bash
# Run tests with verbose output
npm test -- --verbose

# Run tests and show console logs
npm test -- --runInBand
```

### Debug a Specific Test

Add `.only` to focus on one test:

```javascript
test.only('this test will run alone', () => {
  // ...
});
```

### Use Debugger

```bash
# Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## Common Issues

### Tests Fail with "Cannot find module"

```bash
# Install dependencies
cd server && npm install
```

### Tests Timeout

```bash
# Increase timeout in jest.config.js
{
  "testTimeout": 20000
}
```

### Database Connection Errors

Tests use in-memory database by default. If they try to use PostgreSQL:

```javascript
// Ensure this is at the top of test file
global.dbAvailable = false;
global.db = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
};
```

## Reporting Test Failures

If you find a failing test:

1. **Check it's not a flaky test** - Run it 3 times
2. **Check the error message** - Look in console
3. **Check server logs** - `server/logs/error.log`
4. **Create a GitHub Issue** - Use the bug report template

## Coverage Goals

| Module | Current | Target |
|--------|---------|--------|
| Auth | 80% | 90% |
| Billing | 60% | 85% |
| Network | 40% | 80% |
| Utils | 90% | 95% |
| **Overall** | **65%** | **85%** |

## Performance Testing

### API Response Times

```bash
# Use Apache Benchmark
ab -n 100 -c 10 http://localhost:5000/api/health

# Use autocannon
npm install -g autocannon
autocannon -c 10 -d 10 http://localhost:5000/api/health
```

### Frontend Bundle Size

```bash
cd client
npm run build
# Check dist/ folder size - should be < 1MB gzipped
```

## Security Testing

- [ ] No secrets in code (use environment variables)
- [ ] JWT_SECRET is strong (>32 chars)
- [ ] ENCRYPTION_KEY is strong (>32 chars)
- [ ] Rate limiting is enabled
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (sanitize user input)
- [ ] CSRF protection (if using cookies)

## Need Help?

- Check existing issues: https://github.com/IKIYY19/Mikrotik-billing/issues
- Create new issue with `[TEST]` prefix
- Review test files in `server/__tests__/`
- Read Jest docs: https://jestjs.io/docs/getting-started
