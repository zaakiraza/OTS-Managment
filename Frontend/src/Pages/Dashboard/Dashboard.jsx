import SideBar from "../../Components/SideBar/SideBar";
import "./Dashboard.css";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="dashboard-container">
          <div className="page-header">
            <h1>Dashboard</h1>
            <p>Welcome back, {user?.name || "Admin"}!</p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-info">
                <h3>Total Users</h3>
                <p className="stat-value">0</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🔑</div>
              <div className="stat-info">
                <h3>Total Roles</h3>
                <p className="stat-value">2</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📋</div>
              <div className="stat-info">
                <h3>Attendance Today</h3>
                <p className="stat-value">0</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <h3>Active Users</h3>
                <p className="stat-value">1</p>
              </div>
            </div>
          </div>

          <div className="welcome-section">
            <h2>🎯 Quick Actions</h2>
            <div className="actions-grid">
              <a href="/users" className="action-card">
                <span className="action-icon">➕</span>
                <span>Add New User</span>
              </a>
              <a href="/roles" className="action-card">
                <span className="action-icon">🔐</span>
                <span>Manage Roles</span>
              </a>
              <a href="/attendance" className="action-card">
                <span className="action-icon">📝</span>
                <span>Mark Attendance</span>
              </a>
              <a href="/reports" className="action-card">
                <span className="action-icon">📊</span>
                <span>View Reports</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
