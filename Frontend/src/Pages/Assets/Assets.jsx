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
    serialNumber: "",
    macAddress: "",
    category: "",
    condition: "Good",
    status: "Available",
    issueDate: "",
    purchasePrice: "",
    notes: "",
    department: "",
    assignToEmployee: "",
    image: null,
    location: {
      building: "",
      floor: "",
    },
  });
  const [imagePreview, setImagePreview] = useState(null);
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
      
      // Prepare asset data
      const assetData = {
        name: formData.name,
        category: formData.category,
        serialNumber: formData.serialNumber,
        macAddress: formData.macAddress,
        condition: formData.condition,
        status: formData.status,
        purchasePrice: formData.purchasePrice,
        issueDate: formData.issueDate,
        notes: formData.notes,
        location: formData.location,
      };

      // Add image if present (as base64)
      if (imagePreview) {
        assetData.images = [imagePreview];
      }
      
      if (selectedAsset) {
        await assetAPI.update(selectedAsset._id, assetData);
        assetId = selectedAsset._id;
        alert("Asset updated successfully!");
      } else {
        const response = await assetAPI.create(assetData);
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
      serialNumber: asset.serialNumber || "",
      macAddress: asset.macAddress || "",
      category: asset.category,
      condition: asset.condition,
      status: asset.status || "Available",
      issueDate: asset.issueDate ? asset.issueDate.split("T")[0] : "",
      purchasePrice: asset.purchasePrice || "",
      notes: asset.notes || "",
      department: "",
      assignToEmployee: "",
      image: null,
      location: {
        building: asset.location?.building || "",
        floor: asset.location?.floor || "",
      },
    });
    setImagePreview(asset.images && asset.images.length > 0 ? asset.images[0] : null);
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
      serialNumber: "",
      macAddress: "",
      category: "",
      condition: "Good",
      status: "Available",
      issueDate: "",
      purchasePrice: "",
      notes: "",
      department: "",
      assignToEmployee: "",
      image: null,
      location: {
        building: "",
        floor: "",
      },
    });
    setImagePreview(null);
    setFilteredEmployees(employees);
    setSelectedAsset(null);
  };

  // Compress image before upload
  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale down if larger than maxWidth
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to compressed JPEG
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      
      // Compress the image before preview/upload
      const compressedImage = await compressImage(file);
      setImagePreview(compressedImage);
    }
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
              <h1><i className="fas fa-laptop"></i> Asset Management</h1>
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
                <div className="stat-icon"><i className="fas fa-box"></i></div>
                <div className="stat-info">
                  <h3>Total Assets</h3>
                  <p className="stat-value">{stats.totalAssets}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><i className="fas fa-check-circle"></i></div>
                <div className="stat-info">
                  <h3>Available</h3>
                  <p className="stat-value">{stats.available}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><i className="fas fa-user"></i></div>
                <div className="stat-info">
                  <h3>Assigned</h3>
                  <p className="stat-value">{stats.assigned}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><i className="fas fa-exclamation-triangle"></i></div>
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
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Serial No.</th>
                  <th>MAC Address</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center" }}>
                      Loading...
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center" }}>
                      No assets found
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset._id}>
                      <td className="asset-id">{asset.assetId}</td>
                      <td>
                        <div className="asset-thumbnail">
                          {asset.images && asset.images.length > 0 ? (
                            <img src={asset.images[0]} alt={asset.name} />
                          ) : (
                            <div className="no-image">
                              <i className="fas fa-laptop"></i>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{asset.name}</td>
                      <td>{asset.category}</td>
                      <td className="serial-number">{asset.serialNumber || "-"}</td>
                      <td className="mac-address">{asset.macAddress || "-"}</td>
                      <td>{getConditionBadge(asset.condition)}</td>
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
                            <i className="fas fa-edit"></i>
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
                              <i className="fas fa-user"></i>
                            </button>
                          )}
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(asset._id)}
                            title="Delete"
                          >
                            <i className="fas fa-trash"></i>
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
                <form onSubmit={handleSubmit} className="asset-form">
                  <div className="form-section">
                    <h3 className="section-title"><i className="fas fa-info-circle"></i> Asset Information</h3>
                    <div className="form-grid">
                      <div className="form-group">
                        <label><i className="fas fa-tag"></i> Asset Name *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="e.g., Dell Laptop, HP Monitor"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-th-large"></i> Category *</label>
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
                      <div className="form-group">
                        <label><i className="fas fa-barcode"></i> Serial Number</label>
                        <input
                          type="text"
                          value={formData.serialNumber}
                          onChange={(e) =>
                            setFormData({ ...formData, serialNumber: e.target.value })
                          }
                          placeholder="e.g., SN-123456789"
                        />
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-network-wired"></i> MAC Address</label>
                        <input
                          type="text"
                          value={formData.macAddress}
                          onChange={(e) =>
                            setFormData({ ...formData, macAddress: e.target.value })
                          }
                          placeholder="e.g., AA:BB:CC:DD:EE:FF"
                        />
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-heartbeat"></i> Condition *</label>
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
                        <label><i className="fas fa-toggle-on"></i> Status *</label>
                        <select
                          value={formData.status}
                          onChange={(e) =>
                            setFormData({ ...formData, status: e.target.value })
                          }
                          required
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-money-bill-wave"></i> Purchase Price (PKR)</label>
                        <input
                          type="number"
                          value={formData.purchasePrice}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              purchasePrice: e.target.value,
                            })
                          }
                          placeholder="Enter price"
                        />
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-calendar-alt"></i> Issue Date *</label>
                        <input
                          type="date"
                          value={formData.issueDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              issueDate: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Image Upload Section */}
                  <div className="form-section">
                    <h3 className="section-title"><i className="fas fa-image"></i> Asset Image</h3>
                    <div className="image-upload-area">
                      <input
                        type="file"
                        id="assetImage"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="image-input"
                      />
                      <label htmlFor="assetImage" className="image-upload-label">
                        {imagePreview ? (
                          <div className="image-preview-container">
                            <img src={imagePreview} alt="Asset preview" className="image-preview" />
                            <div className="image-overlay">
                              <i className="fas fa-camera"></i>
                              <span>Change Image</span>
                            </div>
                          </div>
                        ) : (
                          <div className="upload-placeholder">
                            <i className="fas fa-cloud-upload-alt"></i>
                            <span>Click to upload asset image</span>
                            <small>PNG, JPG, GIF up to 5MB</small>
                          </div>
                        )}
                      </label>
                      {imagePreview && (
                        <button
                          type="button"
                          className="btn-remove-image"
                          onClick={() => {
                            setFormData({ ...formData, image: null });
                            setImagePreview(null);
                          }}
                        >
                          <i className="fas fa-times"></i> Remove Image
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Location Section */}
                  <div className="form-section">
                    <h3 className="section-title"><i className="fas fa-map-marker-alt"></i> Location</h3>
                    <div className="form-grid">
                      <div className="form-group">
                        <label><i className="fas fa-building"></i> Building</label>
                        <input
                          type="text"
                          value={formData.location.building}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              location: { ...formData.location, building: e.target.value },
                            })
                          }
                          placeholder="e.g., Block A, IT Tower"
                        />
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-layer-group"></i> Floor</label>
                        <input
                          type="text"
                          value={formData.location.floor}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              location: { ...formData.location, floor: e.target.value },
                            })
                          }
                          placeholder="e.g., Ground Floor, 3rd Floor"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Only show assignment section when creating new asset */}
                  {!selectedAsset && (
                    <div className="form-section">
                      <h3 className="section-title"><i className="fas fa-user-plus"></i> Assignment (Optional)</h3>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Filter by Department</label>
                          <select
                            value={formData.department}
                            onChange={(e) => handleDepartmentChange(e.target.value)}
                          >
                            <option value="">All Departments</option>
                            {departments.map((dept) => (
                              <option key={dept._id} value={dept._id}>
                                {"—".repeat(dept.level || 0)} {dept.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Assign to Employee</label>
                          <select
                            value={formData.assignToEmployee}
                            onChange={(e) =>
                              setFormData({ ...formData, assignToEmployee: e.target.value })
                            }
                          >
                            <option value="">Leave Unassigned</option>
                            {filteredEmployees.map((emp) => (
                              <option key={emp._id} value={emp._id}>
                                {emp.name} ({emp.employeeId})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="form-section">
                    <h3 className="section-title"><i className="fas fa-sticky-note"></i> Additional Info</h3>
                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        rows={3}
                        placeholder="Any additional information about the asset..."
                      />
                    </div>
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
                <form onSubmit={handleAssign} className="asset-form">
                  <div className="form-section">
                    <div className="asset-info-card">
                      <div className="asset-info-icon">
                        <i className="fas fa-laptop"></i>
                      </div>
                      <div className="asset-info-details">
                        <span className="asset-info-id">{selectedAsset.assetId}</span>
                        <span className="asset-info-name">{selectedAsset.name}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-section">
                    <h3 className="section-title"><i className="fas fa-user"></i> Assignment Details</h3>
                    <div className="form-grid">
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
                              {emp.name} ({emp.employeeId})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Condition</label>
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
                    </div>
                    <div className="form-group" style={{ marginTop: '14px' }}>
                      <label>Notes</label>
                      <textarea
                        value={assignData.notes}
                        onChange={(e) =>
                          setAssignData({ ...assignData, notes: e.target.value })
                        }
                        rows={2}
                        placeholder="Optional notes..."
                      />
                    </div>
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
