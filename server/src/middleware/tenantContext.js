/**
 * Tenant Context Middleware
 * Resolves tenant from JWT user and auto-filters DB queries.
 *
 * Usage:
 *   app.use(tenantContext);
 *
 * After this middleware runs:
 *   req.tenantId  - the current tenant UUID (null for super admins)
 *   req.isSuperAdmin - true if user has no tenant (sees all data)
 *
 * Super admins can override with X-Tenant-ID header.
 */

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

function tenantContext(req, res, next) {
  // Tenant already resolved (set by auth middleware)
  if (req.tenantId !== undefined) {return next();}

  const user = req.user;

  // No user = public route, use default tenant context
  if (!user) {
    req.tenantId = null;
    req.isSuperAdmin = false;
    return next();
  }

  // Super admin: no tenant_id = sees everything
  if (user.role === "admin" && !user.tenant_id) {
    // Allow super admin to impersonate a tenant via header
    const overrideHeader = req.headers["x-tenant-id"];
    if (overrideHeader && overrideHeader !== "all") {
      req.tenantId = overrideHeader;
      req.isSuperAdmin = true;
    } else if (overrideHeader === "all") {
      req.tenantId = null;
      req.isSuperAdmin = true;
    } else {
      req.tenantId = null;
      req.isSuperAdmin = true;
    }
    return next();
  }

  // Regular user: scoped to their tenant
  req.tenantId = user.tenant_id || DEFAULT_TENANT_ID;
  req.isSuperAdmin = false;
  next();
}

/**
 * Returns SQL WHERE clause fragment and params for tenant filtering.
 * Use in route handlers that build dynamic queries.
 *
 * @param {object} req - Express request
 * @param {string} tableAlias - e.g. "c" for customers
 * @param {number} startParamIdx - starting $N index
 * @returns {{ clause: string, params: array, nextIdx: number }}
 */
function tenantFilter(req, tableAlias = "", startParamIdx = 1) {
  if (!req.tenantId || req.isSuperAdmin) {
    return { clause: "", params: [], nextIdx: startParamIdx };
  }
  const col = tableAlias ? `${tableAlias}.tenant_id` : "tenant_id";
  return {
    clause: `AND ${col} = $${startParamIdx}`,
    params: [req.tenantId],
    nextIdx: startParamIdx + 1,
  };
}

/**
 * Middleware that restricts to super admin only.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin" || req.user.tenant_id) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
}

/**
 * Middleware that requires a tenant context (blocks super admins viewing "all").
 */
function requireTenant(req, res, next) {
  if (!req.tenantId) {
    return res.status(400).json({
      error: "Tenant context required. Super admins must set X-Tenant-ID header.",
    });
  }
  next();
}

module.exports = {
  tenantContext,
  tenantFilter,
  requireSuperAdmin,
  requireTenant,
  DEFAULT_TENANT_ID,
};
