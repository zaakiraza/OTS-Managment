import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { assetAPI, employeeAPI, departmentAPI } from "../../Config/Api";
import "./Assets.css";

function Assets() {
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [filter, setFilter] = useState({
    status: "",
    category: "",
    search: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    condition: "Good",
    issueDate: "",
    purchasePrice: "",
    notes: "",
    department: "",
    assignToEmployee: "",
  });
  const [assignData, setAssignData] = useState({
    employeeId: "",
    conditionAtAssignment: "Good",
    notes: "",
  });
  const [stats, setStats] = useState(null);

  const categories = [
    "Laptop",
    "Desktop",
    "Monitor",
    "Keyboard",
    "Mouse",
    "Headphones",
    "Cable/Wire",
    "Router/Switch",
    "Printer",
    "Scanner",
    "Webcam",
    "Hard Drive",
    "RAM",
    "Other",
  ];

  const conditions = ["Excellent", "Good", "Fair", "Poor"];
  const statuses = ["Available", "Assigned", "Under Repair", "Damaged", "Retired"];

  useEffect(() => {
    fetchAssets();
    fetchStats();
    fetchEmployees();
    fetchDepartments();
  }, [filter]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.category) params.category = filter.category;
      if (filter.search) params.search = filter.search;

      const response = await assetAPI.getAll(params);
      if (response.data.success) {
        setAssets(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await assetAPI.getStats();
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ isActive: true });
      if (response.data.success) {
        setEmployees(response.data.data);
        setFilteredEmployees(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        // Use flatData which includes all departments (root + sub-departments)
        setDepartments(response.data.flatData || response.data.data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let assetId;
      
      if (selectedAsset) {
        await assetAPI.update(selectedAsset._id, formData);
        assetId = selectedAsset._id;
        alert("Asset updated successfully!");
      } else {
        const response = await assetAPI.create(formData);
        assetId = response.data.data._id;
        alert("Asset created successfully!");
      }

      // If employee is selected, assign the asset
      if (formData.assignToEmployee) {
        await assetAPI.assign({
          assetId: assetId,
          employeeId: formData.assignToEmployee,
          conditionAtAssignment: formData.condition,
          notes: formData.notes || "",
        });
      }

      setShowModal(false);
      resetForm();
      fetchAssets();
      fetchStats();
    } catch (error) {
      console.error("Error saving asset:", error);
      alert(error.response?.data?.message || "Failed to save asset");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await assetAPI.assign({
        assetId: selectedAsset._id,
        ...assignData,
      });
      alert("Asset assigned successfully!");
      setShowAssignModal(false);
      setSelectedAsset(null);
      setAssignData({
        employeeId: "",
        conditionAtAssignment: "Good",
        notes: "",
      });
      fetchAssets();
      fetchStats();
    } catch (error) {
      console.error("Error assigning asset:", error);
      alert(error.response?.data?.message || "Failed to assign asset");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (asset) => {
    setSelectedAsset(asset);
    setFormData({
      name: asset.name,
      category: asset.category,
      condition: asset.condition,
      issueDate: asset.issueDate ? asset.issueDate.split("T")[0] : "",
      purchasePrice: asset.purchasePrice || "",
      notes: asset.notes || "",
      department: "",
      assignToEmployee: "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;
    try {
      await assetAPI.delete(id);
      alert("Asset deleted successfully!");
      fetchAssets();
      fetchStats();
    } catch (error) {
      console.error("Error deleting asset:", error);
      alert(error.response?.data?.message || "Failed to delete asset");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      condition: "Good",
      issueDate: "",
      purchasePrice: "",
      notes: "",
      department: "",
      assignToEmployee: "",
    });
    setFilteredEmployees(employees);
    setSelectedAsset(null);
  };

  const handleDepartmentChange = (departmentId) => {
    setFormData({ ...formData, department: departmentId, assignToEmployee: "" });
    
    if (departmentId) {
      const filtered = employees.filter(emp => emp.department?._id === departmentId);
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      Available: "#4caf50",
      Assigned: "#2196f3",
      "Under Repair": "#ff9800",
      Damaged: "#f44336",
      Retired: "#9e9e9e",
    };
    return (
      <span
        className="status-badge"
        style={{ background: colors[status] || "#999" }}
      >
        {status}
      </span>
    );
  };

  const getConditionBadge = (condition) => {
    return (
      <span
        className={`condition-badge ${condition?.toLowerCase() || 'unknown'}`}
      >
        {condition}
      </span>
    );
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>🖥️ Asset Management</h1>
              <p>Manage IT assets and equipment</p>
            </div>
            <button
              className="btn-primary"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              + Add Asset
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-info">
                  <h3>Total Assets</h3>
                  <p className="stat-value">{stats.totalAssets}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <h3>Available</h3>
                  <p className="stat-value">{stats.available}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👤</div>
                <div className="stat-info">
                  <h3>Assigned</h3>
                  <p className="stat-value">{stats.assigned}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⚠️</div>
                <div className="stat-info">
                  <h3>Under Repair</h3>
                  <p className="stat-value">{stats.underRepair}</p>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="filters-container">
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Asset ID, Name, Serial..."
                value={filter.search}
                onChange={(e) =>
                  setFilter({ ...filter, search: e.target.value })
                }
              />
            </div>
            <div className="filter-group">
              <label>Category</label>
              <select
                value={filter.category}
                onChange={(e) =>
                  setFilter({ ...filter, category: e.target.value })
                }
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filter.status}
                onChange={(e) =>
                  setFilter({ ...filter, status: e.target.value })
                }
              >
                <option value="">All Status</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assets Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Condition</th>
                  <th>Issue Date</th>
                  <th>Purchase Price</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center" }}>
                      Loading...
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center" }}>
                      No assets found
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset._id}>
                      <td className="asset-id">{asset.assetId}</td>
                      <td>{asset.name}</td>
                      <td>{asset.category}</td>
                      <td>{getConditionBadge(asset.condition)}</td>
                      <td>
                        {asset.issueDate
                          ? new Date(asset.issueDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>
                        {asset.purchasePrice
                          ? `PKR ${asset.purchasePrice.toLocaleString()}`
                          : "-"}
                      </td>
                      <td>{getStatusBadge(asset.status)}</td>
                      <td>
                        {asset.assignedTo
                          ? `${asset.assignedTo.employeeId} - ${asset.assignedTo.name}`
                          : "-"}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-edit"
                            onClick={() => handleEdit(asset)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          {asset.status === "Available" && (
                            <button
                              className="btn-assign"
                              onClick={() => {
                                setSelectedAsset(asset);
                                setShowAssignModal(true);
                              }}
                              title="Assign"
                            >
                              👤
                            </button>
                          )}
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(asset._id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add/Edit Modal */}
          {showModal && (
            <div
              className="modal-overlay"
              onClick={() => setShowModal(false)}
            >
              <div
                className="modal-content modal-large"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>{selectedAsset ? "Edit Asset" : "Add New Asset"}</h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowModal(false)}
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Category *</label>
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                        required
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Condition *</label>
                      <select
                        value={formData.condition}
                        onChange={(e) =>
                          setFormData({ ...formData, condition: e.target.value })
                        }
                        required
                      >
                        {conditions.map((cond) => (
                          <option key={cond} value={cond}>
                            {cond}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Issue Date</label>
                      <input
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            issueDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Purchase Price (PKR) - Optional</label>
                    <input
                      type="number"
                      value={formData.purchasePrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          purchasePrice: e.target.value,
                        })
                      }
                      placeholder="Enter purchase price"
                    />
                  </div>

                  <div className="form-group">
                    <label>Department (For Employee Filter)</label>
                    <select
                      value={formData.department}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                    >
                      <option value="">-- All Departments --</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: "#666", fontSize: "12px" }}>
                      Select a department to filter employees below
                    </small>
                  </div>

                  <div className="form-group">
                    <label>Assign to Employee (Optional)</label>
                    <select
                      value={formData.assignToEmployee}
                      onChange={(e) =>
                        setFormData({ ...formData, assignToEmployee: e.target.value })
                      }
                    >
                      <option value="">-- Leave Unassigned --</option>
                      {filteredEmployees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} - {emp.employeeId} ({emp.department?.name || "N/A"})
                        </option>
                      ))}
                    </select>
                    <small style={{ color: "#666", fontSize: "12px" }}>
                      Select an employee to assign this asset immediately
                    </small>
                  </div>

                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows={3}
                      placeholder="Any additional information about the asset"
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                    >
                      {loading
                        ? "Saving..."
                        : selectedAsset
                        ? "Update Asset"
                        : "Add Asset"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Assign Modal */}
          {showAssignModal && selectedAsset && (
            <div
              className="modal-overlay"
              onClick={() => setShowAssignModal(false)}
            >
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>Assign Asset</h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowAssignModal(false)}
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleAssign}>
                  <div className="form-group">
                    <label>Asset</label>
                    <input
                      type="text"
                      value={`${selectedAsset.assetId} - ${selectedAsset.name}`}
                      disabled
                      style={{ background: "#f5f5f5" }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Assign to Employee *</label>
                    <select
                      value={assignData.employeeId}
                      onChange={(e) =>
                        setAssignData({
                          ...assignData,
                          employeeId: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.employeeId} - {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Condition at Assignment</label>
                    <select
                      value={assignData.conditionAtAssignment}
                      onChange={(e) =>
                        setAssignData({
                          ...assignData,
                          conditionAtAssignment: e.target.value,
                        })
                      }
                    >
                      {conditions.map((cond) => (
                        <option key={cond} value={cond}>
                          {cond}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={assignData.notes}
                      onChange={(e) =>
                        setAssignData({ ...assignData, notes: e.target.value })
                      }
                      rows={3}
                      placeholder="Any additional notes..."
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowAssignModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                    >
                      {loading ? "Assigning..." : "Assign Asset"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Assets;
