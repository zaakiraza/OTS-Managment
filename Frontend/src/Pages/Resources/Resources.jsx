import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { resourceAPI } from "../../Config/resourceApi";
import { departmentAPI, employeeAPI } from "../../Config/Api";
import "../Assets/Assets.css";

function Resources() {
  const [resources, setResources] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "Software Subscription",
    provider: "",
    cost: "",
    currency: "PKR",
    billingCycle: "Monthly",
    purchaseDate: "",
    expiryDate: "",
    status: "Active",
    department: "",
    assignedTo: "",
    description: "",
    accessUrl: "",
    credentials: {
      username: "",
      email: "",
      notes: "",
    },
  });

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const resourceTypes = [
    "Software Subscription",
    "API Key",
    "Cloud Service",
    "Domain",
    "License",
    "Tool Access",
    "Other",
  ];

  const currencies = ["PKR", "USD", "EUR", "GBP"];
  const billingCycles = ["Monthly", "Quarterly", "Yearly", "One-time", "Custom"];
  const statuses = ["Active", "Expired", "Cancelled", "Pending"];

  useEffect(() => {
    fetchResources();
    fetchStats();
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const response = await resourceAPI.getAll();
      if (response.data.success) {
        setResources(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await resourceAPI.getStats();
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedResource) {
        await resourceAPI.update(selectedResource._id, formData);
        alert("Resource updated successfully!");
      } else {
        await resourceAPI.create(formData);
        alert("Resource created successfully!");
      }
      setShowModal(false);
      resetForm();
      fetchResources();
      fetchStats();
    } catch (error) {
      console.error("Error saving resource:", error);
      alert(error.response?.data?.message || "Failed to save resource");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this resource?")) return;
    try {
      await resourceAPI.delete(id);
      alert("Resource deleted successfully!");
      fetchResources();
      fetchStats();
    } catch (error) {
      console.error("Error deleting resource:", error);
      alert("Failed to delete resource");
    }
  };

  const handleEdit = (resource) => {
    setSelectedResource(resource);
    setFormData({
      name: resource.name,
      type: resource.type,
      provider: resource.provider || "",
      cost: resource.cost || "",
      currency: resource.currency,
      billingCycle: resource.billingCycle || "Monthly",
      purchaseDate: resource.purchaseDate ? resource.purchaseDate.split("T")[0] : "",
      expiryDate: resource.expiryDate ? resource.expiryDate.split("T")[0] : "",
      status: resource.status,
      department: resource.department?._id || "",
      assignedTo: resource.assignedTo?._id || "",
      description: resource.description || "",
      accessUrl: resource.accessUrl || "",
      credentials: resource.credentials || { username: "", email: "", notes: "" },
    });
    setShowModal(true);
  };

  const handleViewDetails = (resource) => {
    setSelectedResource(resource);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setSelectedResource(null);
    setFormData({
      name: "",
      type: "Software Subscription",
      provider: "",
      cost: "",
      currency: "PKR",
      billingCycle: "Monthly",
      purchaseDate: "",
      expiryDate: "",
      status: "Active",
      department: user.userType === "employee" ? user.department : "",
      assignedTo: "",
      description: "",
      accessUrl: "",
      credentials: { username: "", email: "", notes: "" },
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      Active: "#10b981",
      Expired: "#ef4444",
      Cancelled: "#6b7280",
      Pending: "#f59e0b",
    };
    return colors[status] || "#999";
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="assets-page">
          <div className="page-header">
            <div>
              <h1>Resources Management</h1>
              <p>Track external resources, subscriptions, and tools</p>
            </div>
            <button className="btn btn-primary" onClick={() => {
              resetForm();
              setShowModal(true);
            }}>
              + Add Resource
            </button>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-content">
                <h3>Total Resources</h3>
                <p className="stat-value">{stats.total || 0}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Active</h3>
                <p className="stat-value" style={{ color: "#10b981" }}>
                  {stats.active || 0}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Total Cost</h3>
                <p className="stat-value" style={{ color: "#3b82f6" }}>
                  PKR {stats.totalCost?.toLocaleString() || 0}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Expiring Soon</h3>
                <p className="stat-value" style={{ color: "#f59e0b" }}>
                  {stats.expiringThisMonth || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Resources Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Resource ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Expiry Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center" }}>Loading...</td>
                  </tr>
                ) : resources.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center" }}>No resources found</td>
                  </tr>
                ) : (
                  resources.map((resource) => (
                    <tr key={resource._id}>
                      <td>
                        <span className="asset-id-badge">{resource.resourceId}</span>
                      </td>
                      <td>{resource.name}</td>
                      <td>{resource.type}</td>
                      <td>{resource.department?.name}</td>
                      <td>
                        {resource.cost ? `${resource.currency} ${resource.cost.toLocaleString()}` : "N/A"}
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            background: getStatusColor(resource.status),
                            color: "white",
                          }}
                        >
                          {resource.status}
                        </span>
                      </td>
                      <td>
                        {resource.expiryDate
                          ? new Date(resource.expiryDate).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td>
                        <button
                          className="btn btn-icon"
                          onClick={() => handleViewDetails(resource)}
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button
                          className="btn btn-icon"
                          onClick={() => handleEdit(resource)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={() => handleDelete(resource._id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal - simplified for space */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedResource ? "Edit Resource" : "Add New Resource"}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Resource Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      required
                    >
                      {resourceTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Provider</label>
                    <input
                      type="text"
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Department *</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      required
                      disabled={user.userType === "employee"}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Assigned To (Optional)</label>
                    <select
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    >
                      <option value="">Not Assigned</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cost</label>
                    <input
                      type="number"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    >
                      {currencies.map((curr) => (
                        <option key={curr} value={curr}>{curr}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Billing Cycle</label>
                    <select
                      value={formData.billingCycle}
                      onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    >
                      {billingCycles.map((cycle) => (
                        <option key={cycle} value={cycle}>{cycle}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Purchase Date</label>
                    <input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Access URL</label>
                    <input
                      type="url"
                      value={formData.accessUrl}
                      onChange={(e) => setFormData({ ...formData, accessUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="3"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {selectedResource ? "Update" : "Create"} Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedResource && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Resource Details - {selectedResource.resourceId}</h2>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{selectedResource.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Type</span>
                  <span className="detail-value">{selectedResource.type}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Provider</span>
                  <span className="detail-value">{selectedResource.provider || "N/A"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department</span>
                  <span className="detail-value">{selectedResource.department?.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Assigned To</span>
                  <span className="detail-value">{selectedResource.assignedTo?.name || "Not Assigned"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Cost</span>
                  <span className="detail-value">
                    {selectedResource.cost
                      ? `${selectedResource.currency} ${selectedResource.cost.toLocaleString()}`
                      : "N/A"}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Billing Cycle</span>
                  <span className="detail-value">{selectedResource.billingCycle || "N/A"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span
                    className="detail-value"
                    style={{ color: getStatusColor(selectedResource.status) }}
                  >
                    {selectedResource.status}
                  </span>
                </div>
                {selectedResource.purchaseDate && (
                  <div className="detail-item">
                    <span className="detail-label">Purchase Date</span>
                    <span className="detail-value">
                      {new Date(selectedResource.purchaseDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedResource.expiryDate && (
                  <div className="detail-item">
                    <span className="detail-label">Expiry Date</span>
                    <span className="detail-value">
                      {new Date(selectedResource.expiryDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedResource.accessUrl && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Access URL</span>
                    <span className="detail-value">
                      <a href={selectedResource.accessUrl} target="_blank" rel="noopener noreferrer">
                        {selectedResource.accessUrl}
                      </a>
                    </span>
                  </div>
                )}
                {selectedResource.description && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Description</span>
                    <span className="detail-value">{selectedResource.description}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Resources;
