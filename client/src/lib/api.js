import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with auth and retry logic
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  
  // Debug logging
  console.log('🔍 API Request to:', config.baseURL, config.url);
  console.log('🔑 Token from localStorage:', token ? token.substring(0, 20) + '...' : 'NULL');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Authorization header attached');
  } else {
    console.warn('⚠️ NO TOKEN FOUND in localStorage!');
  }
  
  return config;
});

// Retry failed requests with exponential backoff
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Don't retry if:
    // - No config (network error before request)
    // - Already retried max times
    // - 4xx error (client error - won't help to retry)
    if (!config || config._retryCount >= MAX_RETRIES || (error.response?.status >= 400 && error.response?.status < 500)) {
      // Handle 401 - token expired
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Mark as retried
    config._retryCount = (config._retryCount || 0) + 1;

    // Exponential backoff: 1s, 2s, 4s
    const delay = RETRY_DELAY * Math.pow(2, config._retryCount - 1);
    
    console.log(`Retrying request (${config._retryCount}/${MAX_RETRIES}) after ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return api(config);
  }
);

// Export convenience methods
export const get = (url, params) => api.get(url, { params });
export const post = (url, data) => api.post(url, data);
export const put = (url, data) => api.put(url, data);
export const del = (url) => api.delete(url);

export default api;
export { API_URL };
