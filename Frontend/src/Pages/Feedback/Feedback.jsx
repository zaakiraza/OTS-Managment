import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { feedbackAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Feedback.css";

function Feedback() {
  const toast = useToast();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [formData, setFormData] = useState({
    category: "other",
    subject: "",
    message: "",
    priority: "medium",
  });
  const [filter, setFilter] = useState({
    status: "",
    category: "",
    priority: "",
  });

  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch {
      return {};
    }
  })();
  const isSuperAdmin = user?.role?.name === "superAdmin";

  useEffect(() => {
    fetchFeedbacks();
  }, [filter, isSuperAdmin]);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.category) params.category = filter.category;
      if (filter.priority) params.priority = filter.priority;

      const response = isSuperAdmin
        ? await feedbackAPI.getAll(params)
        : await feedbackAPI.getMy();

      if (response.data.success) {
        setFeedbacks(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
      toast.error(error.response?.data?.message || "Failed to fetch feedbacks");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await feedbackAPI.submit(formData);
      toast.success("Feedback submitted successfully!");
      setShowModal(false);
      setFormData({
        category: "other",
        subject: "",
        message: "",
        priority: "medium",
      });
      fetchFeedbacks();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error(error.response?.data?.message || "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (feedback) => {
    setSelectedFeedback(feedback);
    setShowViewModal(true);
  };

  const handleUpdateStatus = async (feedbackId, newStatus, priority, adminNotes) => {
    try {
      setLoading(true);
      await feedbackAPI.update(feedbackId, {
        status: newStatus,
        priority: priority,
        adminNotes: adminNotes,
      });
      toast.success("Feedback updated successfully!");
      setShowViewModal(false);
      fetchFeedbacks();
    } catch (error) {
      console.error("Error updating feedback:", error);
      toast.error(error.response?.data?.message || "Failed to update feedback");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this feedback?")) return;

    try {
      setLoading(true);
      await feedbackAPI.delete(id);
      toast.success("Feedback deleted successfully!");
      fetchFeedbacks();
    } catch (error) {
      console.error("Error deleting feedback:", error);
      toast.error(error.response?.data?.message || "Failed to delete feedback");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: "#3b82f6",
      "in-review": "#f59e0b",
      resolved: "#10b981",
      closed: "#6b7280",
    };
    return colors[status] || "#6b7280";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "#10b981",
      medium: "#f59e0b",
      high: "#ef4444",
    };
    return colors[priority] || "#6b7280";
  };

  const getCategoryIcon = (category) => {
    const icons = {
      bug: "fa-bug",
      feature: "fa-lightbulb",
      improvement: "fa-arrow-up",
      other: "fa-comment",
    };
    return icons[category] || "fa-comment";
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="feedback-page">
          <div className="page-header">
            <div>
              <h1>
                <i className="fas fa-comment-dots"></i> Feedback
              </h1>
              <p>
                {isSuperAdmin
                  ? "View and manage all user feedback"
                  : "Submit feedback about the web application"}
              </p>
            </div>
            {!isSuperAdmin && (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <i className="fas fa-plus"></i> Submit Feedback
              </button>
            )}
          </div>

          {isSuperAdmin && (
            <div className="filters-container">
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={filter.status}
                  onChange={(e) =>
                    setFilter({ ...filter, status: e.target.value })
                  }
                >
                  <option value="">All Status</option>
                  <option value="new">New</option>
                  <option value="in-review">In Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
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
                  <option value="bug">Bug</option>
                  <option value="feature">Feature Request</option>
                  <option value="improvement">Improvement</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Priority</label>
                <select
                  value={filter.priority}
                  onChange={(e) =>
                    setFilter({ ...filter, priority: e.target.value })
                  }
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Subject</th>
                  <th>Submitted By</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>
                      Loading...
                    </td>
                  </tr>
                ) : feedbacks.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>
                      No feedback found
                    </td>
                  </tr>
                ) : (
                  feedbacks.map((feedback) => (
                    <tr key={feedback._id}>
                      <td>
                        <span className="category-badge">
                          <i className={`fas ${getCategoryIcon(feedback.category)}`}></i>
                          {feedback.category}
                        </span>
                      </td>
                      <td>{feedback.subject}</td>
                      <td>
                        {isSuperAdmin
                          ? feedback.submittedByName || feedback.submittedBy?.name
                          : "You"}
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ background: getStatusColor(feedback.status) }}
                        >
                          {feedback.status}
                        </span>
                      </td>
                      <td>
                        <span
                          className="priority-badge"
                          style={{ background: getPriorityColor(feedback.priority) }}
                        >
                          {feedback.priority}
                        </span>
                      </td>
                      <td>
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          className="btn-view"
                          onClick={() => handleView(feedback)}
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        {!isSuperAdmin && (
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(feedback._id)}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Submit Feedback Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>
                    <i className="fas fa-comment-dots"></i> Submit Feedback
                  </h2>
                  <button className="close-btn" onClick={() => setShowModal(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body">
                  <div className="form-group">
                    <label>
                      <i className="fas fa-tag"></i> Category <span className="required">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      required
                    >
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="improvement">Improvement Suggestion</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-heading"></i> Subject <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      placeholder="Brief description of your feedback"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-align-left"></i> Message <span className="required">*</span>
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      rows="5"
                      placeholder="Describe your feedback in detail..."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-exclamation-circle"></i> Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value })
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
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
                      {loading ? "Submitting..." : "Submit Feedback"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* View Feedback Modal */}
          {showViewModal && selectedFeedback && (
            <ViewFeedbackModal
              feedback={selectedFeedback}
              isSuperAdmin={isSuperAdmin}
              onClose={() => setShowViewModal(false)}
              onUpdate={handleUpdateStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// View Feedback Modal Component
function ViewFeedbackModal({ feedback, isSuperAdmin, onClose, onUpdate }) {
  const [status, setStatus] = useState(feedback.status);
  const [priority, setPriority] = useState(feedback.priority);
  const [adminNotes, setAdminNotes] = useState(feedback.adminNotes || "");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    await onUpdate(feedback._id, status, priority, adminNotes);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <i className="fas fa-comment-dots"></i> Feedback Details
          </h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body">
          <div className="feedback-details">
            <div className="detail-row">
              <label>Category:</label>
              <span className="category-badge">{feedback.category}</span>
            </div>
            <div className="detail-row">
              <label>Subject:</label>
              <span>{feedback.subject}</span>
            </div>
            <div className="detail-row">
              <label>Submitted By:</label>
              <span>
                {feedback.submittedByName || feedback.submittedBy?.name} (
                {feedback.submittedByEmail || feedback.submittedBy?.email})
              </span>
            </div>
            <div className="detail-row">
              <label>Date:</label>
              <span>{new Date(feedback.createdAt).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <label>Message:</label>
              <div className="message-box">{feedback.message}</div>
            </div>

            {isSuperAdmin && (
              <>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="new">New</option>
                    <option value="in-review">In Review</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows="3"
                    placeholder="Add notes or response..."
                  />
                </div>
                {feedback.reviewedBy && (
                  <div className="detail-row">
                    <label>Reviewed By:</label>
                    <span>
                      {feedback.reviewedBy?.name} on{" "}
                      {new Date(feedback.reviewedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleUpdate}
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "Update Feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Feedback;

