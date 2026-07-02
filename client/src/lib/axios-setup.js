/**
 * Global Axios Interceptor
 * Attaches auth token to EVERY request automatically
 */

import axios from 'axios';
import { getToken } from './auth';

console.log('🔥 AXIOS INTERCEPTOR ACTIVATED');

// REQUEST interceptor - adds token to EVERY request
axios.interceptors.request.use((config) => {
  const token = getToken();
  
  console.log(`📡 Request: ${config.method?.toUpperCase()} ${config.url}`);
  console.log(`🔑 Token:`, token ? `PRESENT (${token.substring(0, 25)}...)` : 'MISSING');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log(`✅ Header attached`);
  } else {
    console.warn(`⚠️ NO TOKEN - request will fail auth`);
  }
  
  return config;
});

// RESPONSE interceptor - handles 401 errors
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - clearing token and redirecting');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Make token available globally for debugging
window.getAuthStatus = () => {
  const token = localStorage.getItem('auth_token');
  const user = localStorage.getItem('auth_user');
  console.log('=== AUTH STATUS ===');
  console.log('Token:', token ? token.substring(0, 40) + '...' : 'NULL');
  console.log('User:', user || 'NULL');
  console.log('==================');
  return { hasToken: !!token, user: user ? JSON.parse(user) : null };
};

export default axios;
