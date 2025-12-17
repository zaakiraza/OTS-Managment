import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { assetAPI, employeeAPI, departmentAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import * as XLSX from "xlsx";
import "./Assets.css";

function Assets() {
  const toast = useToast();
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);

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
        // If assigning to employee during creation, set status to Available first
        // The assign API will change it to Assigned
        status: formData.assignToEmployee ? "Available" : formData.status,
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
        toast.success("Asset updated successfully!");
      } else {
        const response = await assetAPI.create(assetData);
        assetId = response.data.data._id;
        
        // If employee is selected, assign the asset
        if (formData.assignToEmployee) {
          await assetAPI.assign({
            assetId: assetId,
            employeeId: formData.assignToEmployee,
            conditionAtAssignment: formData.condition,
            notes: formData.notes || "",
          });
          toast.success("Asset created and assigned successfully!");
        } else {
          toast.success("Asset created successfully!");
        }
      }

      setShowModal(false);
      resetForm();
      fetchAssets();
      fetchStats();
    } catch (error) {
      console.error("Error saving asset:", error);
      toast.error(error.response?.data?.message || "Failed to save asset");
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
      toast.success("Asset assigned successfully!");
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
      toast.error(error.response?.data?.message || "Failed to assign asset");
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
      toast.success("Asset deleted successfully!");
      fetchAssets();
      fetchStats();
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast.error(error.response?.data?.message || "Failed to delete asset");
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

  // Export assets to Excel
  const exportToExcel = () => {
    if (assets.length === 0) {
      toast.warning("No assets to export");
      return;
    }

    // Prepare data for export
    const exportData = assets.map((asset, index) => ({
      "S.No": index + 1,
      "Asset ID": asset.assetId || "",
      "Asset Name": asset.name || "",
      "Category": asset.category || "",
      "Serial Number": asset.serialNumber || "",
      "MAC Address": asset.macAddress || "",
      "Condition": asset.condition || "",
      "Status": asset.status || "",
      "Purchase Price (PKR)": asset.purchasePrice || "",
      "Issue Date": asset.issueDate ? new Date(asset.issueDate).toLocaleDateString() : "",
      "Building": asset.location?.building || "",
      "Floor": asset.location?.floor || "",
      "Assigned To (ID)": asset.assignedTo?.employeeId || "",
      "Assigned To (Name)": asset.assignedTo?.name || "",
      "Assignment Date": asset.assignedDate ? new Date(asset.assignedDate).toLocaleDateString() : "",
      "Notes": asset.notes || "",
      "Created At": asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : "",
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const colWidths = [
      { wch: 5 },   // S.No
      { wch: 12 },  // Asset ID
      { wch: 25 },  // Asset Name
      { wch: 15 },  // Category
      { wch: 20 },  // Serial Number
      { wch: 20 },  // MAC Address
      { wch: 10 },  // Condition
      { wch: 12 },  // Status
      { wch: 18 },  // Purchase Price
      { wch: 12 },  // Issue Date
      { wch: 15 },  // Building
      { wch: 12 },  // Floor
      { wch: 15 },  // Assigned To (ID)
      { wch: 20 },  // Assigned To (Name)
      { wch: 20 },  // Assigned To (Dept)
      { wch: 15 },  // Assignment Date
      { wch: 30 },  // Notes
      { wch: 12 },  // Created At
    ];
    ws["!cols"] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Assets");

    // Generate filename with current date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `Assets_Report_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  };

  // Download import template
  const downloadTemplate = () => {
    const templateData = [
      {
        "Asset Name": "Example Laptop",
        "Category": "Laptop",
        "Serial Number": "SN-123456",
        "MAC Address": "AA:BB:CC:DD:EE:FF",
        "Condition": "Good",
        "Status": "Available",
        "Purchase Price": "50000",
        "Issue Date": "2025-01-15",
        "Building": "Main Office",
        "Floor": "3rd Floor",
        "Notes": "Sample note"
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    ws["!cols"] = [
      { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Assets Template");
    XLSX.writeFile(wb, "Assets_Import_Template.xlsx");
  };

  // Handle file upload for import
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.warning("No data found in the file");
          return;
        }

        // Validate and transform data
        const errors = [];
        const validData = jsonData.map((row, index) => {
          const rowErrors = [];
          
          // Required field validation
          if (!row["Asset Name"]) rowErrors.push("Asset Name is required");
          if (!row["Category"]) rowErrors.push("Category is required");
          
          // Category validation
          const validCategories = categories;
          if (row["Category"] && !validCategories.includes(row["Category"])) {
            rowErrors.push(`Invalid category: ${row["Category"]}`);
          }

          // Condition validation
          const validConditions = ["Excellent", "Good", "Fair", "Poor"];
          if (row["Condition"] && !validConditions.includes(row["Condition"])) {
            rowErrors.push(`Invalid condition: ${row["Condition"]}`);
          }

          // Status validation
          const validStatuses = ["Available", "Assigned", "Under Repair", "Damaged", "Retired"];
          if (row["Status"] && !validStatuses.includes(row["Status"])) {
            rowErrors.push(`Invalid status: ${row["Status"]}`);
          }

          if (rowErrors.length > 0) {
            errors.push({ row: index + 2, errors: rowErrors });
          }

          return {
            name: row["Asset Name"] || "",
            category: row["Category"] || "",
            serialNumber: row["Serial Number"] || "",
            macAddress: row["MAC Address"] || "",
            condition: row["Condition"] || "Good",
            status: row["Status"] || "Available",
            purchasePrice: row["Purchase Price"] ? Number(row["Purchase Price"]) : null,
            issueDate: row["Issue Date"] || new Date().toISOString().split("T")[0],
            location: {
              building: row["Building"] || "",
              floor: row["Floor"] || "",
            },
            notes: row["Notes"] || "",
            isValid: rowErrors.length === 0,
          };
        });

        setImportData(validData);
        setImportErrors(errors);
      } catch (error) {
        console.error("Error parsing file:", error);
        toast.error("Error reading file. Please ensure it's a valid Excel or CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit import data
  const handleImportSubmit = async () => {
    const validAssets = importData.filter(asset => asset.isValid);
    
    if (validAssets.length === 0) {
      toast.warning("No valid assets to import");
      return;
    }

    try {
      setImporting(true);
      const response = await assetAPI.bulkCreate(validAssets);
      
      if (response.data.success) {
        toast.success(`Successfully imported ${response.data.data.created} assets!${response.data.data.errors?.length > 0 ? ` (${response.data.data.errors.length} failed)` : ''}`);
        setShowImportModal(false);
        setImportData([]);
        setImportErrors([]);
        fetchAssets();
        fetchStats();
      }
    } catch (error) {
      console.error("Error importing assets:", error);
      toast.error(error.response?.data?.message || "Failed to import assets");
    } finally {
      setImporting(false);
    }
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
            <div className="header-actions">
              <button
                className="btn-import"
                onClick={() => setShowImportModal(true)}
                title="Import from Excel/CSV"
              >
                <i className="fas fa-file-upload"></i> Import
              </button>
              <button
                className="btn-export"
                onClick={exportToExcel}
                title="Download Excel Report"
              >
                <i className="fas fa-file-excel"></i> Export
              </button>
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

                  {/* Show current assignment when editing, or assignment options when creating */}
                  {selectedAsset ? (
                    // Show current assignment info when editing
                    selectedAsset.assignedTo && (
                      <div className="form-section">
                        <h3 className="section-title"><i className="fas fa-user-check"></i> Current Assignment</h3>
                        <div className="current-assignment-card">
                          <div className="assignment-avatar">
                            {selectedAsset.assignedTo.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="assignment-details">
                            <span className="assignment-name">{selectedAsset.assignedTo.name}</span>
                            <span className="assignment-id">{selectedAsset.assignedTo.employeeId}</span>
                            {selectedAsset.assignedTo.department?.name && (
                              <span className="assignment-dept">
                                <i className="fas fa-building"></i> {selectedAsset.assignedTo.department.name}
                              </span>
                            )}
                          </div>
                          <div className="assignment-status">
                            <span className="status-badge assigned">Assigned</span>
                          </div>
                        </div>
                        <p className="assignment-note">
                          <i className="fas fa-info-circle"></i> To change assignment, use the "Assign" or "Return" actions from the assets list.
                        </p>
                      </div>
                    )
                  ) : (
                    // Show assignment options when creating new asset
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

          {/* Import Modal */}
          {showImportModal && (
            <div
              className="modal-overlay"
              onClick={() => {
                setShowImportModal(false);
                setImportData([]);
                setImportErrors([]);
              }}
            >
              <div
                className="modal-content modal-large"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2><i className="fas fa-file-upload"></i> Import Assets</h2>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportData([]);
                      setImportErrors([]);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="import-modal-body">
                  {/* Tips & Requirements */}
                  <div className="import-tips">
                    <div className="tips-header">
                      <i className="fas fa-lightbulb"></i>
                      <span>Import Guidelines</span>
                    </div>
                    <div className="tips-content">
                      <div className="tip-category">
                        <h5><i className="fas fa-asterisk text-danger"></i> Required Fields</h5>
                        <ul>
                          <li><strong>Asset Name</strong> - Name of the asset (e.g., "Dell Laptop i5")</li>
                          <li><strong>Category</strong> - Must be one of: Laptop, Desktop, Monitor, Keyboard, Mouse, Headphones, Cable/Wire, Router/Switch, Printer, Scanner, Webcam, Hard Drive, RAM, Other</li>
                        </ul>
                      </div>
                      <div className="tip-category">
                        <h5><i className="fas fa-info-circle text-info"></i> Optional Fields</h5>
                        <ul>
                          <li><strong>Serial Number</strong> - Device serial number</li>
                          <li><strong>MAC Address</strong> - Network MAC address (format: AA:BB:CC:DD:EE:FF)</li>
                          <li><strong>Condition</strong> - Excellent, Good, Fair, or Poor (default: Good)</li>
                          <li><strong>Status</strong> - Available, Assigned, Under Repair, Damaged, or Retired (default: Available)</li>
                          <li><strong>Purchase Price</strong> - Numeric value in PKR</li>
                          <li><strong>Issue Date</strong> - Date format: YYYY-MM-DD (default: today)</li>
                          <li><strong>Building, Floor</strong> - Location details</li>
                          <li><strong>Notes</strong> - Additional information</li>
                        </ul>
                      </div>
                      <div className="tip-caution">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Ensure Category, Condition, and Status values match exactly as listed above (case-sensitive).</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 1: Download Template */}
                  <div className="import-section">
                    <div className="import-step">
                      <span className="step-number">1</span>
                      <div className="step-content">
                        <h4>Download Template</h4>
                        <p>Download the Excel template with required columns</p>
                        <button className="btn-template" onClick={downloadTemplate}>
                          <i className="fas fa-download"></i> Download Template
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Upload File */}
                  <div className="import-section">
                    <div className="import-step">
                      <span className="step-number">2</span>
                      <div className="step-content">
                        <h4>Upload Excel/CSV File</h4>
                        <p>Fill in the template and upload it here</p>
                        <div className="file-upload-zone">
                          <input
                            type="file"
                            id="importFile"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleImportFile}
                            className="import-file-input"
                          />
                          <label htmlFor="importFile" className="import-file-label">
                            <i className="fas fa-cloud-upload-alt"></i>
                            <span>Click to select file or drag & drop</span>
                            <small>Supports .xlsx, .xls, .csv</small>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Preview & Validate */}
                  {importData.length > 0 && (
                    <div className="import-section">
                      <div className="import-step">
                        <span className="step-number">3</span>
                        <div className="step-content">
                          <h4>Preview & Validate</h4>
                          
                          {/* Summary */}
                          <div className="import-summary">
                            <div className="summary-item valid">
                              <i className="fas fa-check-circle"></i>
                              <span>{importData.filter(d => d.isValid).length} Valid</span>
                            </div>
                            <div className="summary-item invalid">
                              <i className="fas fa-times-circle"></i>
                              <span>{importData.filter(d => !d.isValid).length} Invalid</span>
                            </div>
                            <div className="summary-item total">
                              <i className="fas fa-list"></i>
                              <span>{importData.length} Total</span>
                            </div>
                          </div>

                          {/* Errors */}
                          {importErrors.length > 0 && (
                            <div className="import-errors">
                              <h5><i className="fas fa-exclamation-triangle"></i> Validation Errors</h5>
                              <div className="errors-list">
                                {importErrors.slice(0, 5).map((err, idx) => (
                                  <div key={idx} className="error-item">
                                    <span className="error-row">Row {err.row}:</span>
                                    <span className="error-msg">{err.errors.join(", ")}</span>
                                  </div>
                                ))}
                                {importErrors.length > 5 && (
                                  <p className="more-errors">...and {importErrors.length - 5} more errors</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Preview Table */}
                          <div className="import-preview">
                            <table className="preview-table">
                              <thead>
                                <tr>
                                  <th>Status</th>
                                  <th>Name</th>
                                  <th>Category</th>
                                  <th>Serial No.</th>
                                  <th>Condition</th>
                                </tr>
                              </thead>
                              <tbody>
                                {importData.slice(0, 10).map((item, idx) => (
                                  <tr key={idx} className={item.isValid ? "valid" : "invalid"}>
                                    <td>
                                      {item.isValid ? (
                                        <i className="fas fa-check-circle text-success"></i>
                                      ) : (
                                        <i className="fas fa-times-circle text-danger"></i>
                                      )}
                                    </td>
                                    <td>{item.name || "-"}</td>
                                    <td>{item.category || "-"}</td>
                                    <td>{item.serialNumber || "-"}</td>
                                    <td>{item.condition || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {importData.length > 10 && (
                              <p className="preview-more">Showing 10 of {importData.length} records</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportData([]);
                      setImportErrors([]);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleImportSubmit}
                    disabled={importing || importData.filter(d => d.isValid).length === 0}
                  >
                    {importing ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i> Importing...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload"></i> Import {importData.filter(d => d.isValid).length} Assets
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Assets;
