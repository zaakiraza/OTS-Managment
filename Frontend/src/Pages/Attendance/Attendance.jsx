import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { attendanceAPI, employeeAPI, departmentAPI } from "../../Config/Api";
import "./Attendance.css";

// Utility function to calculate working hours
const calculateWorkingHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return "";

  const [checkInHours, checkInMinutes] = checkIn.split(":").map(Number);
  const [checkOutHours, checkOutMinutes] = checkOut.split(":").map(Number);

  const checkInTotalMinutes = checkInHours * 60 + checkInMinutes;
  const checkOutTotalMinutes = checkOutHours * 60 + checkOutMinutes;

  let diffMinutes = checkOutTotalMinutes - checkInTotalMinutes;

  // Handle case where checkout is on next day
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  return `${hours}.${Math.round((minutes / 60) * 100)}`;
};

// Utility function to format decimal hours to hours.minutes display
const formatWorkingHours = (decimalHours) => {
  if (!decimalHours || decimalHours === 0) return "0.00";
  
  const hours = Math.floor(decimalHours);
  const decimalPart = decimalHours - hours;
  const minutes = Math.round(decimalPart * 60);
  
  return `${hours}.${minutes.toString().padStart(2, '0')}`;
};

function Attendance() {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    date: new Date().toISOString().split("T")[0],
    userId: "",
    status: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editFormData, setEditFormData] = useState({
    checkIn: "",
    checkOut: "",
    remarks: "",
    workingHours: "",
  });
  const [manualFormData, setManualFormData] = useState({
    department: "",
    userId: "",
    date: new Date().toISOString().split("T")[0],
    checkIn: "",
    checkOut: "",
    remarks: "",
    workingHours: "",
  });
  const [stats, setStats] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canManualEntry =
    user?.role?.name === "superAdmin" ||
    user?.role?.name === "attendanceDepartment";

  useEffect(() => {
    fetchTodayAttendance();
    fetchAttendanceStats();
  }, []);

  useEffect(() => {
    if (showManualModal) {
      fetchDepartments();
      setEmployees([]);
    }
  }, [showManualModal]);

  useEffect(() => {
    if (filter.date) {
      fetchAttendance();
    }
  }, [filter]);

  const fetchTodayAttendance = async () => {
    try {
      const response = await attendanceAPI.getTodayAttendance();
      setTodayRecords(response.data.data || []);
    } catch (err) {
      console.error("Error fetching today's attendance:", err);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.date) params.date = filter.date;
      if (filter.userId) params.userId = filter.userId;
      if (filter.status) params.status = filter.status;

      const response = await attendanceAPI.getAllAttendance(params);
      setAttendanceRecords(response.data.data || []);
    } catch (err) {
      console.error("Error fetching attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceStats = async () => {
    try {
      const response = await attendanceAPI.getAttendanceStats({});
      setStats(response.data.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({});
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching departments:", err);
    }
  };

  const fetchEmployeesByDepartment = async (deptId) => {
    if (!deptId) {
      setEmployees([]);
      return;
    }
    try {
      const response = await employeeAPI.getAll({ department: deptId });
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const handleFilterChange = (e) => {
    setFilter({
      ...filter,
      [e.target.name]: e.target.value,
    });
  };

  const formatTime = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      present: "status-present",
      absent: "status-absent",
      "half-day": "status-half-day",
      late: "status-late",
      "early-arrival": "status-early",
      "late-early-arrival": "status-late-early",
      pending: "status-pending",
    };
    return statusColors[status] || "status-pending";
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      present: "Present",
      absent: "Absent",
      "half-day": "Half Day",
      late: "Late",
      "early-arrival": "Early Arrival",
      "late-early-arrival": "Late + Early Arrival",
      pending: "Pending",
    };
    return statusLabels[status] || status;
  };

  const handleEdit = (record) => {
    setSelectedRecord(record);
    const checkInTime = record.checkIn
      ? new Date(record.checkIn).toTimeString().slice(0, 5)
      : "";
    const checkOutTime = record.checkOut
      ? new Date(record.checkOut).toTimeString().slice(0, 5)
      : "";
    const workingHours = record.workingHours || "";
    setEditFormData({
      checkIn: checkInTime,
      checkOut: checkOutTime,
      remarks: record.remarks || "",
      workingHours: workingHours,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      const dateStr = new Date(selectedRecord.date).toISOString().split("T")[0];
      const submitData = {
        remarks: editFormData.remarks,
      };

      if (editFormData.checkIn) {
        submitData.checkIn = `${dateStr}T${editFormData.checkIn}:00`;
      }
      if (editFormData.checkOut) {
        submitData.checkOut = `${dateStr}T${editFormData.checkOut}:00`;
      }
      if (editFormData.workingHours) {
        submitData.workingHours = parseFloat(editFormData.workingHours);
      }

      await attendanceAPI.updateAttendance(selectedRecord._id, submitData);
      alert("Attendance updated successfully!");
      setShowEditModal(false);
      setSelectedRecord(null);
      setEditFormData({
        checkIn: "",
        checkOut: "",
        remarks: "",
        workingHours: "",
      });
      fetchAttendance();
      fetchTodayAttendance();
    } catch (error) {
      console.error("Error updating attendance:", error);
      alert(error.response?.data?.message || "Failed to update attendance");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      // Construct proper datetime strings without timezone conversion
      const submitData = {
        userId: manualFormData.userId,
        date: `${manualFormData.date}T00:00:00`,
        remarks: manualFormData.remarks,
      };

      // Only add checkIn/checkOut if provided (keep as local time)
      if (manualFormData.checkIn) {
        submitData.checkIn = `${manualFormData.date}T${manualFormData.checkIn}:00`;
      }
      if (manualFormData.checkOut) {
        submitData.checkOut = `${manualFormData.date}T${manualFormData.checkOut}:00`;
      }
      if (manualFormData.workingHours) {
        submitData.workingHours = parseFloat(manualFormData.workingHours);
      }

      await attendanceAPI.createManualAttendance(submitData);
      alert("Manual attendance created successfully!");
      
      // Update filter to show the date where the record was created
      setFilter({
        ...filter,
        date: manualFormData.date
      });
      
      setShowManualModal(false);
      setManualFormData({
        department: "",
        userId: "",
        date: new Date().toISOString().split("T")[0],
        checkIn: "",
        checkOut: "",
        remarks: "",
        workingHours: "",
      });
      fetchTodayAttendance();
      // fetchAttendance will be called automatically by useEffect when filter.date changes
    } catch (error) {
      console.error("Error creating manual attendance:", error);
      alert(
        error.response?.data?.message || "Failed to create manual attendance"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (deptId) => {
    setManualFormData({ ...manualFormData, department: deptId, userId: "" });
    fetchEmployeesByDepartment(deptId);
  };

  // Always use attendanceRecords which is filtered properly
  const displayRecords = attendanceRecords;

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>📋 Attendance Management</h1>
              <p>Track and manage employee attendance</p>
            </div>
            {canManualEntry && (
              <button
                className="btn-primary"
                onClick={() => setShowManualModal(true)}
              >
                + Manual Entry
              </button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <h3>Today Present</h3>
                <p className="stat-value">
                  {todayRecords.filter((r) => r.checkIn).length}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏰</div>
              <div className="stat-info">
                <h3>Checked Out</h3>
                <p className="stat-value">
                  {todayRecords.filter((r) => r.checkOut).length}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🕐</div>
              <div className="stat-info">
                <h3>Still Working</h3>
                <p className="stat-value">
                  {todayRecords.filter((r) => r.checkIn && !r.checkOut).length}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-info">
                <h3>Total Users</h3>
                <p className="stat-value">{stats?.totalUsers || 0}</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-container">
            <div className="filter-group">
              <label>Date</label>
              <input
                type="date"
                name="date"
                value={filter.date}
                onChange={handleFilterChange}
              />
            </div>
            <div className="filter-group">
              <label>User ID</label>
              <input
                type="text"
                name="userId"
                value={filter.userId}
                onChange={handleFilterChange}
                placeholder="Search by User ID"
              />
            </div>
            <div className="filter-group">
              <label>Status</label>
              <select
                name="status"
                value={filter.status}
                onChange={handleFilterChange}
              >
                <option value="">All Status</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
                <option value="late">Late</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                  <th>Device</th>
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
                ) : displayRecords.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center" }}>
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  displayRecords.map((record) => (
                    <tr key={record._id}>
                      <td>{record?.employee?.employeeId}</td>
                      <td>{record?.employee?.name}</td>
                      <td>{formatDate(record.date)}</td>
                      <td className="time-cell">
                        {formatTime(record.checkIn)}
                      </td>
                      <td className="time-cell">
                        {formatTime(record.checkOut)}
                      </td>
                      <td>
                        {record.workingHours > 0
                          ? formatWorkingHours(record.workingHours)
                          : "-"}
                      </td>
                      <td>
                        <span
                          className={`status ${getStatusBadge(record.status)}`}
                        >
                          {getStatusLabel(record.status)}
                        </span>
                      </td>
                      <td>
                        {record.isManualEntry ? (
                          <span className="manual-badge">Manual</span>
                        ) : (
                          record.deviceId || "Biometric"
                        )}
                      </td>
                      <td>
                        <button
                          className="btn-edit"
                          onClick={() => handleEdit(record)}
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Manual Entry Modal */}
          {showManualModal && (
            <div
              className="modal-overlay"
              onClick={() => setShowManualModal(false)}
            >
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>Manual Attendance Entry</h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowManualModal(false)}
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleManualSubmit}>
                  <div className="form-group">
                    <label>Select Department *</label>
                    <select
                      value={manualFormData.department}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      required
                    >
                      <option value="">-- Select Department First --</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Select Employee *</label>
                    <select
                      value={manualFormData.userId}
                      onChange={(e) =>
                        setManualFormData({
                          ...manualFormData,
                          userId: e.target.value,
                        })
                      }
                      required
                      disabled={!manualFormData.department}
                    >
                      <option value="">
                        {manualFormData.department
                          ? "-- Select Employee --"
                          : "-- Select Department First --"}
                      </option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp.employeeId}>
                          {emp.employeeId} - {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      value={manualFormData.date}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setManualFormData({
                          ...manualFormData,
                          date: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Check-in Time</label>
                    <input
                      type="time"
                      value={manualFormData.checkIn}
                      onChange={(e) => {
                        const newCheckIn = e.target.value;
                        const workingHours = calculateWorkingHours(
                          newCheckIn,
                          manualFormData.checkOut
                        );
                        setManualFormData({
                          ...manualFormData,
                          checkIn: newCheckIn,
                          workingHours,
                        });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Check-out Time</label>
                    <input
                      type="time"
                      value={manualFormData.checkOut}
                      onChange={(e) => {
                        const newCheckOut = e.target.value;
                        const workingHours = calculateWorkingHours(
                          manualFormData.checkIn,
                          newCheckOut
                        );
                        setManualFormData({
                          ...manualFormData,
                          checkOut: newCheckOut,
                          workingHours,
                        });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea
                      value={manualFormData.remarks}
                      onChange={(e) =>
                        setManualFormData({
                          ...manualFormData,
                          remarks: e.target.value,
                        })
                      }
                      rows={3}
                      placeholder="Reason for manual entry (e.g., Biometric error)"
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowManualModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                    >
                      {loading ? "Creating..." : "Create Entry"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Attendance Modal */}
          {showEditModal && selectedRecord && (
            <div
              className="modal-overlay"
              onClick={() => setShowEditModal(false)}
            >
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>Edit Attendance</h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowEditModal(false)}
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleEditSubmit}>
                  <div className="form-group">
                    <label>Employee</label>
                    <input
                      type="text"
                      value={`${selectedRecord.userId} - ${
                        selectedRecord.user?.name ||
                        selectedRecord.employee?.name ||
                        "N/A"
                      }`}
                      disabled
                      style={{ background: "#f5f5f5", cursor: "not-allowed" }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="text"
                      value={new Date(selectedRecord.date).toLocaleDateString()}
                      disabled
                      style={{ background: "#f5f5f5", cursor: "not-allowed" }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Check-in Time</label>
                    <input
                      type="time"
                      value={editFormData.checkIn}
                      onChange={(e) => {
                        const newCheckIn = e.target.value;
                        const workingHours = calculateWorkingHours(
                          newCheckIn,
                          editFormData.checkOut
                        );
                        setEditFormData({
                          ...editFormData,
                          checkIn: newCheckIn,
                          workingHours,
                        });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Check-out Time</label>
                    <input
                      type="time"
                      value={editFormData.checkOut}
                      onChange={(e) => {
                        const newCheckOut = e.target.value;
                        const workingHours = calculateWorkingHours(
                          editFormData.checkIn,
                          newCheckOut
                        );
                        setEditFormData({
                          ...editFormData,
                          checkOut: newCheckOut,
                          workingHours,
                        });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Working Hours</label>
                    <input
                      type="text"
                      value={editFormData.workingHours || ""}
                      readOnly
                      placeholder="Auto-calculated"
                      style={{ background: "#f5f5f5", cursor: "not-allowed" }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea
                      value={editFormData.remarks}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          remarks: e.target.value,
                        })
                      }
                      rows={3}
                      placeholder="Add any remarks (optional)"
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowEditModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                    >
                      {loading ? "Updating..." : "Update Attendance"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Attendance;
