import axios from 'axios';
import { getToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = getToken();
  console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.url}`);
  console.log(`🔑 Token from auth module:`, token ? `YES (${token.substring(0, 20)}...)` : 'NO');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Auth header attached');
  }
  
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ 401 - redirecting to login');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Convenience exports
export const get = (url, params) => api.get(url, { params });
export const post = (url, data) => api.post(url, data);
export const put = (url, data) => api.put(url, data);
export const del = (url) => api.delete(url);

export default api;
export { API_URL };
