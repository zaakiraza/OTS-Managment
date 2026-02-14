import { NavLink } from "react-router-dom";
import { useState } from "react";
import ChangePassword from "../ChangePassword/ChangePassword";
import { getStoredUser } from "../../Utils/storage";
import { useNotifications } from "../../Context/NotificationContext";
import "./SideBar.css";

function SideBar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const user = getStoredUser();
  const { unreadCount } = useNotifications();
  const isSuperAdmin = user?.role?.name === "superAdmin";
  const isAttendanceDept = user?.role?.name === "attendanceDepartment";
  const isAssetManager = user?.role?.name === "ITAssetManager";
  const isTeamLead = user?.role?.name === "teamLead";
  const isEmployee = user?.role?.name === "employee";

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <h2>{isCollapsed ? "OMS" : "OMS"}</h2>
        <button
          className="toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <i className={`fas fa-chevron-${isCollapsed ? "right" : "left"}`}></i>
        </button>
      </div>

      <div className="user-info">
        <div className="user-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || "A"}
        </div>
        {!isCollapsed && (
          <div className="user-details">
            <p className="user-name">{user?.name || "Admin"}</p>
            <p className="user-role">{user?.role?.name || "SuperAdmin"}</p>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {/* Notifications - Top of List */}
        <NavLink to="/notifications" className="nav-item notification-nav-item">
          <span className="nav-icon">
            <i className="fas fa-bell"></i>
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </span>
          {!isCollapsed && <span className="nav-text">Notifications</span>}
        </NavLink>

        {/* SuperAdmin Menu */}
        {isSuperAdmin && (
          <>
            <NavLink to="/dashboard" className="nav-item">
              <span className="nav-icon"><i className="fas fa-chart-line"></i></span>
              {!isCollapsed && <span className="nav-text">Dashboard</span>}
            </NavLink>

            <NavLink to="/users" className="nav-item">
              <span className="nav-icon"><i className="fas fa-user-shield"></i></span>
              {!isCollapsed && <span className="nav-text">Admin Users</span>}
            </NavLink>

            <NavLink to="/roles" className="nav-item">
              <span className="nav-icon"><i className="fas fa-key"></i></span>
              {!isCollapsed && <span className="nav-text">Roles</span>}
            </NavLink>

            <NavLink to="/audit-logs" className="nav-item">
              <span className="nav-icon"><i className="fas fa-scroll"></i></span>
              {!isCollapsed && <span className="nav-text">Audit Logs</span>}
            </NavLink>

            <NavLink to="/email-templates" className="nav-item">
              <span className="nav-icon"><i className="fas fa-envelope"></i></span>
              {!isCollapsed && <span className="nav-text">Email Templates</span>}
            </NavLink>

            <NavLink to="/settings" className="nav-item">
              <span className="nav-icon"><i className="fas fa-cog"></i></span>
              {!isCollapsed && <span className="nav-text">Settings</span>}
            </NavLink>

            <NavLink to="/departments" className="nav-item">
              <span className="nav-icon"><i className="fas fa-building"></i></span>
              {!isCollapsed && <span className="nav-text">Departments</span>}
            </NavLink>

            <NavLink to="/employees" className="nav-item">
              <span className="nav-icon"><i className="fas fa-users"></i></span>
              {!isCollapsed && <span className="nav-text">Employees</span>}
            </NavLink>

            <NavLink to="/attendance" className="nav-item">
              <span className="nav-icon"><i className="fas fa-clipboard-check"></i></span>
              {!isCollapsed && <span className="nav-text">Attendance</span>}
            </NavLink>

            <NavLink to="/salaries" className="nav-item">
              <span className="nav-icon"><i className="fas fa-money-bill-wave"></i></span>
              {!isCollapsed && <span className="nav-text">Salaries</span>}
            </NavLink>

            <NavLink to="/reports" className="nav-item">
              <span className="nav-icon"><i className="fas fa-chart-bar"></i></span>
              {!isCollapsed && <span className="nav-text">Reports</span>}
            </NavLink>

            <NavLink to="/import" className="nav-item">
              <span className="nav-icon"><i className="fas fa-file-import"></i></span>
              {!isCollapsed && <span className="nav-text">Import</span>}
            </NavLink>

            <NavLink to="/leave-approval" className="nav-item">
              <span className="nav-icon"><i className="fas fa-user-clock"></i></span>
              {!isCollapsed && <span className="nav-text">Leave Approval</span>}
            </NavLink>

            <NavLink to="/attendance-justifications" className="nav-item">
              <span className="nav-icon"><i className="fas fa-clipboard-check"></i></span>
              {!isCollapsed && <span className="nav-text">Attendance Justifications</span>}
            </NavLink>

            <NavLink to="/assets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-laptop"></i></span>
              {!isCollapsed && <span className="nav-text">Assets</span>}
            </NavLink>

            <NavLink to="/asset-analytics" className="nav-item">
              <span className="nav-icon"><i className="fas fa-chart-bar"></i></span>
              {!isCollapsed && <span className="nav-text">Asset Analytics</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-ticket-alt"></i></span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>

            <NavLink to="/tasks" className="nav-item">
              <span className="nav-icon"><i className="fas fa-tasks"></i></span>
              {!isCollapsed && <span className="nav-text">Task Board</span>}
            </NavLink>

            <NavLink to="/my-tasks" className="nav-item">
              <span className="nav-icon"><i className="fas fa-check-circle"></i></span>
              {!isCollapsed && <span className="nav-text">My Tasks</span>}
            </NavLink>

            <NavLink to="/my-assets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-briefcase"></i></span>
              {!isCollapsed && <span className="nav-text">My Assets</span>}
            </NavLink>
          </>
        )}

        {/* Attendance Department Menu */}
        {isAttendanceDept && (
          <>
            <NavLink to="/departments" className="nav-item">
              <span className="nav-icon"><i className="fas fa-building"></i></span>
              {!isCollapsed && <span className="nav-text">Departments</span>}
            </NavLink>

            <NavLink to="/employees" className="nav-item">
              <span className="nav-icon"><i className="fas fa-users"></i></span>
              {!isCollapsed && <span className="nav-text">Employees</span>}
            </NavLink>

            <NavLink to="/attendance" className="nav-item">
              <span className="nav-icon"><i className="fas fa-clipboard-check"></i></span>
              {!isCollapsed && <span className="nav-text">Attendance</span>}
            </NavLink>

            <NavLink to="/salaries" className="nav-item">
              <span className="nav-icon"><i className="fas fa-money-bill-wave"></i></span>
              {!isCollapsed && <span className="nav-text">Salaries</span>}
            </NavLink>

            <NavLink to="/reports" className="nav-item">
              <span className="nav-icon"><i className="fas fa-chart-bar"></i></span>
              {!isCollapsed && <span className="nav-text">Reports</span>}
            </NavLink>

            <NavLink to="/import" className="nav-item">
              <span className="nav-icon"><i className="fas fa-file-import"></i></span>
              {!isCollapsed && <span className="nav-text">Import</span>}
            </NavLink>

            <NavLink to="/leave-approval" className="nav-item">
              <span className="nav-icon"><i className="fas fa-user-clock"></i></span>
              {!isCollapsed && <span className="nav-text">Leave Approval</span>}
            </NavLink>

            <NavLink to="/attendance-justifications" className="nav-item">
              <span className="nav-icon"><i className="fas fa-clipboard-check"></i></span>
              {!isCollapsed && <span className="nav-text">Attendance Justifications</span>}
            </NavLink>

            <NavLink to="/my-attendance" className="nav-item">
              <span className="nav-icon"><i className="fas fa-calendar-check"></i></span>
              {!isCollapsed && <span className="nav-text">My Attendance</span>}
            </NavLink>

            <NavLink to="/my-assets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-briefcase"></i></span>
              {!isCollapsed && <span className="nav-text">My Assets</span>}
            </NavLink>

            <NavLink to="/resources" className="nav-item">
              <span className="nav-icon"><i className="fas fa-box"></i></span>
              {!isCollapsed && <span className="nav-text">Resources</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-ticket-alt"></i></span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>

            <NavLink to="/tasks" className="nav-item">
              <span className="nav-icon"><i className="fas fa-tasks"></i></span>
              {!isCollapsed && <span className="nav-text">Task Board</span>}
            </NavLink>
          </>
        )}

        {/* Asset Manager Menu */}
        {isAssetManager && (
          <>
            <NavLink to="/assets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-laptop"></i></span>
              {!isCollapsed && <span className="nav-text">Assets</span>}
            </NavLink>

            <NavLink to="/asset-analytics" className="nav-item">
              <span className="nav-icon"><i className="fas fa-chart-bar"></i></span>
              {!isCollapsed && <span className="nav-text">Asset Analytics</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-ticket-alt"></i></span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>

            <NavLink to="/my-tasks" className="nav-item">
              <span className="nav-icon"><i className="fas fa-check-circle"></i></span>
              {!isCollapsed && <span className="nav-text">My Tasks</span>}
            </NavLink>

            <NavLink to="/my-attendance" className="nav-item">
              <span className="nav-icon"><i className="fas fa-calendar-check"></i></span>
              {!isCollapsed && <span className="nav-text">My Attendance</span>}
            </NavLink>

            <NavLink to="/my-assets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-briefcase"></i></span>
              {!isCollapsed && <span className="nav-text">My Assets</span>}
            </NavLink>
          </>
        )}

        {/* Team Lead Menu */}
        {isTeamLead && (
          <>
            <NavLink to="/tasks" className="nav-item">
              <span className="nav-icon"><i className="fas fa-tasks"></i></span>
              {!isCollapsed && <span className="nav-text">Task Board</span>}
            </NavLink>

            <NavLink to="/leave-approval" className="nav-item">
              <span className="nav-icon"><i className="fas fa-user-clock"></i></span>
              {!isCollapsed && <span className="nav-text">Leave Approval</span>}
            </NavLink>

            <NavLink to="/attendance-justifications" className="nav-item">
              <span className="nav-icon"><i className="fas fa-clipboard-check"></i></span>
              {!isCollapsed && <span className="nav-text">Attendance Justifications</span>}
            </NavLink>

            <NavLink to="/my-assets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-briefcase"></i></span>
              {!isCollapsed && <span className="nav-text">My Assets</span>}
            </NavLink>

            <NavLink to="/my-attendance" className="nav-item">
              <span className="nav-icon"><i className="fas fa-calendar-check"></i></span>
              {!isCollapsed && <span className="nav-text">My Attendance</span>}
            </NavLink>

            <NavLink to="/resources" className="nav-item">
              <span className="nav-icon"><i className="fas fa-box"></i></span>
              {!isCollapsed && <span className="nav-text">Resources</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-ticket-alt"></i></span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>
          </>
        )}

        {/* Employee Menu */}
        {isEmployee && (
          <>
            <NavLink to="/my-tasks" className="nav-item">
              <span className="nav-icon"><i className="fas fa-check-circle"></i></span>
              {!isCollapsed && <span className="nav-text">My Tasks</span>}
            </NavLink>

            <NavLink to="/my-assets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-briefcase"></i></span>
              {!isCollapsed && <span className="nav-text">My Assets</span>}
            </NavLink>

            <NavLink to="/my-attendance" className="nav-item">
              <span className="nav-icon"><i className="fas fa-calendar-check"></i></span>
              {!isCollapsed && <span className="nav-text">My Attendance</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon"><i className="fas fa-ticket-alt"></i></span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>
          </>
        )}

        {/* Common Menu Items (All Users) */}
        <div className="nav-divider"></div>

        <NavLink to="/feedback" className="nav-item">
          <span className="nav-icon"><i className="fas fa-comment-dots"></i></span>
          {!isCollapsed && <span className="nav-text">Feedback</span>}
        </NavLink>

        <NavLink to="/todos" className="nav-item">
          <span className="nav-icon"><i className="fas fa-list-check"></i></span>
          {!isCollapsed && <span className="nav-text">Personal Notes</span>}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/profile" className="nav-item profile-btn">
          <span className="nav-icon"><i className="fas fa-user-circle"></i></span>
          {!isCollapsed && <span className="nav-text">My Profile</span>}
        </NavLink>
        <button 
          onClick={() => setShowChangePassword(true)} 
          className="nav-item change-password-btn"
        >
          <span className="nav-icon"><i className="fas fa-lock"></i></span>
          {!isCollapsed && <span className="nav-text">Change Password</span>}
        </button>
        <button onClick={handleLogout} className="nav-item logout-btn">
          <span className="nav-icon"><i className="fas fa-sign-out-alt"></i></span>
          {!isCollapsed && <span className="nav-text">Logout</span>}
        </button>
      </div>

      <ChangePassword 
        show={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
    </div>
  );
}

export default SideBar;
