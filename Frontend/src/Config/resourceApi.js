import axios from "axios";

const API_BASE_URL = "http://localhost:5003/api";

// Create axios instance with auth token
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Resource API
export const resourceAPI = {
  getAll: (params) => api.get("/resources", { params }),
  getById: (id) => api.get(`/resources/${id}`),
  create: (data) => api.post("/resources", data),
  update: (id, data) => api.put(`/resources/${id}`, data),
  delete: (id) => api.delete(`/resources/${id}`),
  getStats: () => api.get("/resources/stats"),
};

export default api;
