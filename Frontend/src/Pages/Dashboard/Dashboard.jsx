import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import api from "../../Config/Api";
import "./Dashboard.css";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRoles: 0,
    attendanceToday: 0,
    activeUsers: 0,
    loading: true,
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch all stats in parallel
      const [usersRes, rolesRes, attendanceRes] = await Promise.all([
        api.get("/users"),
        api.get("/roles"),
        api.get(`/attendance?date=${today}`),
      ]);

      const users = usersRes.data.data || [];
      const activeUsersCount = users.filter(u => u.isActive).length;

      setStats({
        totalUsers: users.length,
        totalRoles: rolesRes.data.data?.length || 0,
        attendanceToday: attendanceRes.data.data?.length || 0,
        activeUsers: activeUsersCount,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

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
                <p className="stat-value">
                  {stats.loading ? "..." : stats.totalUsers}
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🔑</div>
              <div className="stat-info">
                <h3>Total Roles</h3>
                <p className="stat-value">
                  {stats.loading ? "..." : stats.totalRoles}
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📋</div>
              <div className="stat-info">
                <h3>Attendance Today</h3>
                <p className="stat-value">
                  {stats.loading ? "..." : stats.attendanceToday}
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <h3>Active Users</h3>
                <p className="stat-value">
                  {stats.loading ? "..." : stats.activeUsers}
                </p>
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
