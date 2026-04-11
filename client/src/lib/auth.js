/**
 * Centralized Auth Token Manager
 * Handles token storage and retrieval consistently across the app
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/**
 * Save auth data
 */
export function setAuth(token, user) {
  console.log('💾 setAuth() called');
  console.log('  Token length:', token?.length || 0);
  console.log('  User:', user?.email);

  if (!token) {
    console.error('❌ setAuth() called with NULL token!');
    return false;
  }

  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    
    // Verify immediately
    const saved = localStorage.getItem(TOKEN_KEY);
    console.log('  ✅ Token saved:', saved ? `YES (${saved.substring(0, 20)}...)` : 'NO!');
    
    if (!saved) {
      console.error('❌ CRITICAL: Token was NOT saved to localStorage!');
    }
    
    return true;
  } catch (err) {
    console.error('❌ setAuth() error:', err);
    return false;
  }
}

/**
 * Get current token
 */
export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token || null;
}

/**
 * Get current user
 */
export function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Check if authenticated
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Clear auth data (logout)
 */
export function clearAuth() {
  console.log('🗑️ clearAuth() called');
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Get auth headers for API requests
 */
export function getAuthHeaders() {
  const token = getToken();
  console.log('📤 getAuthHeaders() - Token:', token ? `YES (${token.substring(0, 15)}...)` : 'NO');
  
  if (!token) {
    console.warn('⚠️ No token available for headers!');
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`,
  };
}

// Log on module load
console.log('✅ AuthManager loaded');
