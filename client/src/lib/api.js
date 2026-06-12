import axios from "axios";
import { getToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "/api";

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRedirecting = false;
// Handle 401 and 403 (invalid token) responses
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const isInvalidToken = status === 403 && error.response?.data?.error === "Invalid or expired token";
    
    if (status === 401 || isInvalidToken) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      if (!isRedirecting) {
        isRedirecting = true;
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// Convenience exports
export const get = (url, params) => api.get(url, { params });
export const post = (url, data) => api.post(url, data);
export const put = (url, data) => api.put(url, data);
export const del = (url) => api.delete(url);

export default api;
export { API_URL };
