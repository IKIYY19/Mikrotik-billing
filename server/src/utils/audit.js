/**
 * Audit Logging System
 * Tracks all critical actions across the platform
 */

const { v4: uuidv4 } = require('uuid');

const db = global.dbAvailable ? global.db : require('../db/memory');

// Audit log entry
async function logAudit({
  action,
  entityType,
  entityId,
  userId,
  userName,
  userRole,
  ipAddress,
  userAgent,
  details,
  before,
  after,
}) {
  try {
    await db.query(
      `INSERT INTO audit_logs 
       (id, action, entity_type, entity_id, user_id, user_name, user_role, 
        ip_address, user_agent, details, before_data, after_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
      [
        uuidv4(),
        action,
        entityType,
        entityId,
        userId,
        userName || 'System',
        userRole || 'system',
        ipAddress,
        userAgent,
        JSON.stringify(details || {}),
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
    // Don't throw - audit logging shouldn't break the main flow
  }
}

// Middleware to auto-log route actions
const auditMiddleware = (action, entityType) => {
  return async (req, res, next) => {
    // Store original end method
    const originalEnd = res.end;

    res.end = function(...args) {
      // Log after response is sent
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAudit({
          action,
          entityType,
          entityId: req.params.id || req.body?.id,
          userId: req.user?.id,
          userName: req.user?.name,
          userRole: req.user?.role,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          details: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
          },
          after: req.body,
        }).catch(err => console.error('Async audit error:', err));
      }

      // Call original end
      originalEnd.apply(res, args);
    };

    next();
  };
};

// Quick audit helpers
const audit = {
  // User actions
  userLogin: (user, req) => logAudit({
    action: 'USER_LOGIN',
    entityType: 'user',
    entityId: user.id,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }),

  userCreated: (user, createdBy, req) => logAudit({
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: user.id,
    userId: createdBy.id,
    userName: createdBy.name,
    userRole: createdBy.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    after: { email: user.email, role: user.role, name: user.name },
  }),

  userUpdated: (user, before, after, req) => logAudit({
    action: 'USER_UPDATED',
    entityType: 'user',
    entityId: user.id,
    userId: req.user?.id,
    userName: req.user?.name,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    before,
    after,
  }),

  // Customer actions
  customerCreated: (customer, req) => logAudit({
    action: 'CUSTOMER_CREATED',
    entityType: 'customer',
    entityId: customer.id,
    userId: req.user?.id,
    userName: req.user?.name,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    after: { name: customer.name, phone: customer.phone, email: customer.email },
  }),

  customerUpdated: (customerId, before, after, req) => logAudit({
    action: 'CUSTOMER_UPDATED',
    entityType: 'customer',
    entityId: customerId,
    userId: req.user?.id,
    userName: req.user?.name,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    before,
    after,
  }),

  // Billing actions
  invoiceCreated: (invoice, req) => logAudit({
    action: 'INVOICE_CREATED',
    entityType: 'invoice',
    entityId: invoice.id,
    userId: req.user?.id,
    userName: req.user?.name,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    after: { amount: invoice.amount, customerId: invoice.customer_id },
  }),

  paymentRecorded: (payment, req) => logAudit({
    action: 'PAYMENT_RECORDED',
    entityType: 'payment',
    entityId: payment.id,
    userId: req.user?.id,
    userName: req.user?.name,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    after: { amount: payment.amount, method: payment.method },
  }),

  // Network actions
  routerConnected: (router, req) => logAudit({
    action: 'ROUTER_CONNECTED',
    entityType: 'router',
    entityId: router.id,
    userId: req.user?.id,
    userName: req.user?.name,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    details: { name: router.name, ip: router.ip_address },
  }),

  // Suspension actions
  customerSuspended: (customerId, reason, req) => logAudit({
    action: 'CUSTOMER_SUSPENDED',
    entityType: 'customer',
    entityId: customerId,
    userId: req.user?.id || 'system',
    userName: req.user?.name || 'Auto-suspend',
    userRole: req.user?.role || 'system',
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
    details: { reason },
  }),

  customerRestored: (customerId, req) => logAudit({
    action: 'CUSTOMER_RESTORED',
    entityType: 'customer',
    entityId: customerId,
    userId: req.user?.id,
    userName: req.user?.name,
    userRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }),

  // Generic
  custom: (params) => logAudit(params),
};

module.exports = {
  logAudit,
  auditMiddleware,
  audit,
};
