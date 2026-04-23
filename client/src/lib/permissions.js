/**
 * Role-Based Access Control (RBAC) for Frontend
 * Mirrors backend permissions defined in server/src/middleware/auth.js
 */

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  TECHNICIAN: 'technician',
  RESELLER: 'reseller',
  CUSTOMER: 'customer',
};

// Permission matrix - matches backend
export const PERMISSIONS = {
  [ROLES.ADMIN]: ['*'], // all permissions
  [ROLES.STAFF]: ['billing:read', 'billing:write', 'customers:read', 'customers:write', 'reports:read'],
  [ROLES.TECHNICIAN]: ['network:read', 'network:write', 'monitoring:read', 'devices:read', 'devices:write'],
  [ROLES.RESELLER]: ['customers:read', 'customers:write', 'billing:read', 'invoices:write'],
  [ROLES.CUSTOMER]: ['own:read', 'billing:read', 'tickets:write'],
};

// Feature access by role - which pages/features each role can see
export const FEATURE_ACCESS = {
  [ROLES.ADMIN]: [
    // Main navigation
    'dashboard', 'topology', 'router-linking', 'devices', 'templates', 'mikrotik-api', 'integrations', 'settings',
    // Billing
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet', 'sms', 'whatsapp',
    'network-map', 'monitoring', 'agents', 'auto-suspend', 'reports', 'analytics', 'pppoe', 'hotspot',
    'vouchers', 'network-services', 'olt', 'radius', 'tickets', 'captive-portal', 'bandwidth', 'resellers',
    'backups', 'inventory',
    // Admin only
    'users',
  ],
  [ROLES.STAFF]: [
    // Main navigation
    'dashboard', 'topology', 'router-linking',
    // Billing
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet', 'sms', 'whatsapp',
    'network-map', 'monitoring', 'reports', 'analytics', 'pppoe', 'hotspot', 'vouchers', 'tickets',
  ],
  [ROLES.TECHNICIAN]: [
    // Main navigation
    'dashboard', 'topology', 'router-linking', 'devices', 'templates', 'mikrotik-api', 'integrations',
    // Network
    'network-services', 'olt', 'radius', 'monitoring', 'bandwidth',
  ],
  [ROLES.RESELLER]: [
    // Main navigation
    'dashboard',
    // Billing
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet',
  ],
  [ROLES.CUSTOMER]: [
    // Customer portal only - separate UI
  ],
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  
  const userPerms = PERMISSIONS[user.role] || [];
  return userPerms.includes('*') || userPerms.includes(permission);
}

/**
 * Check if user can access a specific feature/page
 */
export function canAccessFeature(user, feature) {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  
  const features = FEATURE_ACCESS[user.role] || [];
  return features.includes(feature);
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(user, ...roles) {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Get user's role hierarchy level (higher = more access)
 */
export function getRoleLevel(role) {
  const levels = {
    [ROLES.ADMIN]: 5,
    [ROLES.STAFF]: 4,
    [ROLES.TECHNICIAN]: 3,
    [ROLES.RESELLER]: 2,
    [ROLES.CUSTOMER]: 1,
  };
  return levels[role] || 0;
}

/**
 * Check if user has higher or equal role level
 */
export function hasRoleLevel(user, minRole) {
  if (!user) return false;
  return getRoleLevel(user.role) >= getRoleLevel(minRole);
}
