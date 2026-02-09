import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { attendanceAPI, leaveAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "../Attendance/Attendance.css";
import "./MyAttendance.css";

function MyAttendance() {
  const toast = useToast();
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  
  const leaveTypes = [
    { value: "sick", label: "Sick Leave" },
    { value: "casual", label: "Casual Leave" },
    { value: "annual", label: "Annual Leave" },
    { value: "unpaid", label: "Unpaid Leave" },
    { value: "emergency", label: "Emergency Leave" },
    { value: "other", label: "Other" },
  ];
  const [stats, setStats] = useState({
    totalDays: 0,
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    onLeave: 0,
  });
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    startDate: "",
    endDate: "",
    leaveType: "sick",
    reason: "",
    isSingleDate: true,
  });
  const [activeTab, setActiveTab] = useState("attendance");
  const [attachments, setAttachments] = useState([]);
  const [compressedImages, setCompressedImages] = useState([]);
  const [editingLeave, setEditingLeave] = useState(null);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [justificationReason, setJustificationReason] = useState("");
  const [submittingJustification, setSubmittingJustification] = useState(false);

  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch { return {}; }
  })();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => {
    fetchMyAttendance();
    fetchMyLeaves();
  }, [selectedMonth, selectedYear]);

  const fetchMyAttendance = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = {
        employee: user._id,
        month: selectedMonth,
        year: selectedYear,
      };
      
      const response = await attendanceAPI.getAllAttendance(params);
      
      if (response.data.success) {
        setAttendance(response.data.data);
        calculateStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyLeaves = async () => {
    try {
      const response = await leaveAPI.getMyLeaves({
        year: selectedYear,
      });
      
      if (response.data.success) {
        setLeaves(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching leaves:", error);
    }
  };

  const handleEditLeave = (leave) => {
    const isSingleDate = leave.totalDays === 1;
    setEditingLeave(leave);
    setLeaveForm({
      startDate: new Date(leave.startDate).toISOString().split('T')[0],
      endDate: new Date(leave.endDate).toISOString().split('T')[0],
      leaveType: leave.leaveType,
      reason: leave.reason,
      isSingleDate: isSingleDate,
    });
    setExistingAttachments(leave.attachments || []);
    setAttachments([]);
    setCompressedImages([]);
    setShowLeaveModal(true);
  };

  const resetLeaveForm = () => {
    setShowLeaveModal(false);
    setEditingLeave(null);
    setLeaveForm({
      startDate: "",
      endDate: "",
      leaveType: "sick",
      reason: "",
      isSingleDate: true,
    });
    setAttachments([]);
    setCompressedImages([]);
    setExistingAttachments([]);
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const startDate = new Date(leaveForm.startDate);
      const endDate = leaveForm.isSingleDate 
        ? new Date(leaveForm.startDate) 
        : new Date(leaveForm.endDate);
      
      // Calculate total days
      const diffTime = Math.abs(endDate - startDate);
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      const submitData = {
        startDate: leaveForm.startDate,
        endDate: leaveForm.isSingleDate ? leaveForm.startDate : leaveForm.endDate,
        leaveType: leaveForm.leaveType,
        reason: leaveForm.reason,
        totalDays: totalDays,
      };

      let response;
      const isEditing = !!editingLeave;
      
      // Check if we have files to upload or existing attachments to keep
      if (attachments.length > 0 || compressedImages.length > 0 || (isEditing && existingAttachments.length > 0)) {
        const formData = new FormData();
        
        // Add form fields
        Object.keys(submitData).forEach((key) => {
          formData.append(key, submitData[key]);
        });
        
        // Add existing attachments (for edit mode)
        if (isEditing && existingAttachments.length > 0) {
          formData.append("existingAttachments", JSON.stringify(existingAttachments));
        }
        
        // Add compressed images as base64
        if (compressedImages.length > 0) {
          formData.append("compressedImages", JSON.stringify(compressedImages.map((img) => ({
            dataUrl: img.dataUrl,
            name: img.name,
          }))));
        }
        
        // Add file attachments
        attachments.forEach((file) => {
          formData.append("attachments", file);
        });
        
        if (isEditing) {
          response = await leaveAPI.updateWithFiles(editingLeave._id, formData);
        } else {
          response = await leaveAPI.applyWithFiles(formData);
        }
      } else {
        if (isEditing) {
          response = await leaveAPI.update(editingLeave._id, submitData);
        } else {
          response = await leaveAPI.apply(submitData);
        }
      }
      
      if (response.data.success) {
        toast.success(isEditing ? "Leave request updated successfully!" : "Application submitted successfully!");
        resetLeaveForm();
        fetchMyLeaves();
        fetchMyAttendance();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error submitting application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (id) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    
    try {
      const response = await leaveAPI.cancel(id);
      
      if (response.data.success) {
        toast.success("Leave request cancelled successfully!");
        fetchMyLeaves();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error cancelling leave");
    }
  };

  // File handling functions
  const compressImage = (file) => {
    return new Promise((resolve) => {
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
          
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve({
            dataUrl,
            name: file.name,
            isCompressed: true,
          });
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    const maxFiles = 5;
    const currentTotal = attachments.length + compressedImages.length;
    
    if (currentTotal + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    for (const file of files) {
      const result = await compressImage(file);
      if (result.isCompressed) {
        setCompressedImages((prev) => [...prev, result]);
      } else {
        setAttachments((prev) => [...prev, file]);
      }
    }
    e.target.value = "";
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeCompressedImage = (index) => {
    setCompressedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index) => {
    setExistingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const openJustificationModal = (attendance) => {
    setSelectedAttendance(attendance);
    setJustificationReason(attendance.justificationReason || "");
    setShowJustificationModal(true);
  };

  const closeJustificationModal = () => {
    setShowJustificationModal(false);
    setSelectedAttendance(null);
    setJustificationReason("");
  };

  const handleSubmitJustification = async () => {
    if (!justificationReason.trim()) {
      toast.error("Please provide a reason for justification");
      return;
    }

    try {
      setSubmittingJustification(true);
      const response = await attendanceAPI.submitJustification({
        attendanceId: selectedAttendance._id,
        reason: justificationReason.trim(),
      });

      if (response.data.success) {
        toast.success("Justification submitted successfully");
        closeJustificationModal();
        fetchMyAttendance(); // Refresh attendance data
      }
    } catch (error) {
      console.error("Error submitting justification:", error);
      toast.error(error.response?.data?.message || "Failed to submit justification");
    } finally {
      setSubmittingJustification(false);
    }
  };

  const calculateStats = (records) => {
    const stats = {
      totalDays: records.length,
      present: records.filter((r) => r.status === "present" || r.status === "early-departure").length,
      absent: records.filter((r) => r.status === "absent" || r.status === "missing").length,
      late: records.filter((r) => r.status === "late" || r.status === "late-early-departure").length,
      halfDay: records.filter((r) => r.status === "half-day").length,
      onLeave: records.filter((r) => r.status === "leave").length,
      missing: records.filter((r) => r.status === "missing").length,
    };
    setStats(stats);
  };

  const getStatusColor = (status) => {
    const colors = {
      present: "#10b981",
      absent: "#ef4444",
      late: "#f59e0b",
      "late-early-departure": "#f59e0b",
      "early-departure": "#10b981",
      "half-day": "#3b82f6",
      leave: "#8b5cf6",
      pending: "#6b7280",
      missing: "#dc2626",
    };
    return colors[status] || "#6b7280";
  };

  const formatStatus = (status) => {
    const statusMap = {
      present: "Present",
      absent: "Absent",
      late: "Late",
      "late-early-departure": "Late + Early Departure",
      missing: "Missing",
      "early-departure": "Early Departure",
      "half-day": "Half Day",
      leave: "On Leave",
      pending: "Pending",
    };
    return statusMap[status] || status.toUpperCase();
  };

  const formatTime = (dateTime) => {
    if (!dateTime) return "N/A";
    return new Date(dateTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const calculateWorkHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return "N/A";
    
    const checkInTime = new Date(checkIn);
    const checkOutTime = new Date(checkOut);
    
    const diff = checkOutTime - checkInTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="attendance-page">
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-user-clock"></i>
              </div>
              <div>
                <h1>My Attendance</h1>
                <p>View your attendance records and submit absence applications</p>
              </div>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => setShowLeaveModal(true)}
            >
              <i className="fas fa-calendar-plus"></i> Apply for Absence / Late Arrival
            </button>
          </div>

          {/* Tabs */}
          <div className="tabs-container">
            <button
              className={`tab-btn ${activeTab === "attendance" ? "active" : ""}`}
              onClick={() => setActiveTab("attendance")}
            >
              <i className="fas fa-calendar-check"></i> Attendance Records
            </button>
            <button
              className={`tab-btn ${activeTab === "leaves" ? "active" : ""}`}
              onClick={() => setActiveTab("leaves")}
            >
              <i className="fas fa-umbrella-beach"></i> Absence Requests
            </button>
          </div>

          {activeTab === "attendance" ? (
            <>
              {/* Filters */}
              <div className="filters-section">
                <div className="filter-group">
                  <label>Month:</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    {months.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Year:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    {[2023, 2024, 2025, 2026].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-content">
                    <h3>Total Days</h3>
                    <p className="stat-value">{stats.totalDays}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-content">
                    <h3>Present</h3>
                    <p className="stat-value" style={{ color: "#10b981" }}>
                      {stats.present}
                    </p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-content">
                    <h3>Absent</h3>
                    <p className="stat-value" style={{ color: "#ef4444" }}>
                      {stats.absent}
                    </p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-content">
                    <h3>Late</h3>
                    <p className="stat-value" style={{ color: "#f59e0b" }}>
                      {stats.late}
                    </p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-content">
                    <h3>Half Day</h3>
                    <p className="stat-value" style={{ color: "#3b82f6" }}>
                      {stats.halfDay}
                    </p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-content">
                    <h3>On Leave</h3>
                    <p className="stat-value" style={{ color: "#8b5cf6" }}>
                      {stats.onLeave}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Status</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Work Hours</th>
                      <th>Extra Hours</th>
                      <th>Remarks</th>
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
                    ) : attendance.length === 0 ? (
                      <tr>
                          <td colSpan="9" style={{ textAlign: "center" }}>
                          No attendance records found for selected period
                        </td>
                      </tr>
                    ) : (
                      attendance.map((record) => (
                        <tr key={record._id}>
                          <td>{new Date(record.date).toLocaleDateString()}</td>
                          <td>
                            {new Date(record.date).toLocaleDateString("en-US", {
                              weekday: "short",
                            })}
                          </td>
                          <td>
                            <span
                              className="status-badge"
                              style={{
                                background: getStatusColor(record.status),
                                color: "white",
                              }}
                            >
                              {formatStatus(record.status)}
                            </span>
                          </td>
                          <td>{formatTime(record.checkIn)}</td>
                          <td>{formatTime(record.checkOut)}</td>
                          <td>{calculateWorkHours(record.checkIn, record.checkOut)}</td>
                          <td>
                            {record.extraWorkingHours && record.extraWorkingHours > 0 ? (
                              <span style={{ color: "#10b981", fontWeight: "bold" }}>
                                +{record.extraWorkingHours.toFixed(2)}h
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                            <td>
                              {record.justificationReason && (
                                <div style={{ fontSize: "0.85rem" }}>
                                  <strong>Reason:</strong> {record.justificationReason}
                                  <br />
                                  <span style={{ 
                                    color: record.justificationStatus === "approved" ? "#10b981" : 
                                           record.justificationStatus === "rejected" ? "#ef4444" : "#f59e0b",
                                    fontWeight: "bold"
                                  }}>
                                    [{record.justificationStatus?.toUpperCase()}]
                                  </span>
                                </div>
                              )}
                              {record.remarks && (
                                <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                                  <strong>Remarks:</strong> {record.remarks}
                                </div>
                              )}
                              {!record.justificationReason && !record.remarks && "-"}
                            </td>
                            <td>
                              {["late", "absent", "half-day", "early-departure", "late-early-departure", "missing"].includes(record.status) && (
                                <>
                                  {record.justificationStatus === "none" || !record.justificationStatus ? (
                                    <button
                                      className="btn btn-sm btn-warning"
                                      onClick={() => openJustificationModal(record)}
                                      style={{ 
                                        fontSize: "0.8rem", 
                                        padding: "4px 8px",
                                        background: "#f59e0b",
                                        border: "none",
                                        color: "white",
                                        borderRadius: "4px",
                                        cursor: "pointer"
                                      }}
                                    >
                                      <i className="fas fa-comment-alt"></i> Add Reason
                                    </button>
                                  ) : record.justificationStatus === "pending" ? (
                                    <span style={{ color: "#f59e0b", fontSize: "0.85rem" }}>
                                      <i className="fas fa-clock"></i> Pending Review
                                    </span>
                                  ) : record.justificationStatus === "approved" ? (
                                    <span style={{ color: "#10b981", fontSize: "0.85rem" }}>
                                      <i className="fas fa-check-circle"></i> Approved
                                    </span>
                                  ) : (
                                    <button
                                      className="btn btn-sm btn-warning"
                                      onClick={() => openJustificationModal(record)}
                                      style={{ 
                                        fontSize: "0.8rem", 
                                        padding: "4px 8px",
                                        background: "#f59e0b",
                                        border: "none",
                                        color: "white",
                                        borderRadius: "4px",
                                        cursor: "pointer"
                                      }}
                                    >
                                      <i className="fas fa-redo"></i> Resubmit
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Card */}
              {attendance.length > 0 && (
                <div className="summary-card">
                  <h3>Summary</h3>
                  <p>
                    <strong>Attendance Rate:</strong>{" "}
                    {stats.totalDays > 0
                      ? ((stats.present / stats.totalDays) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                  <p>
                    <strong>Working Days:</strong> {stats.present + stats.late + stats.halfDay}
                  </p>
                  <p>
                    <strong>Non-Working Days:</strong> {stats.absent + stats.onLeave}
                  </p>
                  <p>
                    <strong>Total Extra Hours:</strong>{" "}
                    {attendance
                      .reduce((sum, record) => sum + (record.extraWorkingHours || 0), 0)
                      .toFixed(2)}{" "}
                    hours
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Absence Requests Table */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>

                      <th>Total Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Submitted On</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center" }}>
                          No absence requests found
                        </td>
                      </tr>
                    ) : (
                      leaves.map((leave) => {
                        const isSingleDay = leave.totalDays === 1;
                        const dateDisplay = isSingleDay 
                          ? new Date(leave.startDate).toLocaleDateString()
                          : `${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}`;
                        
                        return (
                          <tr key={leave._id}>
                            <td>{dateDisplay}</td>
                            <td>
                              <span className="days-badge-sm">{leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}</span>
                            </td>
                            <td>
                              <div className="reason-text">{leave.reason}</div>
                            </td>
                            <td>
                              <span
                                className="status-badge"
                                style={{
                                  background: 
                                    leave.status === "approved" ? "#10b981" :
                                    leave.status === "rejected" ? "#ef4444" : "#f59e0b",
                                  color: "white",
                                }}
                              >
                                {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                              </span>
                            </td>
                            <td>{new Date(leave.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div className="action-buttons">
                                {leave.status === "pending" && (
                                  <>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleEditLeave(leave)}
                                      title="Edit"
                                    >
                                      <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => handleCancelLeave(leave._id)}
                                      title="Cancel"
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  </>
                                )}
                                {leave.status === "rejected" && leave.rejectionReason && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => toast.info(`Rejection Reason: ${leave.rejectionReason}`)}
                                    title="View Reason"
                                  >
                                    <i className="fas fa-info-circle"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Justification Modal */}
      {showJustificationModal && selectedAttendance && (
        <div className="modal-overlay" onClick={closeJustificationModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Justification</h2>
              <button className="close-btn" onClick={closeJustificationModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: "12px", color: "#6b7280" }}>
                <strong>Date:</strong> {new Date(selectedAttendance.date).toLocaleDateString()}<br />
                <strong>Status:</strong> {formatStatus(selectedAttendance.status)}
              </div>
              <label className="form-label">Reason for Justification</label>
              <textarea
                className="form-textarea"
                rows="4"
                value={justificationReason}
                onChange={(e) => setJustificationReason(e.target.value)}
                placeholder="Explain why this should be marked as present..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeJustificationModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitJustification}
                disabled={submittingJustification}
              >
                {submittingJustification ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Application Modal */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => resetLeaveForm()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLeave ? "Edit Absence Request" : "Apply for Absence"}</h2>
              <button
                className="close-btn"
                onClick={() => resetLeaveForm()}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleApplyLeave}>
              <div className="form-group">
                <label>Date Selection</label>
                <div className="date-type-selector">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="dateType"
                      checked={leaveForm.isSingleDate}
                      onChange={() => setLeaveForm({ ...leaveForm, isSingleDate: true, endDate: "" })}
                    />
                    <span>Single Date</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="dateType"
                      checked={!leaveForm.isSingleDate}
                      onChange={() => setLeaveForm({ ...leaveForm, isSingleDate: false })}
                    />
                    <span>Date Range</span>
                  </label>
                </div>
              </div>
              
              <div className="form-group">
                <label>{leaveForm.isSingleDate ? "Date" : "Start Date"} *</label>
                <input
                  type="date"
                  required
                  value={leaveForm.startDate}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, startDate: e.target.value })
                  }
                />
              </div>
              
              {!leaveForm.isSingleDate && (
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, endDate: e.target.value })
                    }
                    min={leaveForm.startDate || new Date().toISOString().split("T")[0]}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Leave Type *</label>
                <select
                  required
                  value={leaveForm.leaveType}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, leaveType: e.target.value })
                  }
                >
                  {leaveTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  required
                  rows="4"
                  placeholder="Explain why you will be absent, arrive late, or leave early..."
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, reason: e.target.value })
                  }
                ></textarea>
              </div>

              {/* File Upload Section */}
              <div className="form-group">
                <label>Supporting Documents (Optional)</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="leave-attachments"
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="leave-attachments" className="file-upload-label">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>Click to upload files</span>
                    <small>Max 5 files • Images, PDFs, Documents</small>
                  </label>
                </div>

                {/* Existing Attachments (Edit Mode) */}
                {existingAttachments.length > 0 && (
                  <div className="attachments-section">
                    <span className="attachments-label">Existing Files:</span>
                    <div className="attachments-list">
                      {existingAttachments.map((attachment, index) => (
                        <div key={`existing-${index}`} className="attachment-item existing">
                          <i className={`fas ${attachment.mimeType?.startsWith("image/") || attachment.path?.startsWith("data:image") ? "fa-image" : "fa-file"}`}></i>
                          <span className="attachment-name">{attachment.originalName || attachment.filename}</span>
                          <button type="button" className="remove-attachment" onClick={() => removeExistingAttachment(index)}>
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compressed Images Preview */}
                {compressedImages.length > 0 && (
                  <div className="attachments-section">
                    <span className="attachments-label">Images:</span>
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
                    <span className="attachments-label">Documents:</span>
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

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => resetLeaveForm()}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
                  ) : (
                    editingLeave ? "Update Request" : "Submit Application"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAttendance;
