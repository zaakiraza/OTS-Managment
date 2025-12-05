import axios from "axios";

const API_BASE_URL = "http://localhost:5003/api";

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
  getAll: () => api.get("/departments"),
  getById: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post("/departments", data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
};

// Campus API
export const campusAPI = {
  getAll: (params) => api.get("/campuses", { params }),
  getById: (id) => api.get(`/campuses/${id}`),
  create: (data) => api.post("/campuses", data),
  update: (id, data) => api.put(`/campuses/${id}`, data),
  delete: (id) => api.delete(`/campuses/${id}`),
};

// Building API
export const buildingAPI = {
  getAll: (params) => api.get("/buildings", { params }),
  getById: (id) => api.get(`/buildings/${id}`),
  create: (data) => api.post("/buildings", data),
  update: (id, data) => api.put(`/buildings/${id}`, data),
  delete: (id) => api.delete(`/buildings/${id}`),
};

// Floor API
export const floorAPI = {
  getAll: (params) => api.get("/floors", { params }),
  getById: (id) => api.get(`/floors/${id}`),
  create: (data) => api.post("/floors", data),
  update: (id, data) => api.put(`/floors/${id}`, data),
  delete: (id) => api.delete(`/floors/${id}`),
};

// Room API
export const roomAPI = {
  getAll: (params) => api.get("/rooms", { params }),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post("/rooms", data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
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

export default api;
