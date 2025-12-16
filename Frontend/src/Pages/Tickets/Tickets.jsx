import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import ticketAPI from "../../Config/ticketApi";
import "./Tickets.css";

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [ticketsAgainstMe, setTicketsAgainstMe] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [showAgainstMeAlert, setShowAgainstMeAlert] = useState(true);
  const [filter, setFilter] = useState({
    status: "",
    category: "",
    priority: "",
    showResolved: false,
  });
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Maintenance",
    priority: "Medium",
    department: "",
    reportedAgainst: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [compressedImages, setCompressedImages] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);

  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch { return {}; }
  })();
  const isSuperAdmin = user?.role?.name === "superAdmin";

  const canEditTicket = (ticket) => {
    return isSuperAdmin || ticket.reportedBy?._id === user?._id;
  };

  const categories = ["Maintenance", "Technical", "HR", "Administrative", "Other"];
  const priorities = ["Low", "Medium", "High", "Critical"];
  const statuses = ["Open", "In Progress", "Resolved", "Closed"];

  useEffect(() => {
    fetchTickets();
    fetchStats();
    fetchTicketsAgainstMe();
    fetchEmployees();
    fetchDepartments();
  }, [filter]);

  const fetchTicketsAgainstMe = async () => {
    try {
      const response = await ticketAPI.getAgainstMe();
      if (response.data.success) {
        const activeTickets = response.data.data.filter(
          t => t.status === "Open" || t.status === "In Progress"
        );
        setTicketsAgainstMe(activeTickets);
      }
    } catch (error) {
      console.error("Error fetching tickets against me:", error);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.category) params.category = filter.category;
      if (filter.priority) params.priority = filter.priority;
      if (filter.showResolved) params.includeInactive = true;

      const response = await ticketAPI.getAll(params);
      if (response.data.success) {
        setTickets(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await ticketAPI.getStats();
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await ticketAPI.getEmployeesForTicket();
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
      const response = await ticketAPI.getDepartmentsForTicket();
      if (response.data.success) {
        setDepartments(response.data.flatData || response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleDepartmentChange = async (departmentId) => {
    setFormData({ ...formData, department: departmentId, reportedAgainst: "" });
    
    if (departmentId) {
      try {
        const response = await ticketAPI.getEmployeesForTicket({ departmentId });
        if (response.data.success) {
          setFilteredEmployees(response.data.data);
        }
      } catch (error) {
        console.error("Error filtering employees:", error);
        const filtered = employees.filter(emp => emp.department?._id === departmentId);
        setFilteredEmployees(filtered);
      }
    } else {
      setFilteredEmployees(employees);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Prepare data with proper null handling for ObjectId fields
      const dataToSend = { ...formData };
      if (dataToSend.reportedAgainst === "") dataToSend.reportedAgainst = null;
      if (dataToSend.assignedTo === "") dataToSend.assignedTo = null;
      if (dataToSend.department === "") delete dataToSend.department;

      // Add compressed images as base64
      if (compressedImages.length > 0) {
        dataToSend.compressedImages = compressedImages.map((img) => ({
          dataUrl: img.dataUrl,
          name: img.name,
        }));
      }

      // Keep track of existing attachments (minus removed ones)
      if (selectedTicket && existingAttachments.length > 0) {
        dataToSend.existingAttachments = existingAttachments;
      }

      if (selectedTicket) {
        // Update ticket
        if (attachments.length > 0) {
          // If there are new non-image files, use FormData
          const formDataWithFiles = new FormData();
          Object.keys(dataToSend).forEach((key) => {
            if (dataToSend[key] !== null && dataToSend[key] !== undefined) {
              if (key === "compressedImages" || key === "existingAttachments") {
                formDataWithFiles.append(key, JSON.stringify(dataToSend[key]));
              } else {
                formDataWithFiles.append(key, dataToSend[key]);
              }
            }
          });
          attachments.forEach((file) => {
            formDataWithFiles.append("attachments", file);
          });
          await ticketAPI.updateWithFiles(selectedTicket._id, formDataWithFiles);
        } else {
          await ticketAPI.update(selectedTicket._id, dataToSend);
        }
        alert("Ticket updated successfully!");
      } else {
        // Create ticket
        if (attachments.length > 0) {
          const formDataWithFiles = new FormData();
          Object.keys(dataToSend).forEach((key) => {
            if (dataToSend[key] !== null && dataToSend[key] !== undefined) {
              if (key === "compressedImages") {
                formDataWithFiles.append(key, JSON.stringify(dataToSend[key]));
              } else {
                formDataWithFiles.append(key, dataToSend[key]);
              }
            }
          });
          attachments.forEach((file) => {
            formDataWithFiles.append("attachments", file);
          });
          await ticketAPI.createWithFiles(formDataWithFiles);
        } else {
          await ticketAPI.create(dataToSend);
        }
        alert("Ticket created successfully!");
      }
      resetForm();
      fetchTickets();
      fetchStats();
      fetchTicketsAgainstMe();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      alert(error.response?.data?.message || "Failed to submit ticket");
    } finally {
      setLoading(false);
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      // If not an image, return the file as-is
      if (!file.type.startsWith("image/")) {
        resolve({ file, isCompressed: false });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Compress as JPEG with 70% quality
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve({
            dataUrl: compressedDataUrl,
            name: file.name.replace(/\.[^/.]+$/, ".jpg"),
            isCompressed: true,
            originalSize: file.size,
            compressedSize: Math.round(compressedDataUrl.length * 0.75), // Approximate size
          });
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const totalFiles = files.length + attachments.length + compressedImages.length;
    
    if (totalFiles > 5) {
      alert("Maximum 5 files allowed");
      return;
    }

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
        continue;
      }

      if (file.type.startsWith("image/")) {
        // Compress images
        const result = await compressImage(file);
        if (result.isCompressed) {
          setCompressedImages((prev) => [...prev, result]);
        }
      } else {
        // Non-image files, check size limit
        if (file.size > 10 * 1024 * 1024) {
          alert(`File "${file.name}" is too large. Maximum size for non-image files is 10MB.`);
          continue;
        }
        setAttachments((prev) => [...prev, file]);
      }
    }
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const removeCompressedImage = (index) => {
    setCompressedImages(compressedImages.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index) => {
    setExistingAttachments(existingAttachments.filter((_, i) => i !== index));
  };

  const handleView = async (ticket) => {
    try {
      const response = await ticketAPI.getById(ticket._id);
      if (response.data.success) {
        setSelectedTicket(response.data.data);
        setShowViewModal(true);
      }
    } catch (error) {
      console.error("Error fetching ticket details:", error);
      alert("Failed to load ticket details");
    }
  };

  const handleEdit = (ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      reportedAgainst: ticket.reportedAgainst?._id || "",
      status: ticket.status,
      assignedTo: ticket.assignedTo?._id || "",
    });
    // Load existing attachments for display
    setExistingAttachments(ticket.attachments || []);
    setAttachments([]);
    setCompressedImages([]);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await ticketAPI.delete(id);
      alert("Ticket deleted successfully!");
      fetchTickets();
      fetchStats();
    } catch (error) {
      console.error("Error deleting ticket:", error);
      alert(error.response?.data?.message || "Failed to delete ticket");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const response = await ticketAPI.addComment(selectedTicket._id, newComment);
      if (response.data.success) {
        setSelectedTicket(response.data.data);
        setNewComment("");
        fetchTickets();
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "Maintenance",
      priority: "Medium",
      department: "",
      reportedAgainst: "",
    });
    setFilteredEmployees(employees);
    setSelectedTicket(null);
    setShowModal(false);
    setAttachments([]);
    setCompressedImages([]);
    setExistingAttachments([]);
  };

  const getStatusIcon = (status) => {
    const icons = {
      Open: "fa-folder-open",
      "In Progress": "fa-spinner",
      Resolved: "fa-check-circle",
      Closed: "fa-times-circle",
    };
    return icons[status] || "fa-ticket-alt";
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      Low: "fa-arrow-down",
      Medium: "fa-minus",
      High: "fa-arrow-up",
      Critical: "fa-exclamation-circle",
    };
    return icons[priority] || "fa-flag";
  };

  const getCategoryIcon = (category) => {
    const icons = {
      Maintenance: "fa-wrench",
      Technical: "fa-cog",
      HR: "fa-users",
      Administrative: "fa-file-alt",
      Other: "fa-ellipsis-h",
    };
    return icons[category] || "fa-tag";
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="tickets-page">
          {/* Page Header */}
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-ticket-alt"></i>
              </div>
              <div>
                <h1>Support Tickets</h1>
                <p>Manage and track support requests</p>
              </div>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <i className="fas fa-plus"></i> Create Ticket
            </button>
          </div>

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card total">
              <div className="stat-icon">
                <i className="fas fa-layer-group"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Tickets</span>
                <span className="stat-value">{stats.total || 0}</span>
              </div>
            </div>
            <div className="stat-card open">
              <div className="stat-icon">
                <i className="fas fa-folder-open"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Open</span>
                <span className="stat-value">{stats.open || 0}</span>
              </div>
            </div>
            <div className="stat-card progress">
              <div className="stat-icon">
                <i className="fas fa-spinner"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">In Progress</span>
                <span className="stat-value">{stats.inProgress || 0}</span>
              </div>
            </div>
            <div className="stat-card resolved">
              <div className="stat-icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Resolved</span>
                <span className="stat-value">{stats.resolved || 0}</span>
              </div>
            </div>
          </div>

          {/* Tickets Against Me Alert */}
          {ticketsAgainstMe.length > 0 && showAgainstMeAlert && (
            <div className="alert-box warning">
              <div className="alert-header">
                <div className="alert-icon">
                  <i className="fas fa-exclamation-triangle"></i>
                </div>
                <div className="alert-content">
                  <strong>Attention!</strong>
                  <span>You have {ticketsAgainstMe.length} ticket(s) reported against you</span>
                </div>
                <button className="alert-close" onClick={() => setShowAgainstMeAlert(false)}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="alert-tickets">
                {ticketsAgainstMe.map((ticket) => (
                  <div key={ticket._id} className="alert-ticket-item">
                    <div className="ticket-main-info">
                      <span className="ticket-id-badge">{ticket.ticketId}</span>
                      <span className="ticket-title">{ticket.title}</span>
                    </div>
                    <div className="ticket-badges">
                      <span className={`priority-badge ${ticket.priority.toLowerCase()}`}>
                        <i className={`fas ${getPriorityIcon(ticket.priority)}`}></i>
                        {ticket.priority}
                      </span>
                      <span className={`status-badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>
                        <i className={`fas ${getStatusIcon(ticket.status)}`}></i>
                        {ticket.status}
                      </span>
                    </div>
                    <div className="ticket-meta">
                      <span><i className="fas fa-user"></i> {ticket.reportedBy?.name}</span>
                      <span><i className="fas fa-calendar"></i> {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                    <button className="btn-view-ticket" onClick={() => handleView(ticket)}>
                      <i className="fas fa-eye"></i> View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="filters-card">
            <div className="filters-header">
              <i className="fas fa-filter"></i>
              <span>Filter Tickets</span>
            </div>
            <div className="filters-body">
              <div className="filter-group">
                <label><i className="fas fa-tag"></i> Category</label>
                <select
                  value={filter.category}
                  onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label><i className="fas fa-flag"></i> Priority</label>
                <select
                  value={filter.priority}
                  onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                >
                  <option value="">All Priorities</option>
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label><i className="fas fa-info-circle"></i> Status</label>
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                >
                  <option value="">All Statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group checkbox-filter">
                <label className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={filter.showResolved}
                    onChange={(e) => setFilter({ ...filter, showResolved: e.target.checked })}
                  />
                  <span className="checkmark"></span>
                  <span className="checkbox-text">Show Resolved/Closed</span>
                </label>
              </div>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="tickets-table-container">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Reported By</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8">
                      <div className="loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Loading tickets...</span>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="empty-state">
                        <i className="fas fa-ticket-alt"></i>
                        <span>No tickets found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket._id}>
                      <td>
                        <span className="ticket-id">{ticket.ticketId}</span>
                      </td>
                      <td>
                        <span className="ticket-title-cell">{ticket.title}</span>
                      </td>
                      <td>
                        <span className={`category-badge ${ticket.category.toLowerCase()}`}>
                          <i className={`fas ${getCategoryIcon(ticket.category)}`}></i>
                          {ticket.category}
                        </span>
                      </td>
                      <td>
                        <span className={`priority-badge ${ticket.priority.toLowerCase()}`}>
                          <i className={`fas ${getPriorityIcon(ticket.priority)}`}></i>
                          {ticket.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>
                          <i className={`fas ${getStatusIcon(ticket.status)}`}></i>
                          {ticket.status}
                        </span>
                      </td>
                      <td>
                        <div className="reporter-info">
                          <span className="reporter-name">{ticket.reportedBy?.name || "-"}</span>
                          <span className="reporter-role">{ticket.reportedBy?.role?.name || ""}</span>
                        </div>
                      </td>
                      <td>
                        <span className="date-cell">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-action view" onClick={() => handleView(ticket)} title="View">
                            <i className="fas fa-eye"></i>
                          </button>
                          {canEditTicket(ticket) && (
                            <>
                              <button className="btn-action edit" onClick={() => handleEdit(ticket)} title="Edit">
                                <i className="fas fa-edit"></i>
                              </button>
                              <button className="btn-action delete" onClick={() => handleDelete(ticket._id)} title="Delete">
                                <i className="fas fa-trash"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-title">
                    <i className="fas fa-ticket-alt"></i>
                    <span>{selectedTicket ? "Edit Ticket" : "Create New Ticket"}</span>
                  </div>
                  <button className="close-btn" onClick={() => setShowModal(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="form-section">
                      <h4 className="section-title"><i className="fas fa-info-circle"></i> Ticket Information</h4>
                      <div className="form-group">
                        <label><i className="fas fa-heading"></i> Title *</label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Enter ticket title"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-align-left"></i> Description *</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Describe the issue in detail..."
                          required
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label><i className="fas fa-tag"></i> Category *</label>
                          <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            required
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label><i className="fas fa-flag"></i> Priority *</label>
                          <select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            required
                          >
                            {priorities.map((priority) => (
                              <option key={priority} value={priority}>{priority}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {(departments.length > 0 || employees.length > 0) && (
                      <div className="form-section">
                        <h4 className="section-title"><i className="fas fa-user-tag"></i> Report Against (Optional)</h4>
                        <div className="form-row">
                          {departments.length > 0 && (
                            <div className="form-group">
                              <label><i className="fas fa-building"></i> Department</label>
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
                          )}
                          {employees.length > 0 && (
                            <div className="form-group">
                              <label><i className="fas fa-user"></i> Employee</label>
                              <select
                                value={formData.reportedAgainst}
                                onChange={(e) => setFormData({ ...formData, reportedAgainst: e.target.value })}
                              >
                                <option value="">Not Applicable</option>
                                {filteredEmployees.map((emp) => (
                                  <option key={emp._id} value={emp._id}>
                                    {emp.name} - {emp.employeeId}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="form-section">
                        <h4 className="section-title"><i className="fas fa-paperclip"></i> Attachments</h4>
                        <div className="file-upload-area">
                          <input
                            type="file"
                            id="ticket-attachments"
                            multiple
                            accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                            onChange={handleFileChange}
                          />
                          <label htmlFor="ticket-attachments" className="file-upload-label">
                            <i className="fas fa-cloud-upload-alt"></i>
                            <span>Click to upload files</span>
                            <small>Max 5 files • Images auto-compressed</small>
                          </label>
                        </div>

                        {/* Existing Attachments (Edit Mode) */}
                        {existingAttachments.length > 0 && (
                          <div className="attachments-section">
                            <span className="attachments-label">Existing Files:</span>
                            <div className="attachments-list">
                              {existingAttachments.map((attachment, index) => (
                                <div key={`existing-${index}`} className="attachment-item existing">
                                  <i className={`fas ${attachment.mimeType?.startsWith("image/") ? "fa-image" : "fa-file"}`}></i>
                                  <span className="attachment-name">{attachment.originalName || attachment.filename}</span>
                                  <button type="button" className="remove-attachment" onClick={() => removeExistingAttachment(index)}>
                                    <i className="fas fa-times"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Compressed Images */}
                        {compressedImages.length > 0 && (
                          <div className="attachments-section">
                            <span className="attachments-label">New Images (Compressed):</span>
                            <div className="attachments-list images-preview">
                              {compressedImages.map((img, index) => (
                                <div key={`compressed-${index}`} className="attachment-item image-preview-item">
                                  <img src={img.dataUrl} alt={img.name} className="attachment-thumbnail" />
                                  <span className="attachment-name">{img.name}</span>
                                  <button type="button" className="remove-attachment" onClick={() => removeCompressedImage(index)}>
                                    <i className="fas fa-times"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Non-Image Files */}
                        {attachments.length > 0 && (
                          <div className="attachments-section">
                            <span className="attachments-label">New Files:</span>
                            <div className="attachments-list">
                              {attachments.map((file, index) => (
                                <div key={`file-${index}`} className="attachment-item">
                                  <i className="fas fa-file"></i>
                                  <span className="attachment-name">{file.name}</span>
                                  <span className="attachment-size">({(file.size / 1024).toFixed(1)} KB)</span>
                                  <button type="button" className="remove-attachment" onClick={() => removeAttachment(index)}>
                                    <i className="fas fa-times"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                    {selectedTicket && (
                      <div className="form-section">
                        <h4 className="section-title"><i className="fas fa-cog"></i> Status Management</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label><i className="fas fa-info-circle"></i> Status</label>
                            <select
                              value={formData.status}
                              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </div>
                          {isSuperAdmin && (
                            <div className="form-group">
                              <label><i className="fas fa-user-check"></i> Assign To</label>
                              <select
                                value={formData.assignedTo || ""}
                                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                              >
                                <option value="">Not Assigned</option>
                                {employees.map((emp) => (
                                  <option key={emp._id} value={emp._id}>
                                    {emp.name} - {emp.employeeId}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? (
                        <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                      ) : (
                        <><i className="fas fa-save"></i> {selectedTicket ? "Update" : "Create"}</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* View Modal */}
          {showViewModal && selectedTicket && (
            <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
              <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-title">
                    <span className="ticket-id-modal">{selectedTicket.ticketId}</span>
                    <span>Ticket Details</span>
                  </div>
                  <button className="close-btn" onClick={() => setShowViewModal(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  {/* Ticket Hero */}
                  <div className="ticket-hero">
                    <h2 className="ticket-hero-title">{selectedTicket.title}</h2>
                    <div className="ticket-hero-badges">
                      <span className={`category-badge ${selectedTicket.category.toLowerCase()}`}>
                        <i className={`fas ${getCategoryIcon(selectedTicket.category)}`}></i>
                        {selectedTicket.category}
                      </span>
                      <span className={`priority-badge ${selectedTicket.priority.toLowerCase()}`}>
                        <i className={`fas ${getPriorityIcon(selectedTicket.priority)}`}></i>
                        {selectedTicket.priority}
                      </span>
                      <span className={`status-badge ${selectedTicket.status.toLowerCase().replace(' ', '-')}`}>
                        <i className={`fas ${getStatusIcon(selectedTicket.status)}`}></i>
                        {selectedTicket.status}
                      </span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="details-section">
                    <h4 className="section-title"><i className="fas fa-info-circle"></i> Details</h4>
                    <div className="details-grid">
                      <div className="detail-card">
                        <div className="detail-icon"><i className="fas fa-user"></i></div>
                        <div className="detail-content">
                          <span className="detail-label">Reported By</span>
                          <span className="detail-value">{selectedTicket.reportedBy?.name}</span>
                          <span className="detail-sub">{selectedTicket.reportedBy?.role?.name}</span>
                        </div>
                      </div>
                      <div className="detail-card">
                        <div className="detail-icon"><i className="fas fa-user-tag"></i></div>
                        <div className="detail-content">
                          <span className="detail-label">Reported Against</span>
                          <span className="detail-value">
                            {selectedTicket.reportedAgainst
                              ? `${selectedTicket.reportedAgainst.name}`
                              : "N/A"}
                          </span>
                          {selectedTicket.reportedAgainst && (
                            <span className="detail-sub">{selectedTicket.reportedAgainst.employeeId}</span>
                          )}
                        </div>
                      </div>
                      <div className="detail-card">
                        <div className="detail-icon"><i className="fas fa-calendar-plus"></i></div>
                        <div className="detail-content">
                          <span className="detail-label">Created</span>
                          <span className="detail-value">{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                          <span className="detail-sub">{new Date(selectedTicket.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      {selectedTicket.resolvedAt && (
                        <div className="detail-card">
                          <div className="detail-icon"><i className="fas fa-calendar-check"></i></div>
                          <div className="detail-content">
                            <span className="detail-label">Resolved</span>
                            <span className="detail-value">{new Date(selectedTicket.resolvedAt).toLocaleDateString()}</span>
                            <span className="detail-sub">{new Date(selectedTicket.resolvedAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="details-section">
                    <h4 className="section-title"><i className="fas fa-align-left"></i> Description</h4>
                    <div className="description-box">
                      {selectedTicket.description}
                    </div>
                  </div>

                  {/* Attachments */}
                  {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                    <div className="details-section">
                      <h4 className="section-title"><i className="fas fa-paperclip"></i> Attachments ({selectedTicket.attachments.length})</h4>
                      <div className="view-attachments-grid">
                        {selectedTicket.attachments.map((attachment, index) => (
                          <div key={index} className="view-attachment-item">
                            {attachment.mimeType?.startsWith("image/") || attachment.path?.startsWith("data:image/") ? (
                              <div className="view-attachment-image">
                                <img 
                                  src={attachment.path?.startsWith("data:") ? attachment.path : `/uploads/${attachment.filename}`} 
                                  alt={attachment.originalName || attachment.filename}
                                />
                              </div>
                            ) : (
                              <div className="view-attachment-file">
                                <i className="fas fa-file"></i>
                              </div>
                            )}
                            <span className="view-attachment-name">{attachment.originalName || attachment.filename}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="details-section">
                    <h4 className="section-title"><i className="fas fa-comments"></i> Comments</h4>
                    <div className="comments-list">
                      {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                        selectedTicket.comments.map((comment, index) => (
                          <div key={index} className="comment-item">
                            <div className="comment-avatar">
                              {comment.employee?.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="comment-body">
                              <div className="comment-header">
                                <span className="comment-author">{comment.employee?.name || "Unknown"}</span>
                                <span className="comment-date">{new Date(comment.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="comment-text">{comment.comment}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="no-comments">
                          <i className="fas fa-comment-slash"></i>
                          <span>No comments yet</span>
                        </div>
                      )}
                    </div>
                    <div className="add-comment">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") handleAddComment();
                        }}
                      />
                      <button onClick={handleAddComment}>
                        <i className="fas fa-paper-plane"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Tickets;
