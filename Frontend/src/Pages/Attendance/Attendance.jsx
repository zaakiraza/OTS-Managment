import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { attendanceAPI, employeeAPI, departmentAPI, exportAPI } from "../../Config/Api";
import settingsAPI from "../../Config/settingsApi";
import { useToast } from "../../Components/Common/Toast/Toast";
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
  const toast = useToast();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    date: new Date().toISOString().split("T")[0],
    userId: "",
    status: "",
    department: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editFormData, setEditFormData] = useState({
    checkIn: "",
    checkOut: "",
    status: "",
    remarks: "",
    workingHours: "",
  });
  const [manualFormData, setManualFormData] = useState({
    department: "",
    userId: "",
    date: new Date().toISOString().split("T")[0],
    checkIn: "",
    checkOut: "",
    status: "",
    remarks: "",
    workingHours: "",
  });
  const [stats, setStats] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [settings, setSettings] = useState({
    manualAttendanceEnabled: true,
    importAttendanceEnabled: true,
  });
  const [holidayFormData, setHolidayFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    scope: "all",
    departmentId: "",
    remarks: "Holiday - manually marked present",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch { return {}; }
  })();
  const isSuperAdmin = user?.role?.name === "superAdmin";
  const canManualEntry =
    (isSuperAdmin || user?.role?.name === "attendanceDepartment") &&
    (isSuperAdmin || settings.manualAttendanceEnabled);
  const canHolidayMark = isSuperAdmin || user?.role?.name === "attendanceDepartment";

  useEffect(() => {
    fetchTodayAttendance();
    fetchAttendanceStats();
    fetchSettings();
    fetchDepartments();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.getAll();
      if (response.data.success) {
        setSettings({
          manualAttendanceEnabled: response.data.data.manualAttendanceEnabled?.value ?? true,
          importAttendanceEnabled: response.data.data.importAttendanceEnabled?.value ?? true,
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await settingsAPI.updateBulk([
        { key: "manualAttendanceEnabled", value: settings.manualAttendanceEnabled },
        { key: "importAttendanceEnabled", value: settings.importAttendanceEnabled },
      ]);
      toast.success("Settings saved successfully!");
      setShowSettingsModal(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

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
      if (filter.department) params.department = filter.department;

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
      // Request flat departments to get all departments in a single array
      const response = await departmentAPI.getAll({ flat: true });
      if (response.data.success) {
        // Backend returns flat array when flat=true
        setDepartments(response.data.data || []);
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
    const value = e.target.value;
    
    // Validate date: prevent selecting future dates
    if (e.target.name === "date" && value) {
      const selectedDate = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      if (selectedDate > today) {
        // If future date selected, set to today
        const todayStr = new Date().toISOString().split("T")[0];
        setFilter({
          ...filter,
          [e.target.name]: todayStr,
        });
        return;
      }
    }
    
    setFilter({
      ...filter,
      [e.target.name]: value,
    });
  };

  const formatTime = (time) => {
    if (!time) return "-";

    try {
      // Parse as UTC so website matches Excel export (both use PKT = UTC+5).
      // ISO strings without "Z" are parsed as local time by the browser, which causes mismatch.
      let date;
      if (typeof time === "string" && time.indexOf("T") !== -1 && !time.endsWith("Z") && !time.endsWith("z")) {
        date = new Date(time + "Z");
      } else {
        date = new Date(time);
      }
      if (isNaN(date.getTime())) return "-";

      // PKT = UTC+5 (same as backend formatLocalTime in export)
      let pktHours = date.getUTCHours() + 5;
      const pktMinutes = date.getUTCMinutes();

      if (pktHours >= 24) pktHours -= 24;
      if (pktHours < 0) pktHours += 24;

      const ampm = pktHours >= 12 ? "PM" : "AM";
      let hours12 = pktHours % 12;
      if (hours12 === 0) hours12 = 12;

      const minutes = String(pktMinutes).padStart(2, "0");
      return `${hours12}:${minutes} ${ampm}`;
    } catch (error) {
      return "-";
    }
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
      "early-departure": "status-early",
      "late-early-departure": "status-late-early",
      pending: "status-pending",
      missing: "status-missing",
    };
    return statusColors[status] || "status-pending";
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      present: "Present",
      absent: "Absent",
      "half-day": "Half Day",
      late: "Late",
      "early-departure": "Early Departure",
      "late-early-departure": "Late + Early Departure",
      pending: "Pending",
      missing: "Missing",
    };
    return statusLabels[status] || status;
  };

  const handleEdit = (record) => {
    setSelectedRecord(record);

    // Extract time in HH:MM format (PKT = UTC+5), same logic as formatTime
    let checkInTime = "";
    let checkOutTime = "";

    const parseAsUTC = (t) => {
      if (!t) return null;
      if (typeof t === "string" && t.indexOf("T") !== -1 && !t.endsWith("Z") && !t.endsWith("z"))
        return new Date(t + "Z");
      return new Date(t);
    };

    if (record.checkIn) {
      const date = parseAsUTC(record.checkIn);
      if (!isNaN(date.getTime())) {
        let pktHours = date.getUTCHours() + 5;
        const pktMinutes = date.getUTCMinutes();
        if (pktHours >= 24) pktHours -= 24;
        if (pktHours < 0) pktHours += 24;
        checkInTime = `${String(pktHours).padStart(2, "0")}:${String(pktMinutes).padStart(2, "0")}`;
      }
    }

    if (record.checkOut) {
      const date = parseAsUTC(record.checkOut);
      if (!isNaN(date.getTime())) {
        let pktHours = date.getUTCHours() + 5;
        const pktMinutes = date.getUTCMinutes();
        if (pktHours >= 24) pktHours -= 24;
        if (pktHours < 0) pktHours += 24;
        checkOutTime = `${String(pktHours).padStart(2, "0")}:${String(pktMinutes).padStart(2, "0")}`;
      }
    }
    
    const workingHours = record.workingHours || "";
    setEditFormData({
      checkIn: checkInTime,
      checkOut: checkOutTime,
      status: record.status || "",
      remarks: record.remarks || "",
      workingHours: workingHours,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      const submitData = {
        remarks: editFormData.remarks,
      };

      // If status is leave, don't send check-in/check-out times
      if (editFormData.status !== "leave") {
        // Send time strings (HH:MM:SS) - backend will combine with date and convert to UTC
        if (editFormData.checkIn) {
          // Ensure format is HH:MM:SS
          const timeStr = editFormData.checkIn.length === 5 ? `${editFormData.checkIn}:00` : editFormData.checkIn;
          submitData.checkIn = timeStr;
        }
        if (editFormData.checkOut) {
          // Ensure format is HH:MM:SS
          const timeStr = editFormData.checkOut.length === 5 ? `${editFormData.checkOut}:00` : editFormData.checkOut;
          submitData.checkOut = timeStr;
        }
        if (editFormData.workingHours) {
          submitData.workingHours = parseFloat(editFormData.workingHours);
        }
      }
      
      if (editFormData.status) {
        submitData.status = editFormData.status;
      }

      await attendanceAPI.updateAttendance(selectedRecord._id, submitData);
      toast.success("Attendance updated successfully!");
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
      toast.error(error.response?.data?.message || "Failed to update attendance");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      const submitData = {
        userId: manualFormData.userId,
        date: `${manualFormData.date}T00:00:00`,
        remarks: manualFormData.remarks,
      };

      // If status is leave, don't send check-in/check-out times
      if (manualFormData.status !== "leave") {
        // Send time strings (HH:MM:SS) - backend will combine with date and convert to UTC
        if (manualFormData.checkIn) {
          const timeStr = manualFormData.checkIn.length === 5 ? `${manualFormData.checkIn}:00` : manualFormData.checkIn;
          submitData.checkIn = timeStr;
        }
        if (manualFormData.checkOut) {
          const timeStr = manualFormData.checkOut.length === 5 ? `${manualFormData.checkOut}:00` : manualFormData.checkOut;
          submitData.checkOut = timeStr;
        }
        if (manualFormData.workingHours) {
          submitData.workingHours = parseFloat(manualFormData.workingHours);
        }
      }
      
      if (manualFormData.status) {
        submitData.status = manualFormData.status;
      }

      await attendanceAPI.createManualAttendance(submitData);
      toast.success("Manual attendance created successfully!");
      
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
        status: "",
        remarks: "",
        workingHours: "",
      });
      fetchTodayAttendance();
      // fetchAttendance will be called automatically by useEffect when filter.date changes
    } catch (error) {
      console.error("Error creating manual attendance:", error);
      toast.error(
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

  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        date: holidayFormData.date,
        scope: holidayFormData.scope,
        remarks: holidayFormData.remarks,
      };

      if (holidayFormData.scope === "department") {
        payload.departmentId = holidayFormData.departmentId;
      }

      const response = await attendanceAPI.markHolidayPresent(payload);
      toast.success(response.data?.message || "Holiday present marked successfully");
      setShowHolidayModal(false);
      fetchAttendance();
      fetchTodayAttendance();
      fetchAttendanceStats();
    } catch (error) {
      console.error("Error marking holiday present:", error);
      toast.error(error.response?.data?.message || "Failed to mark holiday present");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      
      // Build params from current filter
      const params = {};
      if (filter.date) {
        // For single date export, set both startDate and endDate to the same value
        params.startDate = filter.date;
        params.endDate = filter.date;
      }
      if (filter.userId) params.employeeId = filter.userId;
      if (filter.status) params.status = filter.status;
      
      const response = await exportAPI.exportAttendance(format, params);
      
      const blob = new Blob([response.data], {
        type: format === 'xlsx' 
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv"
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance_${filter.date || 'report'}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.response?.data?.message || "Failed to export attendance");
    } finally {
      setExporting(false);
    }
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
              <h1><i className="fas fa-clipboard-check"></i> Attendance Management</h1>
              <p>Track and manage employee attendance</p>
            </div>
            <div className="header-actions">
              {isSuperAdmin && (
                <button
                  className="btn-settings"
                  onClick={() => setShowSettingsModal(true)}
                  title="Attendance Settings"
                >
                  <i className="fas fa-cog"></i> Settings
                </button>
              )}
              {canManualEntry && (
                <button
                  className="btn-primary"
                  onClick={() => setShowManualModal(true)}
                >
                  + Manual Entry
                </button>
              )}
              {canHolidayMark && (
                <button
                  className="btn-primary"
                  onClick={() => setShowHolidayModal(true)}
                  style={{ background: "#0ea5a3" }}
                >
                  + Holiday Present
                </button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><i className="fas fa-user-check"></i></div>
              <div className="stat-info">
                <h3>Today Present</h3>
                <p className="stat-value">
                  {todayRecords.filter((r) => r.checkIn).length}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><i className="fas fa-clock"></i></div>
              <div className="stat-info">
                <h3>Checked Out</h3>
                <p className="stat-value">
                  {todayRecords.filter((r) => r.checkOut).length}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><i className="fas fa-hourglass-half"></i></div>
              <div className="stat-info">
                <h3>Still Working</h3>
                <p className="stat-value">
                  {todayRecords.filter((r) => r.checkIn && !r.checkOut).length}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><i className="fas fa-users"></i></div>
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
                max={new Date().toISOString().split("T")[0]}
                onChange={handleFilterChange}
              />
            </div>
            <div className="filter-group">
              <label>Department</label>
              <select
                name="department"
                value={filter.department}
                onChange={handleFilterChange}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>
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
            <div className="filter-group export-buttons">
              <label>Export</label>
              <div className="btn-group">
                <button
                  type="button"
                  className="btn-export excel"
                  onClick={() => handleExport('xlsx')}
                  disabled={exporting || displayRecords.length === 0}
                >
                  {exporting ? <><i className="fas fa-spinner fa-spin"></i></> : <><i className="fas fa-file-excel"></i> Excel</>}
                </button>
                <button
                  type="button"
                  className="btn-export csv"
                  onClick={() => handleExport('csv')}
                  disabled={exporting || displayRecords.length === 0}
                >
                  {exporting ? <><i className="fas fa-spinner fa-spin"></i></> : <><i className="fas fa-file-csv"></i> CSV</>}
                </button>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Working Hours</th>
                  <th>Extra Hours</th>
                  <th>Status</th>
                  <th>Device</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: "center" }}>
                      Loading...
                    </td>
                  </tr>
                ) : displayRecords.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: "center" }}>
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  displayRecords.map((record) => (
                    <tr key={record._id}>
                      <td>{record?.employee?.employeeId}</td>
                      <td>{record?.employee?.name}</td>
                      <td>{record?.department?.name || record?.employee?.department?.name || "-"}</td>
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
                        {record.extraWorkingHours && record.extraWorkingHours > 0 ? (
                          <span style={{ color: "#10b981", fontWeight: "bold" }}>
                            +{record.extraWorkingHours.toFixed(2)}h
                          </span>
                        ) : (
                          "-"
                        )}
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
                          <i className="fas fa-edit"></i>
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
                  <h2>
                    <i className="fas fa-plus-circle"></i> Manual Attendance Entry
                  </h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowManualModal(false)}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <form onSubmit={handleManualSubmit} className="modal-body">
                  <div className="form-section-title">
                    <i className="fas fa-user"></i> Employee Selection
                  </div>
                  
                  <div className="form-group">
                    <label><i className="fas fa-building"></i> Department <span className="required">*</span></label>
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
                    <label><i className="fas fa-user-tie"></i> Employee <span className="required">*</span></label>
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
                      style={!manualFormData.department ? { background: 'linear-gradient(to right, #e0f2f4, #f5f5f5)', cursor: 'not-allowed' } : {}}
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
                    {!manualFormData.department && (
                      <small className="helper-text warning"><i className="fas fa-info-circle"></i> Select a department first</small>
                    )}
                  </div>
                  
                  <div className="form-section-title">
                    <i className="fas fa-clock"></i> Time Details
                  </div>
                  
                  <div className="form-group">
                    <label><i className="fas fa-calendar-day"></i> Date <span className="required">*</span></label>
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
                  <div className="form-row">
                    <div className="form-group">
                      <label><i className="fas fa-sign-in-alt"></i> Check-in Time</label>
                      <input
                        type="time"
                        value={manualFormData.checkIn}
                        disabled={manualFormData.status === "leave"}
                        onChange={(e) => {
                          // Don't allow changes if status is leave
                          if (manualFormData.status === "leave") return;
                          
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
                      {manualFormData.status === "leave" && (
                        <small className="helper-text warning">
                          <i className="fas fa-info-circle"></i> Check-in time not applicable for leave status
                        </small>
                      )}
                    </div>
                    <div className="form-group">
                      <label><i className="fas fa-sign-out-alt"></i> Check-out Time</label>
                      <input
                        type="time"
                        value={manualFormData.checkOut}
                        disabled={manualFormData.status === "leave"}
                        onChange={(e) => {
                          // Don't allow changes if status is leave
                          if (manualFormData.status === "leave") return;
                          
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
                      {manualFormData.status === "leave" && (
                        <small className="helper-text warning">
                          <i className="fas fa-info-circle"></i> Check-out time not applicable for leave status
                        </small>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-section-title">
                    <i className="fas fa-cog"></i> Additional Options
                  </div>
                  
                  <div className="form-group">
                    <label><i className="fas fa-flag"></i> Status</label>
                    <select
                      value={manualFormData.status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        // If status is set to leave, clear check-in and check-out times
                        if (newStatus === "leave") {
                          setManualFormData({
                            ...manualFormData,
                            status: newStatus,
                            checkIn: "",
                            checkOut: "",
                            workingHours: "",
                          });
                        } else {
                          setManualFormData({
                            ...manualFormData,
                            status: newStatus,
                          });
                        }
                      }}
                    >
                      <option value="">Auto-calculate based on times</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="half-day">Half Day</option>
                      <option value="late">Late</option>
                      <option value="early-departure">Early Departure</option>
                      <option value="late-early-departure">Late & Early Departure</option>
                      <option value="leave">Leave</option>
                      <option value="pending">Pending</option>
                    </select>
                    <small className="helper-text info"><i className="fas fa-lightbulb"></i> Leave empty for auto-calculation</small>
                  </div>
                  <div className="form-group">
                    <label><i className="fas fa-comment-alt"></i> Remarks</label>
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
                      <i className="fas fa-times"></i> Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                    >
                      <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-plus"}></i>
                      {loading ? " Creating..." : " Create Entry"}
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
                  <h2>
                    <i className="fas fa-edit"></i> Edit Attendance
                  </h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowEditModal(false)}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <form onSubmit={handleEditSubmit} className="modal-body">
                  <div className="form-section-title">
                    <i className="fas fa-user"></i> Employee Information
                  </div>
                  
                  <div className="form-group">
                    <label><i className="fas fa-id-badge"></i> Employee</label>
                    <input
                      type="text"
                      value={`${selectedRecord.employee?.employeeId || selectedRecord.userId} - ${
                        selectedRecord.user?.name ||
                        selectedRecord.employee?.name ||
                        "N/A"
                      }`}
                      disabled
                      style={{ background: 'linear-gradient(to right, #e0f2f4, #f5f5f5)', cursor: 'not-allowed' }}
                    />
                    <small className="helper-text info"><i className="fas fa-lock"></i> Employee cannot be changed</small>
                  </div>
                  <div className="form-group">
                    <label><i className="fas fa-calendar-day"></i> Date</label>
                    <input
                      type="text"
                      value={new Date(selectedRecord.date).toLocaleDateString()}
                      disabled
                      style={{ background: 'linear-gradient(to right, #e0f2f4, #f5f5f5)', cursor: 'not-allowed' }}
                    />
                    <small className="helper-text info"><i className="fas fa-lock"></i> Date cannot be changed</small>
                  </div>
                  
                  <div className="form-section-title">
                    <i className="fas fa-clock"></i> Time Details
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label><i className="fas fa-sign-in-alt"></i> Check-in Time</label>
                      <input
                        type="time"
                        value={editFormData.checkIn}
                        disabled={editFormData.status === "leave"}
                        onChange={(e) => {
                          // Don't allow changes if status is leave
                          if (editFormData.status === "leave") return;
                          
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
                      {editFormData.status === "leave" && (
                        <small className="helper-text warning">
                          <i className="fas fa-info-circle"></i> Check-in time not applicable for leave status
                        </small>
                      )}
                    </div>
                    <div className="form-group">
                      <label><i className="fas fa-sign-out-alt"></i> Check-out Time</label>
                      <input
                        type="time"
                        value={editFormData.checkOut}
                        disabled={editFormData.status === "leave"}
                        onChange={(e) => {
                          // Don't allow changes if status is leave
                          if (editFormData.status === "leave") return;
                          
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
                      {editFormData.status === "leave" && (
                        <small className="helper-text warning">
                          <i className="fas fa-info-circle"></i> Check-out time not applicable for leave status
                        </small>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label><i className="fas fa-hourglass-half"></i> Working Hours</label>
                    <input
                      type="text"
                      value={editFormData.workingHours || ""}
                      readOnly
                      placeholder="Auto-calculated"
                      style={{ background: 'linear-gradient(to right, #e0f2f4, #f5f5f5)', cursor: 'not-allowed' }}
                    />
                    <small className="helper-text info"><i className="fas fa-calculator"></i> Auto-calculated from check-in/out times</small>
                  </div>
                  {selectedRecord && selectedRecord.extraWorkingHours > 0 && (
                    <div className="form-group">
                      <label><i className="fas fa-clock"></i> Extra Working Hours</label>
                      <input
                        type="text"
                        value={`+${selectedRecord.extraWorkingHours.toFixed(2)} hours`}
                        readOnly
                        style={{ 
                          background: 'linear-gradient(to right, #d1fae5, #f0fdf4)', 
                          cursor: 'not-allowed',
                          color: '#10b981',
                          fontWeight: 'bold'
                        }}
                      />
                      <small className="helper-text info"><i className="fas fa-info-circle"></i> Hours worked beyond scheduled time</small>
                    </div>
                  )}
                  
                  <div className="form-section-title">
                    <i className="fas fa-cog"></i> Additional Options
                  </div>
                  
                  <div className="form-group">
                    <label><i className="fas fa-flag"></i> Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        // If status is set to leave, clear check-in and check-out times
                        if (newStatus === "leave") {
                          setEditFormData({
                            ...editFormData,
                            status: newStatus,
                            checkIn: "",
                            checkOut: "",
                            workingHours: "",
                          });
                        } else {
                          setEditFormData({
                            ...editFormData,
                            status: newStatus,
                          });
                        }
                      }}
                    >
                      <option value="">Auto-calculate based on times</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="half-day">Half Day</option>
                      <option value="late">Late</option>
                      <option value="early-departure">Early Departure</option>
                      <option value="late-early-departure">Late & Early Departure</option>
                      <option value="leave">Leave</option>
                      <option value="pending">Pending</option>
                    </select>
                    <small className="helper-text info"><i className="fas fa-lightbulb"></i> Leave empty for auto-calculation</small>
                  </div>
                  <div className="form-group">
                    <label><i className="fas fa-comment-alt"></i> Remarks</label>
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
                      <i className="fas fa-times"></i> Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                    >
                      <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-save"}></i>
                      {loading ? " Updating..." : " Update Attendance"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Holiday Present Modal */}
          {showHolidayModal && (
            <div className="modal-overlay" onClick={() => setShowHolidayModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>
                    <i className="fas fa-calendar-check"></i> Mark Holiday Present
                  </h2>
                  <button className="close-btn" onClick={() => setShowHolidayModal(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <form onSubmit={handleHolidaySubmit} className="modal-body">
                  <div className="form-group">
                    <label><i className="fas fa-calendar-day"></i> Date <span className="required">*</span></label>
                    <input
                      type="date"
                      value={holidayFormData.date}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setHolidayFormData({ ...holidayFormData, date: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label><i className="fas fa-layer-group"></i> Scope <span className="required">*</span></label>
                    <select
                      value={holidayFormData.scope}
                      onChange={(e) =>
                        setHolidayFormData({
                          ...holidayFormData,
                          scope: e.target.value,
                          departmentId: e.target.value === "department" ? holidayFormData.departmentId : "",
                        })
                      }
                      required
                    >
                      <option value="all">All Employees</option>
                      <option value="department">Specific Department</option>
                    </select>
                  </div>

                  {holidayFormData.scope === "department" && (
                    <div className="form-group">
                      <label><i className="fas fa-building"></i> Department <span className="required">*</span></label>
                      <select
                        value={holidayFormData.departmentId}
                        onChange={(e) =>
                          setHolidayFormData({ ...holidayFormData, departmentId: e.target.value })
                        }
                        required
                      >
                        <option value="">-- Select Department --</option>
                        {departments.map((dept) => (
                          <option key={dept._id} value={dept._id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label><i className="fas fa-comment"></i> Remarks</label>
                    <textarea
                      rows={3}
                      value={holidayFormData.remarks}
                      onChange={(e) =>
                        setHolidayFormData({ ...holidayFormData, remarks: e.target.value })
                      }
                      placeholder="Holiday reason"
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowHolidayModal(false)}
                    >
                      <i className="fas fa-times"></i> Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-check"}></i>
                      {loading ? " Applying..." : " Apply Present"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Settings Modal */}
          {showSettingsModal && (
            <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
              <div className="modal-content modal-settings" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2><i className="fas fa-cog"></i> Attendance Settings</h2>
                  <button className="close-btn" onClick={() => setShowSettingsModal(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="settings-description">
                    Control attendance features for the Attendance Department. SuperAdmin always has full access.
                  </p>
                  
                  <div className="settings-list">
                    <div className="setting-item">
                      <div className="setting-info">
                        <div className="setting-icon">
                          <i className="fas fa-edit"></i>
                        </div>
                        <div className="setting-text">
                          <h4>Manual Attendance Entry</h4>
                          <p>Allow Attendance Department to manually add/edit attendance records</p>
                        </div>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.manualAttendanceEnabled}
                          onChange={(e) =>
                            setSettings({ ...settings, manualAttendanceEnabled: e.target.checked })
                          }
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="setting-item">
                      <div className="setting-info">
                        <div className="setting-icon">
                          <i className="fas fa-file-import"></i>
                        </div>
                        <div className="setting-text">
                          <h4>Import Attendance</h4>
                          <p>Allow Attendance Department to import attendance data from files</p>
                        </div>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.importAttendanceEnabled}
                          onChange={(e) =>
                            setSettings({ ...settings, importAttendanceEnabled: e.target.checked })
                          }
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-info-box">
                    <i className="fas fa-info-circle"></i>
                    <span>SuperAdmin users are not affected by these settings and always have full access.</span>
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowSettingsModal(false)}
                  >
                    <i className="fas fa-times"></i> Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                  >
                    <i className={savingSettings ? "fas fa-spinner fa-spin" : "fas fa-save"}></i>
                    {savingSettings ? " Saving..." : " Save Settings"}
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

export default Attendance;
