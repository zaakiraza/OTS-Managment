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
    quantity: 1,
    category: "",
    condition: "Good",
    status: "Available",
    issueDate: "",
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
    department: "",
    employeeId: "",
    quantityToAssign: 1,
    conditionAtAssignment: "Good",
    notes: "",
  });
  const [stats, setStats] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFields, setExportFields] = useState({
    "S.No": true,
    "Asset ID": true,
    "Asset Name": true,
    "Quantity": true,
    "Quantity Assigned": true,
    "Category": true,
    "Condition": true,
    "Status": true,
    "Issue Date": true,
    "Building": true,
    "Floor": true,
    "Notes": true,
    "Created At": true,
  });

  const categories = [
    "Laptop",
    "Desktop",
    "System",
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
  const statuses = ["Available", "Assigned", "Under Repair", "Damaged", "Retired", "Refurb", "New"];

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

  const fetchAssignments = async (assetId) => {
    try {
      setAssignmentsLoading(true);
      const response = await assetAPI.getHistory(assetId);
      if (response.data.success) {
        setAssignments(response.data.data);
        setShowAssignmentsModal(true);
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("Failed to fetch assignments");
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const handleUnassign = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to unassign this asset?")) {
      return;
    }
    try {
      setAssignmentsLoading(true);
      await assetAPI.return({
        assignmentId,
        conditionAtReturn: "Good",
        returnNotes: "Asset unassigned",
        status: "Returned",
      });
      toast.success("Asset unassigned successfully!");
      // Refresh the assignments list
      await fetchAssignments(selectedAsset._id);
      fetchAssets();
      fetchStats();
    } catch (error) {
      console.error("Error unassigning asset:", error);
      toast.error(error.response?.data?.message || "Failed to unassign asset");
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ isActive: true, forAssignment: true, noPagination: true });
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
      const response = await departmentAPI.getAll({ forAssignment: true });
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
        quantity: parseInt(formData.quantity) || 1,
        category: formData.category,
        condition: formData.condition,
        // If assigning to employee during creation, set status to Available first
        // The assign API will change it to Assigned
        status: formData.assignToEmployee ? "Available" : formData.status,
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
        department: "",
        employeeId: "",
        quantityToAssign: 1,
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
      quantity: asset.quantity || 1,
      category: asset.category,
      condition: asset.condition,
      status: asset.status || "Available",
      issueDate: asset.issueDate ? asset.issueDate.split("T")[0] : "",
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
      quantity: 1,
      category: "",
      condition: "Good",
      status: "Available",
      issueDate: "",
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

  const handleAssignDepartmentChange = (departmentId) => {
    setAssignData({ ...assignData, department: departmentId, employeeId: "" });
  };

  const getAssignFilteredEmployees = () => {
    if (assignData.department) {
      const filtered = employees.filter(emp => {
        const empDeptId = emp.department?._id || emp.department;
        return empDeptId === assignData.department;
      });
      return filtered;
    }
    return employees;
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
    setShowExportModal(true);
  };

  const handleExport = () => {
    // Get only selected fields
    const selectedFields = Object.keys(exportFields).filter(field => exportFields[field]);
    
    if (selectedFields.length === 0) {
      toast.warning("Please select at least one field to export");
      return;
    }

    // Prepare data for export
    const exportData = assets.map((asset, index) => {
      const row = {};
      
      selectedFields.forEach(field => {
        switch(field) {
          case "S.No":
            row["S.No"] = index + 1;
            break;
          case "Asset ID":
            row["Asset ID"] = asset.assetId || "";
            break;
          case "Asset Name":
            row["Asset Name"] = asset.name || "";
            break;
          case "Quantity":
            row["Quantity"] = asset.quantity || 1;
            break;
          case "Quantity Assigned":
            row["Quantity Assigned"] = asset.quantityAssigned || 0;
            break;
          case "Category":
            row["Category"] = asset.category || "";
            break;
          case "Condition":
            row["Condition"] = asset.condition || "";
            break;
          case "Status":
            row["Status"] = asset.status || "";
            break;
          case "Issue Date":
            row["Issue Date"] = asset.issueDate ? new Date(asset.issueDate).toLocaleDateString() : "";
            break;
          case "Building":
            row["Building"] = asset.location?.building || "";
            break;
          case "Floor":
            row["Floor"] = asset.location?.floor || "";
            break;
          case "Notes":
            row["Notes"] = asset.notes || "";
            break;
          case "Created At":
            row["Created At"] = asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : "";
            break;
          default:
            break;
        }
      });
      
      return row;
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths based on selected fields
    const colWidths = selectedFields.map(field => {
      switch(field) {
        case "S.No": return { wch: 5 };
        case "Asset ID": return { wch: 12 };
        case "Asset Name": return { wch: 25 };
        case "Quantity": return { wch: 10 };
        case "Quantity Assigned": return { wch: 15 };
        case "Category": return { wch: 15 };
        case "Condition": return { wch: 10 };
        case "Status": return { wch: 12 };
        case "Issue Date": return { wch: 12 };
        case "Building": return { wch: 15 };
        case "Floor": return { wch: 12 };
        case "Notes": return { wch: 30 };
        case "Created At": return { wch: 12 };
        default: return { wch: 15 };
      }
    });
    ws["!cols"] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Assets");

    // Generate filename with current date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `Assets_Report_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
    setShowExportModal(false);
    toast.success("Assets exported successfully!");
  };

  // Download import template
  const downloadTemplate = () => {
    const templateData = [
      {
        "Asset Name": "Example Laptop",
        "Quantity": "5",
        "Category": "Laptop",
        "Condition": "Good",
        "Status": "Available",
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
      { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }
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
          const validStatuses = ["Available", "Assigned", "Under Repair", "Damaged", "Retired", "Refurb", "New"];
          if (row["Status"] && !validStatuses.includes(row["Status"])) {
            rowErrors.push(`Invalid status: ${row["Status"]}`);
          }

          if (rowErrors.length > 0) {
            errors.push({ row: index + 2, errors: rowErrors });
          }

          return {
            name: row["Asset Name"] || "",
            quantity: row["Quantity"] ? parseInt(row["Quantity"]) : 1,
            category: row["Category"] || "",
            condition: row["Condition"] || "Good",
            status: row["Status"] || "Available",
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
                  <th>Name</th>
                  <th>Quantity</th>
                  <th>Category</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center" }}>
                      Loading...
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center" }}>
                      No assets found
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const available = (asset.quantity || 1) - (asset.quantityAssigned || 0);
                    const total = asset.quantity || 1;
                    return (
                    <tr key={asset._id}>
                      <td className="asset-id">{asset.assetId}</td>
                      <td>{asset.name}</td>
                      <td>
                        <span style={{ color: available === 0 ? '#f44336' : available < total ? '#ff9800' : '#4caf50' }}>
                          {available}
                        </span>
                        {' / '}{total}
                      </td>
                      <td>{asset.category}</td>
                      <td>{getConditionBadge(asset.condition)}</td>
                      <td>{getStatusBadge(asset.status)}</td>
                      <td>
                        {asset.quantityAssigned > 0
                          ? `${asset.quantityAssigned} assigned`
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
                          {available > 0 && (
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
                          {asset.quantityAssigned > 0 && (
                            <button
                              className="btn-view"
                              onClick={() => fetchAssignments(asset._id)}
                              title="View Assignments"
                              style={{ backgroundColor: '#2196f3', color: 'white' }}
                            >
                              <i className="fas fa-eye"></i>
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
                    );
                  })
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
                        <label><i className="fas fa-box"></i> Quantity *</label>
                        <input
                          type="number"
                          value={formData.quantity}
                          onChange={(e) =>
                            setFormData({ ...formData, quantity: e.target.value })
                          }
                          placeholder="How many items"
                          min="1"
                          required
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
                    // Show assignment options when creating new asset AND status is "Assigned"
                    formData.status === "Assigned" && (
                      <div className="form-section">
                        <h3 className="section-title"><i className="fas fa-user-plus"></i> Assignment</h3>
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
                            <label>Assign to Employee *</label>
                            <select
                              value={formData.assignToEmployee}
                              onChange={(e) =>
                                setFormData({ ...formData, assignToEmployee: e.target.value })
                              }
                              required
                            >
                              <option value="">Select Employee</option>
                              {filteredEmployees.map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                  {emp.name} ({emp.employeeId})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )
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
                        <label>Select Department</label>
                        <select
                          value={assignData.department}
                          onChange={(e) => handleAssignDepartmentChange(e.target.value)}
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
                          {getAssignFilteredEmployees().map((emp) => (
                            <option key={emp._id} value={emp._id}>
                              {emp.name} ({emp.employeeId})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>
                          Quantity to Assign * 
                          <span style={{ color: '#666', fontSize: '0.9em', marginLeft: '10px' }}>
                            (Available: {(selectedAsset?.quantity || 1) - (selectedAsset?.quantityAssigned || 0)})
                          </span>
                        </label>
                        <input
                          type="number"
                          value={assignData.quantityToAssign}
                          onChange={(e) =>
                            setAssignData({
                              ...assignData,
                              quantityToAssign: parseInt(e.target.value) || 1,
                            })
                          }
                          min="1"
                          max={(selectedAsset?.quantity || 1) - (selectedAsset?.quantityAssigned || 0)}
                          required
                        />
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
                          <li><strong>Condition</strong> - Excellent, Good, Fair, or Poor (default: Good)</li>
                          <li><strong>Status</strong> - Available, Assigned, Under Repair, Damaged, Retired, Refurb, or New (default: Available)</li>
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
                                  <th>Quantity</th>
                                  <th>Category</th>
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
                                    <td>{item.quantity || 1}</td>
                                    <td>{item.category || "-"}</td>
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

          {/* View Assignments Modal */}
          {showAssignmentsModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ width: "100%", maxWidth: "1200px" }}>
                <div className="modal-header">
                  <h2>
                    Assignments {selectedAsset?.name ? `- ${selectedAsset.name} (${selectedAsset.assetId})` : ""}
                  </h2>
                  <button
                    className="modal-close"
                    onClick={() => setShowAssignmentsModal(false)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "28px",
                      cursor: "pointer",
                      color: "#666",
                      padding: "0 10px",
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="modal-body">
                  {assignmentsLoading ? (
                    <div style={{ textAlign: "center", padding: "20px" }}>
                      <p>Loading assignments...</p>
                    </div>
                  ) : assignments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px" }}>
                      <p>No assignments found for this asset.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", width: "100%" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f0f0f0" }}>
                            <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Employee</th>
                            <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Quantity</th>
                            <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Assigned Date</th>
                            <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Condition at Assignment</th>
                            <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Status</th>
                            <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Return Date</th>
                            <th style={{ padding: "10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Notes</th>
                            <th style={{ padding: "10px", textAlign: "center", borderBottom: "2px solid #ddd" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignments.map((assignment, index) => (
                            <tr key={assignment._id} style={{ borderBottom: "1px solid #eee" }}>
                              <td style={{ padding: "10px" }}>
                                {assignment.employee?.name} ({assignment.employee?.employeeId})
                              </td>
                              <td style={{ padding: "10px" }}>
                                <span style={{ 
                                  backgroundColor: "#e3f2fd", 
                                  padding: "4px 8px", 
                                  borderRadius: "4px",
                                  fontWeight: "bold"
                                }}>
                                  {assignment.quantity}
                                </span>
                              </td>
                              <td style={{ padding: "10px" }}>
                                {new Date(assignment.assignedDate).toLocaleDateString()}
                              </td>
                              <td style={{ padding: "10px" }}>
                                <span style={{
                                  backgroundColor: 
                                    assignment.conditionAtAssignment === "Excellent" ? "#c8e6c9" :
                                    assignment.conditionAtAssignment === "Good" ? "#fff9c4" :
                                    assignment.conditionAtAssignment === "Fair" ? "#ffe0b2" :
                                    "#ffcdd2",
                                  padding: "4px 8px",
                                  borderRadius: "4px"
                                }}>
                                  {assignment.conditionAtAssignment}
                                </span>
                              </td>
                              <td style={{ padding: "10px" }}>
                                <span style={{
                                  backgroundColor:
                                    assignment.status === "Active" ? "#c8e6c9" :
                                    assignment.status === "Returned" ? "#bbdefb" :
                                    assignment.status === "Damaged" ? "#ffcdd2" :
                                    "#f0f0f0",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  color: assignment.status === "Active" ? "#2e7d32" : "#333"
                                }}>
                                  {assignment.status}
                                </span>
                              </td>
                              <td style={{ padding: "10px" }}>
                                {assignment.returnDate 
                                  ? new Date(assignment.returnDate).toLocaleDateString()
                                  : "-"
                                }
                              </td>
                              <td style={{ padding: "10px", fontSize: "0.9em" }}>
                                {assignment.notes || "-"}
                              </td>
                              <td style={{ padding: "10px", textAlign: "center" }}>
                                {assignment.status === "Active" && (
                                  <button
                                    onClick={() => handleUnassign(assignment._id)}
                                    disabled={assignmentsLoading}
                                    style={{
                                      backgroundColor: "#f44336",
                                      color: "white",
                                      border: "none",
                                      padding: "6px 12px",
                                      borderRadius: "4px",
                                      cursor: assignmentsLoading ? "not-allowed" : "pointer",
                                      fontSize: "0.9em",
                                      opacity: assignmentsLoading ? 0.6 : 1,
                                    }}
                                    title="Unassign this asset"
                                  >
                                    <i className="fas fa-times"></i> Unassign
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn-secondary"
                    onClick={() => setShowAssignmentsModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Export Modal */}
          {showExportModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: "500px" }}>
                <div className="modal-header">
                  <h2>Select Fields to Export</h2>
                  <button
                    className="modal-close"
                    onClick={() => setShowExportModal(false)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "28px",
                      cursor: "pointer",
                      color: "#666",
                      padding: "0 10px",
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="modal-body">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    {Object.keys(exportFields).map((field) => (
                      <label
                        key={field}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          padding: "8px",
                          borderRadius: "4px",
                          backgroundColor: exportFields[field] ? "#e3f2fd" : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={exportFields[field]}
                          onChange={(e) =>
                            setExportFields({
                              ...exportFields,
                              [field]: e.target.checked,
                            })
                          }
                          style={{ marginRight: "8px", cursor: "pointer" }}
                        />
                        <span>{field}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn-secondary"
                    onClick={() => setShowExportModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleExport}
                    style={{
                      backgroundColor: "#4caf50",
                      color: "white",
                      border: "none",
                      padding: "10px 20px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "1em",
                    }}
                  >
                    <i className="fas fa-file-excel"></i> Export
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
