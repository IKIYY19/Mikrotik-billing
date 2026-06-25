/**
 * Global Axios Interceptor
 * Attaches auth token to EVERY request automatically
 */

import axios from 'axios';
import { getToken } from './auth';

// REQUEST interceptor - adds token to every request
// Also intercepts demo/offline fake tokens and clears them immediately
axios.interceptors.request.use((config) => {
  const token = getToken();

  // If a stale offline/demo token is stored, clear it now and redirect to login
  if (token === 'demo-token-offline') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login';
    return Promise.reject(new Error('Stale offline token cleared'));
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let _isRedirecting = false;

function clearSessionAndRedirect() {
  if (_isRedirecting) return;
  _isRedirecting = true;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  sessionStorage.clear();
  window.location.href = '/login';
}

// RESPONSE interceptor - handles all auth failure scenarios
axios.interceptors.response.use(
  (res) => {
    // Reset redirect flag on successful response
    _isRedirecting = false;
    return res;
  },
  (error) => {
    const status = error.response?.status;
    const errMsg = error.response?.data?.error || '';

    const isAuthFailure =
      status === 401 ||
      (status === 403 && (
        errMsg === 'Invalid or expired token' ||
        errMsg.toLowerCase().includes('jwt') ||
        errMsg.toLowerCase().includes('token') ||
        errMsg.toLowerCase().includes('malformed') ||
        errMsg.toLowerCase().includes('expired')
      ));

    if (isAuthFailure) {
      clearSessionAndRedirect();
    }

    return Promise.reject(error);
  }
);

// Make token status available in browser console for debugging
if (typeof window !== 'undefined') {
  window.getAuthStatus = () => {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('auth_user');
    return { hasToken: !!token, tokenPreview: token ? token.substring(0, 40) + '...' : null, user: user ? JSON.parse(user) : null };
  };
}

export default axios;
