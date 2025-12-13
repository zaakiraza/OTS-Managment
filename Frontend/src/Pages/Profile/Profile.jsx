import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import ChangePassword from "../../Components/ChangePassword/ChangePassword";
import { authAPI, attendanceAPI } from "../../Config/Api";
import "./Profile.css";

function Profile() {
  const [user, setUser] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    fetchUserProfile();
    fetchAttendanceStats();
    fetchRecentAttendance();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await authAPI.getMe();
      // API returns 'data' or 'employee' depending on endpoint
      const userData = response.data.data || response.data.employee;
      if (response.data.success && userData) {
        setUser(userData);
        // Don't overwrite localStorage - it could corrupt sidebar state
      } else {
        // Fallback to localStorage data if API fails
        loadUserFromStorage();
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback to localStorage data
      loadUserFromStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadUserFromStorage = () => {
    const storedUser = localStorage.getItem("user");
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        console.error("Failed to parse stored user");
      }
    }
  };

  const fetchAttendanceStats = async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const response = await attendanceAPI.getAttendanceStats({
        month: currentMonth,
      });
      if (response.data.success) {
        setStats(response.data.data || {});
      }
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
    }
  };

  const fetchRecentAttendance = async () => {
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      
      const response = await attendanceAPI.getAllAttendance({
        startDate: startDate.toISOString().split("T")[0],
        endDate: today.toISOString().split("T")[0],
      });
      if (response.data.success) {
        // Filter only current user's attendance
        const myAttendance = response.data.data.filter(
          (a) => a.employee?._id === user?._id
        );
        setAttendance(myAttendance.slice(0, 7));
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const formatTime = (time) => {
    if (!time) return "--:--";
    return time;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      Present: "#10b981",
      Absent: "#ef4444",
      Late: "#f59e0b",
      "Half Day": "#8b5cf6",
      Leave: "#6b7280",
    };
    return colors[status] || "#64748b";
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <SideBar />
        <div className="main-content">
          <div className="profile-page">
            <div className="loading-spinner">Loading profile...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="profile-page">
          {/* Profile Header */}
          <div className="profile-header">
            <div className="profile-avatar">
              <span className="avatar-text">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="profile-info">
              <h1>{user?.name}</h1>
              <p className="profile-role">{user?.role?.name || "Employee"}</p>
              <p className="profile-id">ID: {user?.employeeId}</p>
            </div>
            <button
              className="btn-change-password"
              onClick={() => setShowChangePassword(true)}
            >
              🔐 Change Password
            </button>
          </div>

          {/* Tabs */}
          <div className="profile-tabs">
            <button
              className={`tab-btn ${activeTab === "info" ? "active" : ""}`}
              onClick={() => setActiveTab("info")}
            >
              📋 Basic Info
            </button>
            <button
              className={`tab-btn ${activeTab === "schedule" ? "active" : ""}`}
              onClick={() => setActiveTab("schedule")}
            >
              🕐 Work Schedule
            </button>
            <button
              className={`tab-btn ${activeTab === "attendance" ? "active" : ""}`}
              onClick={() => setActiveTab("attendance")}
            >
              📅 Attendance
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Basic Info Tab */}
            {activeTab === "info" && (
              <div className="info-section">
                <div className="info-grid">
                  <div className="info-card">
                    <h3>Personal Information</h3>
                    <div className="info-item">
                      <span className="info-label">Full Name</span>
                      <span className="info-value">{user?.name || "N/A"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Email</span>
                      <span className="info-value">{user?.email || "N/A"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Phone</span>
                      <span className="info-value">{user?.phone || "N/A"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">CNIC</span>
                      <span className="info-value">{user?.cnic || "N/A"}</span>
                    </div>
                  </div>

                  <div className="info-card">
                    <h3>Employment Details</h3>
                    <div className="info-item">
                      <span className="info-label">Employee ID</span>
                      <span className="info-value">{user?.employeeId || "N/A"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Biometric ID</span>
                      <span className="info-value">{user?.biometricId || "N/A"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Department</span>
                      <span className="info-value">{user?.department?.name || "N/A"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Position</span>
                      <span className="info-value">{user?.position || "N/A"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Role</span>
                      <span className="info-value role-badge">
                        {user?.role?.name || "N/A"}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Join Date</span>
                      <span className="info-value">
                        {user?.joiningDate
                          ? new Date(user.joiningDate).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  {user?.leadingDepartments?.length > 0 && (
                    <div className="info-card full-width">
                      <h3>Team Lead Responsibilities</h3>
                      <div className="departments-badges">
                        {user.leadingDepartments.map((dept) => (
                          <span key={dept._id} className="dept-badge">
                            🏢 {dept.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Work Schedule Tab */}
            {activeTab === "schedule" && (
              <div className="schedule-section">
                <div className="schedule-card">
                  <h3>📅 Your Work Schedule</h3>
                  <div className="schedule-grid">
                    <div className="schedule-item">
                      <span className="schedule-icon">🌅</span>
                      <div className="schedule-details">
                        <span className="schedule-label">Check-In Time</span>
                        <span className="schedule-value">
                          {user?.workSchedule?.checkInTime || "09:00"}
                        </span>
                      </div>
                    </div>
                    <div className="schedule-item">
                      <span className="schedule-icon">🌆</span>
                      <div className="schedule-details">
                        <span className="schedule-label">Check-Out Time</span>
                        <span className="schedule-value">
                          {user?.workSchedule?.checkOutTime || "17:00"}
                        </span>
                      </div>
                    </div>
                    <div className="schedule-item">
                      <span className="schedule-icon">📆</span>
                      <div className="schedule-details">
                        <span className="schedule-label">Working Days/Week</span>
                        <span className="schedule-value">
                          {user?.workSchedule?.workingDaysPerWeek || 5} days
                        </span>
                      </div>
                    </div>
                    <div className="schedule-item">
                      <span className="schedule-icon">⏱️</span>
                      <div className="schedule-details">
                        <span className="schedule-label">Working Hours/Week</span>
                        <span className="schedule-value">
                          {user?.workSchedule?.workingHoursPerWeek || 40} hours
                        </span>
                      </div>
                    </div>
                  </div>

                  {user?.workSchedule?.weeklyOffs?.length > 0 && (
                    <div className="weekly-offs">
                      <h4>Weekly Off Days</h4>
                      <div className="off-days">
                        {user.workSchedule.weeklyOffs.map((day) => (
                          <span key={day} className="off-day-badge">
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="schedule-card">
                  <h3>📊 This Month's Summary</h3>
                  <div className="stats-grid">
                    <div className="stat-item present">
                      <span className="stat-value">{stats.present || 0}</span>
                      <span className="stat-label">Present</span>
                    </div>
                    <div className="stat-item absent">
                      <span className="stat-value">{stats.absent || 0}</span>
                      <span className="stat-label">Absent</span>
                    </div>
                    <div className="stat-item late">
                      <span className="stat-value">{stats.late || 0}</span>
                      <span className="stat-label">Late</span>
                    </div>
                    <div className="stat-item leave">
                      <span className="stat-value">{stats.leave || 0}</span>
                      <span className="stat-label">Leave</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Attendance Tab */}
            {activeTab === "attendance" && (
              <div className="attendance-section">
                <div className="attendance-card">
                  <h3>📅 Recent Attendance (Last 7 Days)</h3>
                  {attendance.length > 0 ? (
                    <table className="attendance-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Check In</th>
                          <th>Check Out</th>
                          <th>Working Hours</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((record) => (
                          <tr key={record._id}>
                            <td>{formatDate(record.date)}</td>
                            <td className="time">{formatTime(record.checkIn)}</td>
                            <td className="time">{formatTime(record.checkOut)}</td>
                            <td>{record.workingHours?.toFixed(2) || "0"} hrs</td>
                            <td>
                              <span
                                className="status-badge"
                                style={{
                                  background: getStatusColor(record.status),
                                }}
                              >
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-data">
                      No attendance records found for the last 7 days
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Change Password Modal */}
          <ChangePassword
            show={showChangePassword}
            onClose={() => setShowChangePassword(false)}
          />
        </div>
      </div>
    </div>
  );
}

export default Profile;

