import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5004/api";

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
      // Only redirect to login if we're not already on the login page
      // and if we have a token (meaning we were previously authenticated)
      const currentPath = window.location.pathname;
      const hasToken = localStorage.getItem("token");
      
      if (currentPath !== "/login" && hasToken) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
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
  getNotMarkedAttendance: (params) => api.get("/attendance/not-marked", { params }),
  getAttendanceById: (id) => api.get(`/attendance/${id}`),
  getAttendanceStats: (params) => api.get("/attendance/stats", { params }),
  createManualAttendance: (data) => api.post("/attendance/manual", data),
  markHolidayPresent: (data) => api.post("/attendance/holiday-present", data),
  updateAttendance: (id, data) => api.put(`/attendance/${id}`, data),
  deleteAttendance: (id) => api.delete(`/attendance/${id}`),
    submitJustification: (data) => api.post("/attendance/justification", data),
    reviewJustification: (attendanceId, data) => api.put(`/attendance/justification/${attendanceId}`, data),
    getPendingJustifications: () => api.get("/attendance/justifications/pending"),
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
  getShifts: (id) => api.get(`/employees/${id}/shifts`),
  updateShifts: (id, data) => api.put(`/employees/${id}/shifts`, data),
  downloadTemplate: () => api.get("/employees/template/download", { responseType: "blob" }),
  importEmployees: (formData) => api.post("/employees/import", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  }),
};

// Salary API
export const salaryAPI = {
  preview: (data) => api.post("/salaries/preview", data),
  previewAll: (data) => api.post("/salaries/preview-all", data),
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
  bulkCreate: (data) => api.post("/assets/bulk", data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
  assign: (data) => api.post("/assets/assign", data),
  return: (data) => api.post("/assets/return", data),
  getHistory: (assetId) => api.get(`/assets/${assetId}/history`),
  getEmployeeAssets: (employeeId) => api.get(`/assets/employee/${employeeId}`),
  getStats: () => api.get("/assets/stats"),
  getAnalytics: () => api.get("/assets/analytics/detailed"),
};

// Export API
export const exportAPI = {
  exportEmployees: (format) => api.get(`/export/employees?format=${format}`, { responseType: 'blob' }),
  exportAttendance: (format, params) => api.get(`/export/attendance?format=${format}`, { params, responseType: 'blob' }),
  exportTasks: (format) => api.get(`/export/tasks?format=${format}`, { responseType: 'blob' }),
  exportTickets: (format) => api.get(`/export/tickets?format=${format}`, { responseType: 'blob' }),
  exportDepartments: (format) => api.get(`/export/departments?format=${format}`, { responseType: 'blob' }),
  exportAuditLogs: (format) => api.get(`/export/audit-logs?format=${format}`, { responseType: 'blob' }),
  exportSalaries: (format, params) => api.get(`/export/salaries?format=${format}`, { params, responseType: 'blob' }),
  // Legacy aliases
  employees: (params) => api.get(`/export/employees?format=xlsx`, { params, responseType: 'blob' }),
  employeesCsv: (params) => api.get(`/export/employees?format=csv`, { params, responseType: 'blob' }),
};

// Audit Log API
export const auditLogAPI = {
  getAll: (params) => api.get("/audit-logs", { params }),
  getActions: () => api.get("/audit-logs/actions"),
  getResourceTypes: () => api.get("/audit-logs/resource-types"),
};

// Feedback API
export const feedbackAPI = {
  submit: (data) => api.post("/feedback", data),
  getMy: () => api.get("/feedback/my"),
  getAll: (params) => api.get("/feedback", { params }),
  getById: (id) => api.get(`/feedback/${id}`),
  update: (id, data) => api.put(`/feedback/${id}`, data),
  delete: (id) => api.delete(`/feedback/${id}`),
};

// Todo API
export const todoAPI = {
  getAll: (params) => api.get("/todos", { params }),
  getById: (id) => api.get(`/todos/${id}`),
  create: (data) => api.post("/todos", data),
  update: (id, data) => api.put(`/todos/${id}`, data),
  delete: (id) => api.delete(`/todos/${id}`),
  toggleStatus: (id) => api.patch(`/todos/${id}/toggle`),
};

// Leave API
export const leaveAPI = {
  apply: (data) => api.post("/leaves/apply", data),
  applyWithFiles: (formData) => api.post("/leaves/apply", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }),
  update: (id, data) => api.put(`/leaves/${id}`, data),
  updateWithFiles: (id, formData) => api.put(`/leaves/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }),
  getMyLeaves: (params) => api.get("/leaves/my-leaves", { params }),
  getAllLeaves: (params) => api.get("/leaves/all", { params }),
  updateStatus: (id, data) => api.put(`/leaves/${id}/status`, data),
  cancel: (id) => api.delete(`/leaves/${id}`),
};

// Notification API
export const notificationAPI = {
  getAll: (params) => api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put("/notifications/mark-all-read"),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteAllRead: () => api.delete("/notifications/read"),
};

export default api;
