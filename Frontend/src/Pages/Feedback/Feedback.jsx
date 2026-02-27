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
    message: "",
  });
  const [filter, setFilter] = useState({
    status: "",
    category: "",
    priority: "",
  });

  // Get user from localStorage (for submitter check) - move outside so it's available everywhere
  let user = {};
  try {
    const stored = localStorage.getItem("user");
    if (stored && stored !== "undefined") {
      user = JSON.parse(stored);
    }
  } catch {}

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
        message: "",
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
                  <th>Message</th>
                  <th>Submitted By</th>
                  <th>Status</th>
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
                        {feedback.message?.substring(0, 60)}
                        {feedback.message?.length > 60 ? '...' : ''}
                      </td>
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
                      <i className="fas fa-align-left"></i> Message <span className="required">*</span>
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      rows="8"
                      placeholder="Describe your feedback in detail..."
                      required
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
              user={user}
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
function ViewFeedbackModal({ user = {}, feedback, isSuperAdmin, onClose, onUpdate }) {
  const [status, setStatus] = useState(feedback.status);
  const [priority, setPriority] = useState(feedback.priority);
  const [adminNotes, setAdminNotes] = useState(feedback.adminNotes || "");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    await onUpdate(feedback._id, status, priority, adminNotes);
    setLoading(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      'new': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
      'in-review': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
      'resolved': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
      'closed': { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
    };
    return colors[status] || colors['new'];
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
      'medium': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
      'high': { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' }
    };
    return colors[priority] || colors['medium'];
  };

  const statusColors = getStatusColor(status);
  const priorityColors = getPriorityColor(priority);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '600px',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1a5a4c 0%, #2d7a6d 100%)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="fas fa-comment-dots" style={{ color: '#fff', fontSize: '18px' }}></i>
            </div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: '20px', fontWeight: '600' }}>
              Feedback Details
            </h2>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            <i className="fas fa-times" style={{ color: '#fff', fontSize: '16px' }}></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ 
          padding: '24px', 
          background: '#fff', 
          overflowY: 'auto', 
          flex: 1, 
          minHeight: 0 
        }}>
          {/* Category & Subject Card */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {feedback.category && (
                <span style={{
                  background: '#e0f2fe',
                  color: '#0369a1',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <i className="fas fa-tag" style={{ fontSize: '11px' }}></i>
                  {feedback.category}
                </span>
              )}
              <span style={{
                background: statusColors.bg,
                color: statusColors.text,
                border: `1px solid ${statusColors.border}`,
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '500',
                textTransform: 'capitalize'
              }}>
                {feedback.status?.replace('-', ' ')}
              </span>
              <span style={{
                background: priorityColors.bg,
                color: priorityColors.text,
                border: `1px solid ${priorityColors.border}`,
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '500',
                textTransform: 'capitalize'
              }}>
                {feedback.priority} Priority
              </span>
            </div>
            {feedback.subject && (
              <h3 style={{ 
                margin: 0, 
                fontSize: '17px', 
                fontWeight: '600', 
                color: '#1e293b' 
              }}>
                {feedback.subject}
              </h3>
            )}
          </div>

          {/* Submitter Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px 16px',
            background: '#f1f5f9',
            borderRadius: '10px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1a5a4c 0%, #2d7a6d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: '600',
              fontSize: '15px'
            }}>
              {(feedback.submittedByName || feedback.submittedBy?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                {feedback.submittedByName || feedback.submittedBy?.name || 'Unknown'}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {feedback.submittedByEmail || feedback.submittedBy?.email || 'No email'}
              </div>
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <i className="fas fa-clock"></i>
              {new Date(feedback.createdAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}, {new Date(feedback.createdAt).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: '#64748b',
              display: 'block',
              marginBottom: '8px'
            }}>
              <i className="fas fa-envelope" style={{ marginRight: '6px' }}></i>
              Message
            </label>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#334155',
              minHeight: '80px',
              whiteSpace: 'pre-wrap'
            }}>
              {feedback.message || 'No message provided'}
            </div>
          </div>

          {/* Show Admin Notes to Admin and Feedback Submitter */}
          {(isSuperAdmin || (user?.email && (user.email === feedback.submittedByEmail || user.email === feedback.submittedBy?.email))) && feedback.adminNotes && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '13px', 
                fontWeight: '600', 
                color: '#1a5a4c',
                display: 'block',
                marginBottom: '8px'
              }}>
                <i className="fas fa-user-shield" style={{ marginRight: '6px' }}></i>
                Admin Notes
              </label>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '16px',
                fontSize: '14px',
                color: '#166534',
                minHeight: '60px',
                whiteSpace: 'pre-wrap'
              }}>
                {feedback.adminNotes}
              </div>
            </div>
          )}

          {/* Admin Section */}
          {isSuperAdmin && (
            <div style={{
              borderTop: '1px solid #e2e8f0',
              paddingTop: '20px',
              marginTop: '8px'
            }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#1e293b',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="fas fa-user-shield" style={{ color: '#1a5a4c' }}></i>
                Admin Actions
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div>
                  <label style={{ 
                    fontSize: '13px', 
                    fontWeight: '500', 
                    color: '#475569',
                    display: 'block',
                    marginBottom: '6px'
                  }}>Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      background: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="new">New</option>
                    <option value="in-review">In Review</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label style={{ 
                    fontSize: '13px', 
                    fontWeight: '500', 
                    color: '#475569',
                    display: 'block',
                    marginBottom: '6px'
                  }}>Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      background: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  fontSize: '13px', 
                  fontWeight: '500', 
                  color: '#475569',
                  display: 'block',
                  marginBottom: '6px'
                }}>Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows="3"
                  placeholder="Add notes or response..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {feedback.reviewedBy && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#166534',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <i className="fas fa-check-circle"></i>
                  Reviewed by <strong>{feedback.reviewedBy?.name}</strong> on {new Date(feedback.reviewedAt).toLocaleString()}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px',
                paddingTop: '8px'
              }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={loading}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1a5a4c 0%, #2d7a6d 100%)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Updating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save"></i>
                      Update Feedback
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Close button for non-admin */}
          {!isSuperAdmin && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end',
              paddingTop: '8px'
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #1a5a4c 0%, #2d7a6d 100%)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Feedback;

