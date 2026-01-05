import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { leaveAPI, employeeAPI } from "../../Config/Api";
import "./LeaveApproval.css";

function LeaveApproval() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchLeaves();
  }, [filterStatus]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getAllLeaves({ status: filterStatus });
      
      if (response.data.success) {
        setLeaves(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching leaves:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!confirm("Are you sure you want to approve this leave request?")) return;
    
    try {
      const response = await leaveAPI.updateStatus(id, { 
        status: "approved" 
      });
      
      if (response.data.success) {
        alert("Leave request approved successfully!");
        fetchLeaves();
      }
    } catch (error) {
      alert(error.response?.data?.message || "Error approving leave");
    }
  };

  const handleReject = (leave) => {
    setSelectedLeave(leave);
    setShowRejectModal(true);
  };

  const submitRejection = async (e) => {
    e.preventDefault();
    
    try {
      const response = await leaveAPI.updateStatus(selectedLeave._id, {
        status: "rejected",
        rejectionReason: rejectionReason,
      });
      
      if (response.data.success) {
        alert("Leave request rejected successfully!");
        setShowRejectModal(false);
        setSelectedLeave(null);
        setRejectionReason("");
        fetchLeaves();
      }
    } catch (error) {
      alert(error.response?.data?.message || "Error rejecting leave");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "#f59e0b",
      approved: "#10b981",
      rejected: "#ef4444",
    };
    return colors[status] || "#6b7280";
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="leave-approval-page">
          <div className="page-header">
            <div>
              <h1>Leave Approval</h1>
              <p>Review and manage employee leave requests</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filterStatus === "pending" ? "active" : ""}`}
              onClick={() => setFilterStatus("pending")}
            >
              <i className="fas fa-clock"></i> Pending
            </button>
            <button
              className={`filter-tab ${filterStatus === "approved" ? "active" : ""}`}
              onClick={() => setFilterStatus("approved")}
            >
              <i className="fas fa-check-circle"></i> Approved
            </button>
            <button
              className={`filter-tab ${filterStatus === "rejected" ? "active" : ""}`}
              onClick={() => setFilterStatus("rejected")}
            >
              <i className="fas fa-times-circle"></i> Rejected
            </button>
            <button
              className={`filter-tab ${filterStatus === "" ? "active" : ""}`}
              onClick={() => setFilterStatus("")}
            >
              <i className="fas fa-list"></i> All
            </button>
          </div>

          {/* Leave Requests Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Total Days</th>
                  <th>Leave Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Applied On</th>
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
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center" }}>
                      No leave requests found
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave._id}>
                      <td>
                        <div className="employee-info">
                          <strong>{leave.employee?.fullName || "N/A"}</strong>
                          <small>{leave.employee?.employeeId || ""}</small>
                        </div>
                      </td>
                      <td>{new Date(leave.startDate).toLocaleDateString()}</td>
                      <td>{new Date(leave.endDate).toLocaleDateString()}</td>
                      <td>
                        <span className="days-badge">{leave.totalDays}</span>
                      </td>
                      <td>
                        <span className="leave-type-badge">
                          {leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div className="reason-cell">
                          {leave.reason}
                        </div>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            background: getStatusColor(leave.status),
                            color: "white",
                          }}
                        >
                          {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                        </span>
                      </td>
                      <td>{new Date(leave.createdAt).toLocaleDateString()}</td>
                      <td>
                        {leave.status === "pending" ? (
                          <div className="action-buttons">
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(leave._id)}
                            >
                              <i className="fas fa-check"></i> Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleReject(leave)}
                            >
                              <i className="fas fa-times"></i> Reject
                            </button>
                          </div>
                        ) : leave.status === "approved" ? (
                          <div className="approved-info">
                            <small>
                              Approved by: {leave.approvedBy?.fullName || "N/A"}
                            </small>
                          </div>
                        ) : (
                          <div className="rejected-info">
                            {leave.rejectionReason && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => alert(`Rejection Reason: ${leave.rejectionReason}`)}
                              >
                                <i className="fas fa-info-circle"></i> View Reason
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Leave Request</h2>
              <button
                className="close-btn"
                onClick={() => setShowRejectModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={submitRejection}>
              <div className="modal-body">
                <div className="leave-details">
                  <p><strong>Employee:</strong> {selectedLeave?.employee?.fullName}</p>
                  <p><strong>Duration:</strong> {new Date(selectedLeave?.startDate).toLocaleDateString()} - {new Date(selectedLeave?.endDate).toLocaleDateString()}</p>
                  <p><strong>Total Days:</strong> {selectedLeave?.totalDays}</p>
                </div>
                <div className="form-group">
                  <label>Rejection Reason *</label>
                  <textarea
                    required
                    rows="4"
                    placeholder="Please provide a reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  ></textarea>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Reject Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaveApproval;
