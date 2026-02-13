import api from "./Api";

const taskAPI = {
  getAll: (params) => api.get("/tasks", { params }),
  getMyTasks: (params) => api.get("/tasks/my-tasks", { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post("/tasks", data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  delete: (id) => api.delete(`/tasks/${id}`),
  addComment: (id, comment) => api.post(`/tasks/${id}/comment`, { comment }),
  getStats: (params) => api.get("/tasks/stats", { params }),
  getReport: (params) => api.get("/tasks/report", { params }),
};

export default taskAPI;
