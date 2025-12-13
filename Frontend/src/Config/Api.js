import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5003/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add token
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

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post("/auth/login", credentials),
  getMe: () => api.get("/auth/me"),
  changePassword: (passwords) => api.put("/auth/change-password", passwords),
};

// User API
export const userAPI = {
  getAllUsers: () => api.get("/users"),
  getUserById: (id) => api.get(`/users/${id}`),
  createUser: (userData) => api.post("/users", userData),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/${id}`),
};

// Role API
export const roleAPI = {
  getAll: () => api.get("/roles"), // Alias for consistency
  getAllRoles: () => api.get("/roles"),
  getRoleById: (id) => api.get(`/roles/${id}`),
  createRole: (roleData) => api.post("/roles", roleData),
  updateRole: (id, roleData) => api.put(`/roles/${id}`, roleData),
  deleteRole: (id) => api.delete(`/roles/${id}`),
};

// Attendance API
export const attendanceAPI = {
  markAttendance: (data) => api.post("/attendance/mark", data),
  getAllAttendance: (params) => api.get("/attendance", { params }),
  getTodayAttendance: () => api.get("/attendance/today"),
  getAttendanceById: (id) => api.get(`/attendance/${id}`),
  getAttendanceStats: (params) => api.get("/attendance/stats", { params }),
  createManualAttendance: (data) => api.post("/attendance/manual", data),
  updateAttendance: (id, data) => api.put(`/attendance/${id}`, data),
  deleteAttendance: (id) => api.delete(`/attendance/${id}`),
};

// Department API
export const departmentAPI = {
  getAll: (params) => api.get("/departments", { params }),
  getById: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post("/departments", data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
  getSubDepartments: (id, lazyLoad = false) => 
    api.get(`/departments/${id}/sub-departments`, { params: { lazyLoad } }),
  getRootDepartments: () => api.get("/departments", { params: { parentOnly: true } }),
};

// Employee API
export const employeeAPI = {
  getAll: (params) => api.get("/employees", { params }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post("/employees", data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
};

// Salary API
export const salaryAPI = {
  calculate: (data) => api.post("/salaries/calculate", data),
  calculateAll: (data) => api.post("/salaries/calculate-all", data),
  getAll: (params) => api.get("/salaries", { params }),
  getById: (id) => api.get(`/salaries/${id}`),
  approve: (id) => api.patch(`/salaries/${id}/approve`),
  markPaid: (id) => api.patch(`/salaries/${id}/paid`),
  update: (id, data) => api.put(`/salaries/${id}`, data),
};

// Report API
export const reportAPI = {
  generateAttendanceReport: (params) => api.get("/reports/attendance", { params }),
  getDepartmentWiseReport: (params) => api.get("/reports/department-wise", { params }),
  getEmployeeWiseReport: (params) => api.get("/reports/employee-wise", { params }),
  getMonthlyAttendanceSummary: (params) => api.get("/reports/monthly-summary", { params }),
  exportAttendanceData: (params) => api.get("/reports/export", { params }),
};

// Asset API
export const assetAPI = {
  getAll: (params) => api.get("/assets", { params }),
  getById: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post("/assets", data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
  assign: (data) => api.post("/assets/assign", data),
  return: (data) => api.post("/assets/return", data),
  getHistory: (assetId) => api.get(`/assets/${assetId}/history`),
  getEmployeeAssets: (employeeId) => api.get(`/assets/employee/${employeeId}`),
  getStats: () => api.get("/assets/stats"),
};

// Export API
export const exportAPI = {
  exportEmployees: (format) => api.get(`/exports/employees?format=${format}`, { responseType: 'blob' }),
  exportAttendance: (format, params) => api.get(`/exports/attendance?format=${format}`, { params, responseType: 'blob' }),
  exportTasks: (format) => api.get(`/exports/tasks?format=${format}`, { responseType: 'blob' }),
  exportTickets: (format) => api.get(`/exports/tickets?format=${format}`, { responseType: 'blob' }),
  exportDepartments: (format) => api.get(`/exports/departments?format=${format}`, { responseType: 'blob' }),
  exportAuditLogs: (format) => api.get(`/exports/audit-logs?format=${format}`, { responseType: 'blob' }),
};

// Audit Log API
export const auditLogAPI = {
  getAll: (params) => api.get("/audit-logs", { params }),
  getActions: () => api.get("/audit-logs/actions"),
  getResourceTypes: () => api.get("/audit-logs/resource-types"),
};

export default api;
