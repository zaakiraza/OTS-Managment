import api from "./Api";

const ticketAPI = {
  getAll: (params) => api.get("/tickets", { params }),
  getById: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post("/tickets", data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  delete: (id) => api.delete(`/tickets/${id}`),
  addComment: (id, comment) => api.post(`/tickets/${id}/comment`, { comment }),
  getStats: () => api.get("/tickets/stats"),
};

export default ticketAPI;
