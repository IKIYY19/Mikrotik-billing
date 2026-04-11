/**
 * Global Axios Interceptor Setup
 * Automatically attaches auth token to ALL axios requests
 * This ensures even pages that import axios directly still send the token
 */

import axios from 'axios';

// Add global request interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    // Debug logging (remove in production)
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axios;
