import { NavLink } from "react-router-dom";
import { useState } from "react";
import "./SideBar.css";

function SideBar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = user?.role?.name === "superAdmin";
  const isAttendanceDept = user?.role?.name === "attendanceDepartment";
  const isAssetManager = user?.role?.name === "ITAssetManager";

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
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="nav-item logout-btn">
          <span className="nav-icon">🚪</span>
          {!isCollapsed && <span className="nav-text">Logout</span>}
        </button>
      </div>
    </div>
  );
}

export default SideBar;
