/**
 * Global Axios Interceptor Setup
 * Automatically attaches auth token to ALL axios requests
 * This ensures even pages that import axios directly still send the token
 */

import axios from 'axios';

// Log on initialization to verify this file is loaded
console.log('✅✅✅ AXIOS SETUP LOADED - Global interceptor activated! ✅✅✅');

// Check and log token status immediately
const initialToken = localStorage.getItem('token');
console.log('🔑 Token on init:', initialToken ? 'PRESENT (' + initialToken.substring(0, 20) + '...)' : 'ABSENT');

// Add global request interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    console.log('🌐 Global Axios Request:', config.url);
    console.log('🔑 Token found:', token ? 'YES (' + token.substring(0, 15) + '...)' : 'NO');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token attached to:', config.url);
    } else {
      console.warn('⚠️ No token for:', config.url);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add global response interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - redirecting to login');
      console.error('❌ Response:', error.response.data);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Expose for debugging
window.checkAuth = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  console.log('🔑 Token:', token ? token.substring(0, 30) + '...' : 'NULL');
  console.log('👤 User:', user);
  console.log('📊 Axios interceptors:', axios.interceptors.request.handlers.length);
  return { token: !!token, user: user ? JSON.parse(user) : null };
};

export default axios;
