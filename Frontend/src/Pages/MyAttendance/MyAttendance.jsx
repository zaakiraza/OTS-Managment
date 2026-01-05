import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { attendanceAPI, leaveAPI } from "../../Config/Api";
import "../Attendance/Attendance.css";
import "./MyAttendance.css";

function MyAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
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

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    
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
        leaveType: "sick",
        reason: leaveForm.reason,
        totalDays: totalDays,
      };
      
      const response = await leaveAPI.apply(submitData);
      
      if (response.data.success) {
        alert("Application submitted successfully!");
        setShowLeaveModal(false);
        setLeaveForm({
          startDate: "",
          endDate: "",
          leaveType: "sick",
          reason: "",
          isSingleDate: true,
        });
        fetchMyLeaves();
        fetchMyAttendance();
      }
    } catch (error) {
      alert(error.response?.data?.message || "Error submitting application");
    }
  };

  const handleCancelLeave = async (id) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    
    try {
      const response = await leaveAPI.cancel(id);
      
      if (response.data.success) {
        alert("Leave request cancelled successfully!");
        fetchMyLeaves();
      }
    } catch (error) {
      alert(error.response?.data?.message || "Error cancelling leave");
    }
  };

  const calculateStats = (records) => {
    const stats = {
      totalDays: records.length,
      present: records.filter((r) => r.status === "present" || r.status === "early-departure").length,
      absent: records.filter((r) => r.status === "absent").length,
      late: records.filter((r) => r.status === "late" || r.status === "late-early-departure").length,
      halfDay: records.filter((r) => r.status === "half-day").length,
      onLeave: records.filter((r) => r.status === "leave").length,
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
    };
    return colors[status] || "#6b7280";
  };

  const formatStatus = (status) => {
    const statusMap = {
      present: "Present",
      absent: "Absent",
      late: "Late",
      "late-early-departure": "Late Departure",
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
            <div>
              <h1>My Attendance</h1>
              <p>View your attendance records and submit absence applications</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center" }}>
                          Loading...
                        </td>
                      </tr>
                    ) : attendance.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center" }}>
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
                          <td>{record.remarks || "-"}</td>
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
                              {leave.status === "pending" && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleCancelLeave(leave._id)}
                                >
                                  <i className="fas fa-times"></i> Cancel
                                </button>
                              )}
                              {leave.status === "rejected" && leave.rejectionReason && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => alert(`Rejection Reason: ${leave.rejectionReason}`)}
                                >
                                  <i className="fas fa-info-circle"></i> View Reason
                                </button>
                              )}
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

      {/* Leave Application Modal */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Apply for Absence</h2>
              <button
                className="close-btn"
                onClick={() => setShowLeaveModal(false)}
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
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowLeaveModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Application
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
