import { useEffect, useState } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { attendanceAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./AttendanceJustifications.css";

function AttendanceJustifications() {
  const toast = useToast();
  const [justifications, setJustifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [rejectionRemarks, setRejectionRemarks] = useState("");

  useEffect(() => {
    fetchPendingJustifications();
  }, []);

  const fetchPendingJustifications = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getPendingJustifications();
      if (response.data.success) {
        setJustifications(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching justifications:", error);
      toast.error("Failed to load justifications");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (attendance) => {
    if (!confirm("Approve this justification and mark attendance as present?")) return;
    try {
      const response = await attendanceAPI.reviewJustification(attendance._id, {
        status: "approved",
      });
      if (response.data.success) {
        toast.success("Justification approved");
        fetchPendingJustifications();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to approve justification");
    }
  };

  const handleReject = (attendance) => {
    setSelectedAttendance(attendance);
    setRejectionRemarks("");
    setShowRejectModal(true);
  };

  const submitRejection = async () => {
    if (!rejectionRemarks.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      const response = await attendanceAPI.reviewJustification(selectedAttendance._id, {
        status: "rejected",
        remarks: rejectionRemarks.trim(),
      });

      if (response.data.success) {
        toast.success("Justification rejected");
        setShowRejectModal(false);
        setSelectedAttendance(null);
        setRejectionRemarks("");
        fetchPendingJustifications();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reject justification");
    }
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="justification-approval-page">
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-clipboard-check"></i>
              </div>
              <div>
                <h1>Attendance Justifications</h1>
                <p>Review attendance justifications and mark as present if approved</p>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Submitted On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center" }}>Loading...</td>
                  </tr>
                ) : justifications.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center" }}>No pending justifications</td>
                  </tr>
                ) : (
                  justifications.map((attendance) => (
                    <tr key={attendance._id}>
                      <td>
                        <div className="employee-info">
                          <strong>{attendance.employee?.name || "N/A"}</strong>
                          <small>{attendance.employee?.employeeId || ""}</small>
                        </div>
                      </td>
                      <td>{new Date(attendance.date).toLocaleDateString()}</td>
                      <td>
                        <span className="status-badge status-pending">
                          {attendance.status}
                        </span>
                      </td>
                      <td>
                        <div className="reason-cell">
                          {attendance.justificationReason || "-"}
                        </div>
                      </td>
                      <td>{new Date(attendance.updatedAt || attendance.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleApprove(attendance)}
                          >
                            <i className="fas fa-check"></i> Approve
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleReject(attendance)}
                          >
                            <i className="fas fa-times"></i> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showRejectModal && selectedAttendance && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Justification</h2>
              <button className="close-btn" onClick={() => setShowRejectModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <label className="form-label">Rejection Reason</label>
              <textarea
                className="form-textarea"
                rows="4"
                value={rejectionRemarks}
                onChange={(e) => setRejectionRemarks(e.target.value)}
                placeholder="Enter reason for rejection..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={submitRejection}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceJustifications;
