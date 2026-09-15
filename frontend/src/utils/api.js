import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const SESSION_EXPIRED_KEY = "session_expired";

// Auto-logout on 401 (expired / outdated token) — redirect to login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const isAuthCall = url.includes("/auth/login");
    if (status === 401 && !isAuthCall && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

const authHeaders = (config = {}) => {
  const token = localStorage.getItem("token");
  return { ...config, headers: { ...config.headers, Authorization: `Bearer ${token}` } };
};

// API helper with auth
const api = {
  get: (url, config = {}) => axios.get(`${API_BASE}${url}`, authHeaders(config)),
  post: (url, data, config = {}) => axios.post(`${API_BASE}${url}`, data, authHeaders(config)),
  put: (url, data, config = {}) => axios.put(`${API_BASE}${url}`, data, authHeaders(config)),
  delete: (url, config = {}) => axios.delete(`${API_BASE}${url}`, authHeaders(config))
};

export default api;
