import { NavLink } from "react-router-dom";
import { useState } from "react";
import ChangePassword from "../ChangePassword/ChangePassword";
import "./SideBar.css";

function SideBar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
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
        <h2>{isCollapsed ? "OMS" : "OMS Admin"}</h2>
        <button
          className="toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? "→" : "←"}
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
        {/* SuperAdmin Menu */}
        {isSuperAdmin && (
          <>
            <NavLink to="/dashboard" className="nav-item">
              <span className="nav-icon">📊</span>
              {!isCollapsed && <span className="nav-text">Dashboard</span>}
            </NavLink>

            <NavLink to="/users" className="nav-item">
              <span className="nav-icon">👥</span>
              {!isCollapsed && <span className="nav-text">Users</span>}
            </NavLink>

            <NavLink to="/roles" className="nav-item">
              <span className="nav-icon">🔑</span>
              {!isCollapsed && <span className="nav-text">Roles</span>}
            </NavLink>

            <NavLink to="/departments" className="nav-item">
              <span className="nav-icon">🏢</span>
              {!isCollapsed && <span className="nav-text">Departments</span>}
            </NavLink>

            <NavLink to="/employees" className="nav-item">
              <span className="nav-icon">👨‍💼</span>
              {!isCollapsed && <span className="nav-text">Employees</span>}
            </NavLink>

            <NavLink to="/attendance" className="nav-item">
              <span className="nav-icon">📋</span>
              {!isCollapsed && <span className="nav-text">Attendance</span>}
            </NavLink>

            <NavLink to="/salaries" className="nav-item">
              <span className="nav-icon">💰</span>
              {!isCollapsed && <span className="nav-text">Salaries</span>}
            </NavLink>

            <NavLink to="/reports" className="nav-item">
              <span className="nav-icon">📈</span>
              {!isCollapsed && <span className="nav-text">Reports</span>}
            </NavLink>

            <NavLink to="/import" className="nav-item">
              <span className="nav-icon">📥</span>
              {!isCollapsed && <span className="nav-text">Import</span>}
            </NavLink>

            <NavLink to="/assets" className="nav-item">
              <span className="nav-icon">🖥️</span>
              {!isCollapsed && <span className="nav-text">Assets</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon">🎫</span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>

            <NavLink to="/tasks" className="nav-item">
              <span className="nav-icon">📌</span>
              {!isCollapsed && <span className="nav-text">Task Board</span>}
            </NavLink>

            <NavLink to="/my-tasks" className="nav-item">
              <span className="nav-icon">✓</span>
              {!isCollapsed && <span className="nav-text">My Tasks</span>}
            </NavLink>
          </>
        )}

        {/* Attendance Department Menu */}
        {isAttendanceDept && (
          <>
            <NavLink to="/departments" className="nav-item">
              <span className="nav-icon">🏢</span>
              {!isCollapsed && <span className="nav-text">Departments</span>}
            </NavLink>

            <NavLink to="/employees" className="nav-item">
              <span className="nav-icon">👨‍💼</span>
              {!isCollapsed && <span className="nav-text">Employees</span>}
            </NavLink>

            <NavLink to="/attendance" className="nav-item">
              <span className="nav-icon">📋</span>
              {!isCollapsed && <span className="nav-text">Attendance</span>}
            </NavLink>

            <NavLink to="/salaries" className="nav-item">
              <span className="nav-icon">💰</span>
              {!isCollapsed && <span className="nav-text">Salaries</span>}
            </NavLink>

            <NavLink to="/reports" className="nav-item">
              <span className="nav-icon">📈</span>
              {!isCollapsed && <span className="nav-text">Reports</span>}
            </NavLink>

            <NavLink to="/import" className="nav-item">
              <span className="nav-icon">📥</span>
              {!isCollapsed && <span className="nav-text">Import</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon">🎫</span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>

            <NavLink to="/tasks" className="nav-item">
              <span className="nav-icon">📌</span>
              {!isCollapsed && <span className="nav-text">Task Board</span>}
            </NavLink>

            <NavLink to="/my-tasks" className="nav-item">
              <span className="nav-icon">✓</span>
              {!isCollapsed && <span className="nav-text">My Tasks</span>}
            </NavLink>
          </>
        )}

        {/* Asset Manager Menu */}
        {isAssetManager && (
          <>
            <NavLink to="/assets" className="nav-item">
              <span className="nav-icon">🖥️</span>
              {!isCollapsed && <span className="nav-text">Assets</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon">🎫</span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>

            <NavLink to="/my-tasks" className="nav-item">
              <span className="nav-icon">✓</span>
              {!isCollapsed && <span className="nav-text">My Tasks</span>}
            </NavLink>
          </>
        )}

        {/* Team Lead Menu */}
        {isTeamLead && (
          <>
            <NavLink to="/employees" className="nav-item">
              <span className="nav-icon">👨‍💼</span>
              {!isCollapsed && <span className="nav-text">Employees</span>}
            </NavLink>

            <NavLink to="/tasks" className="nav-item">
              <span className="nav-icon">📌</span>
              {!isCollapsed && <span className="nav-text">Task Board</span>}
            </NavLink>

            <NavLink to="/my-tasks" className="nav-item">
              <span className="nav-icon">✓</span>
              {!isCollapsed && <span className="nav-text">My Tasks</span>}
            </NavLink>

            <NavLink to="/my-assets" className="nav-item">
              <span className="nav-icon">💼</span>
              {!isCollapsed && <span className="nav-text">My Assets</span>}
            </NavLink>

            <NavLink to="/my-attendance" className="nav-item">
              <span className="nav-icon">📋</span>
              {!isCollapsed && <span className="nav-text">My Attendance</span>}
            </NavLink>

            <NavLink to="/resources" className="nav-item">
              <span className="nav-icon">📦</span>
              {!isCollapsed && <span className="nav-text">Resources</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon">🎫</span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>
          </>
        )}

        {/* Employee Menu */}
        {isEmployee && (
          <>
            <NavLink to="/my-tasks" className="nav-item">
              <span className="nav-icon">✓</span>
              {!isCollapsed && <span className="nav-text">My Tasks</span>}
            </NavLink>

            <NavLink to="/my-assets" className="nav-item">
              <span className="nav-icon">💼</span>
              {!isCollapsed && <span className="nav-text">My Assets</span>}
            </NavLink>

            <NavLink to="/my-attendance" className="nav-item">
              <span className="nav-icon">📋</span>
              {!isCollapsed && <span className="nav-text">My Attendance</span>}
            </NavLink>

            <NavLink to="/tickets" className="nav-item">
              <span className="nav-icon">🎫</span>
              {!isCollapsed && <span className="nav-text">Tickets</span>}
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <button 
          onClick={() => setShowChangePassword(true)} 
          className="nav-item change-password-btn"
        >
          <span className="nav-icon">🔐</span>
          {!isCollapsed && <span className="nav-text">Change Password</span>}
        </button>
        <button onClick={handleLogout} className="nav-item logout-btn">
          <span className="nav-icon">🚪</span>
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
