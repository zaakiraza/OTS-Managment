import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import ticketAPI from "../../Config/ticketApi";
import { employeeAPI, departmentAPI } from "../../Config/Api";
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
    showResolved: false, // Show resolved/closed tickets (inactive)
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

  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch { return {}; }
  })();
  const isSuperAdmin = user?.role?.name === "superAdmin";

  // Check if current user can edit/delete a specific ticket
  const canEditTicket = (ticket) => {
    return isSuperAdmin || ticket.reportedBy?._id === user?._id;
  };

  const categories = ["Maintenance", "Technical", "HR", "Administrative", "Other"];
  const priorities = ["Low", "Medium", "High", "Critical"];
  const statuses = ["Open", "In Progress", "Resolved", "Closed"];

  useEffect(() => {
    fetchTickets();
    fetchStats();
    fetchEmployees();
    fetchDepartments();
    fetchTicketsAgainstMe();
  }, [filter]);

  const fetchTicketsAgainstMe = async () => {
    try {
      const response = await ticketAPI.getAgainstMe();
      if (response.data.success) {
        // Only show open/in-progress tickets
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
        // Use flatData to get all departments including sub-departments
        setDepartments(response.data.flatData || response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleDepartmentChange = (departmentId) => {
    setFormData({ ...formData, department: departmentId, reportedAgainst: "" });
    
    if (departmentId) {
      const filtered = employees.filter(emp => emp.department?._id === departmentId);
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (selectedTicket) {
        await ticketAPI.update(selectedTicket._id, formData);
        alert("Ticket updated successfully!");
      } else {
        // Check if there are attachments
        if (attachments.length > 0) {
          const formDataWithFiles = new FormData();
          // Add form fields
          Object.keys(formData).forEach((key) => {
            if (formData[key]) {
              formDataWithFiles.append(key, formData[key]);
            }
          });
          // Add files
          attachments.forEach((file) => {
            formDataWithFiles.append("attachments", file);
          });
          await ticketAPI.createWithFiles(formDataWithFiles);
        } else {
          await ticketAPI.create(formData);
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

  // Handle file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + attachments.length > 5) {
      alert("Maximum 5 files allowed");
      return;
    }
    // Check file sizes (max 10MB each)
    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });
    setAttachments([...attachments, ...validFiles]);
  };

  // Remove attachment
  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
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
  };

  const getStatusBadge = (status) => {
    const colors = {
      Open: "#3b82f6",
      "In Progress": "#f59e0b",
      Resolved: "#10b981",
      Closed: "#6b7280",
    };
    return (
      <span
        className="status-badge"
        style={{ background: colors[status] || "#999", color: "white" }}
      >
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      Low: "#10b981",
      Medium: "#f59e0b",
      High: "#ef4444",
      Critical: "#7c3aed",
    };
    return (
      <span
        className="priority-badge"
        style={{ background: colors[priority] || "#999", color: "white" }}
      >
        {priority}
      </span>
    );
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="tickets-page">
          {/* Page Header */}
          <div className="page-header">
        <h1>Support Tickets</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Create Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="stats-container">
        <div className="stat-card">
          <h3>Total Tickets</h3>
          <div className="value">{stats.total || 0}</div>
        </div>
        <div className="stat-card">
          <h3>Open</h3>
          <div className="value" style={{ color: "#3b82f6" }}>
            {stats.open || 0}
          </div>
        </div>
        <div className="stat-card">
          <h3>In Progress</h3>
          <div className="value" style={{ color: "#f59e0b" }}>
            {stats.inProgress || 0}
          </div>
        </div>
        <div className="stat-card">
          <h3>Resolved</h3>
          <div className="value" style={{ color: "#10b981" }}>
            {stats.resolved || 0}
          </div>
        </div>
      </div>

      {/* Tickets Against Me Alert */}
      {ticketsAgainstMe.length > 0 && showAgainstMeAlert && (
        <div className="tickets-against-me-alert">
          <div className="alert-header">
            <div className="alert-icon"><i className="fas fa-exclamation-triangle"></i></div>
            <div className="alert-title">
              <strong>Attention!</strong> You have {ticketsAgainstMe.length} ticket(s) reported against you
            </div>
            <button 
              className="alert-close" 
              onClick={() => setShowAgainstMeAlert(false)}
              title="Dismiss"
            >
              ×
            </button>
          </div>
          <div className="against-me-tickets-list">
            {ticketsAgainstMe.map((ticket) => (
              <div key={ticket._id} className="against-me-ticket-item">
                <div className="against-me-ticket-info">
                  <span className="ticket-id-badge">{ticket.ticketId}</span>
                  <span className="ticket-title">{ticket.title}</span>
                  {getPriorityBadge(ticket.priority)}
                  {getStatusBadge(ticket.status)}
                </div>
                <div className="against-me-ticket-meta">
                  <span>Reported by: <strong>{ticket.reportedBy?.name}</strong></span>
                  <span>on {new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
                <button 
                  className="btn-view-small"
                  onClick={() => handleView(ticket)}
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Category</label>
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
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
          <label>Priority</label>
          <select
            value={filter.priority}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
          >
            <option value="">All Priorities</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group filter-checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filter.showResolved}
              onChange={(e) => setFilter({ ...filter, showResolved: e.target.checked })}
            />
            <span>Show Resolved/Closed</span>
          </label>
          <small style={{ color: "#64748b", fontSize: "11px" }}>
            Include archived tickets
          </small>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="table-container">
        <table className="data-table">
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
                <td colSpan="8" style={{ textAlign: "center" }}>
                  Loading...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center" }}>
                  No tickets found
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket._id}>
                  <td className="ticket-id">{ticket.ticketId}</td>
                  <td>{ticket.title}</td>
                  <td>{ticket.category}</td>
                  <td>{getPriorityBadge(ticket.priority)}</td>
                  <td>{getStatusBadge(ticket.status)}</td>
                  <td>
                    {ticket.reportedBy?.name || "-"}
                    <br />
                    <small style={{ color: "#94a3b8" }}>
                      {ticket.reportedBy?.role?.name || ""}
                    </small>
                  </td>
                  <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-view"
                        onClick={() => handleView(ticket)}
                      >
                        View
                      </button>
                      {canEditTicket(ticket) && (
                        <>
                          <button
                            className="btn-edit"
                            onClick={() => handleEdit(ticket)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(ticket._id)}
                          >
                            Delete
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
              <h2>{selectedTicket ? "Edit Ticket" : "Create New Ticket"}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
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
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    required
                  >
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
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
                        {"—".repeat(dept.level || 0)} {dept.name}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "4px" }}>
                    Select a department to filter employees below
                  </small>
                </div>

                <div className="form-group">
                  <label>Reported Against (Optional)</label>
                  <select
                    value={formData.reportedAgainst}
                    onChange={(e) =>
                      setFormData({ ...formData, reportedAgainst: e.target.value })
                    }
                  >
                    <option value="">-- Not Applicable --</option>
                    {filteredEmployees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} - {emp.employeeId} ({emp.department?.name || "N/A"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Attachments - Only for new tickets */}
                {!selectedTicket && (
                  <div className="form-group">
                    <label>Attachments (Optional)</label>
                    <div className="file-upload-area">
                      <input
                        type="file"
                        id="ticket-attachments"
                        multiple
                        accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                      />
                      <label htmlFor="ticket-attachments" className="file-upload-btn">
                        📎 Choose Files
                      </label>
                      <span className="file-hint">Max 5 files, 10MB each</span>
                    </div>
                    {attachments.length > 0 && (
                      <div className="attachments-list">
                        {attachments.map((file, index) => (
                          <div key={index} className="attachment-item">
                            <span className="attachment-name">
                              {file.type.startsWith("image/") ? <i className="fas fa-image"></i> : <i className="fas fa-file"></i>} {file.name}
                            </span>
                            <span className="attachment-size">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                            <button
                              type="button"
                              className="remove-attachment"
                              onClick={() => removeAttachment(index)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedTicket && (
                  <>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isSuperAdmin && (
                      <div className="form-group">
                        <label>Assign To</label>
                        <select
                          value={formData.assignedTo || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, assignedTo: e.target.value })
                          }
                        >
                          <option value="">-- Not Assigned --</option>
                          {employees.map((emp) => (
                            <option key={emp._id} value={emp._id}>
                              {emp.name} - {emp.employeeId}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Saving..." : selectedTicket ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedTicket && (
        <div
          className="modal-overlay"
          onClick={() => setShowViewModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ticket Details - {selectedTicket.ticketId}</h2>
              <button
                className="close-btn"
                onClick={() => setShowViewModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="ticket-details">
                <div className="detail-item">
                  <span className="detail-label">Title</span>
                  <span className="detail-value">{selectedTicket.title}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <div className="detail-item">
                  <span className="detail-label">Category</span>
                  <span className="detail-value">{selectedTicket.category}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Priority</span>
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <div className="detail-item">
                  <span className="detail-label">Reported By</span>
                  <span className="detail-value">
                    {selectedTicket.reportedBy?.name} ({selectedTicket.reportedBy?.role?.name})
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Reported Against</span>
                  <span className="detail-value">
                    {selectedTicket.reportedAgainst
                      ? `${selectedTicket.reportedAgainst.name} - ${selectedTicket.reportedAgainst.employeeId}`
                      : "N/A"}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedTicket.resolvedAt && (
                  <div className="detail-item">
                    <span className="detail-label">Resolved</span>
                    <span className="detail-value">
                      {new Date(selectedTicket.resolvedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Description</label>
                <p style={{ color: "#475569", lineHeight: 1.6 }}>
                  {selectedTicket.description}
                </p>
              </div>

              {/* Comments Section */}
              <div className="comments-section">
                <h3>Comments</h3>
                {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                  selectedTicket.comments.map((comment, index) => (
                    <div key={index} className="comment-item">
                      <div className="comment-header">
                        <span className="comment-author">
                          {comment.employee?.name || "Unknown"}
                        </span>
                        <span className="comment-date">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="comment-text">{comment.comment}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>
                    No comments yet
                  </p>
                )}

                <div className="add-comment">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") handleAddComment();
                    }}
                  />
                  <button onClick={handleAddComment}>Post</button>
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
