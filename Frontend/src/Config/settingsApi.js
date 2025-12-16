import api from "./Api";

const settingsAPI = {
  // Get all settings
  getAll: () => api.get("/settings"),
  
  // Get a specific setting
  get: (key) => api.get(`/settings/${key}`),
  
  // Update a single setting (superAdmin only)
  update: (data) => api.put("/settings", data),
  
  // Update multiple settings (superAdmin only)
  updateBulk: (settings) => api.put("/settings/bulk", { settings }),
  
  // Check if a feature is enabled
  checkFeature: (feature) => api.get(`/settings/feature/${feature}`),
};

export default settingsAPI;

