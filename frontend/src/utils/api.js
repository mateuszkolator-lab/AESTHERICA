import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

// API helper with auth
const api = {
  get: (url, config = {}) => {
    const token = localStorage.getItem("token");
    return axios.get(`${API_BASE}${url}`, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` }
    });
  },
  post: (url, data, config = {}) => {
    const token = localStorage.getItem("token");
    return axios.post(`${API_BASE}${url}`, data, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` }
    });
  },
  put: (url, data, config = {}) => {
    const token = localStorage.getItem("token");
    return axios.put(`${API_BASE}${url}`, data, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` }
    });
  },
  delete: (url, config = {}) => {
    const token = localStorage.getItem("token");
    return axios.delete(`${API_BASE}${url}`, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` }
    });
  }
};

export default api;
