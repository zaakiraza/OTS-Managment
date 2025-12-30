import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../Config/Api";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("Attempting login with:", formData.email);
      const response = await authAPI.login(formData);
      console.log("Login response:", response.data);

      if (response.data.success) {
        // Store token and user data
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.data));

        // Navigate based on role
        const userRole = response.data.data?.role?.name;
        console.log("User role:", userRole); // Debug log
        const redirectMap = {
          superAdmin: "/dashboard",
          attendanceDepartment: "/attendance",
          ITAssetManager: "/assets",
          teamLead: "/tasks",
          employee: "/my-tasks",
        };

        const redirectPath = redirectMap[userRole] || "/dashboard";
        console.log("Redirecting to:", redirectPath); // Debug log
        navigate(redirectPath);
      }
    } catch (err) {
      console.error("Login error:", err);
      console.error("Error response:", err.response);
      const errorMessage =
        err.response?.data?.message || "Login failed. Please try again.";
      console.error("Error message:", errorMessage);
      setError(errorMessage);
      alert("Login Error: " + errorMessage); // Temporary alert to see error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email / Employee ID</label>
            <input
              type="text"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email or Employee ID"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          <p>Organization Management System</p>
        </div>

        <div className="test-credentials">
          <div className="credentials-header">
            <h3><i className="fas fa-key"></i> Test Credentials</h3>
            <p>Click any credential to auto-fill</p>
          </div>

          <div className="credentials-grid">
            <div
              className="credential-card admin"
              onClick={() =>
                setFormData({
                  email: "USR0001",
                  password: "12345678",
                })
              }
            >
              <div className="credential-badge">Super Admin</div>
              <div className="credential-info">
                <p className="credential-email">USR0001</p>
                <p className="credential-password">12345678</p>
              </div>
            </div>

            <div
              className="credential-card attendance"
              onClick={() =>
                setFormData({
                  email: "SCH0001",
                  password: "12345678",
                })
              }
            >
              <div className="credential-badge">Attendance Dept</div>
              <div className="credential-info">
                <p className="credential-email">SCH0001</p>
                <p className="credential-password">12345678</p>
              </div>
            </div>

            <div
              className="credential-card asset"
              onClick={() =>
                setFormData({
                  email: "IT0001",
                  password: "12345678",
                })
              }
            >
              <div className="credential-badge">IT Manager</div>
              <div className="credential-info">
                <p className="credential-email">IT0001</p>
                <p className="credential-password">12345678</p>
              </div>
            </div>

            <div
              className="credential-card attendance"
              onClick={() =>
                setFormData({
                  email: "WRK0001",
                  password: "12345678",
                })
              }
            >
              <div className="credential-badge">Team Lead1</div>
              <div className="credential-info">
                <p className="credential-email">WRK0001</p>
                <p className="credential-password">12345678</p>
              </div>
            </div>

            <div
              className="credential-card attendance"
              onClick={() =>
                setFormData({
                  email: "WEB0002",
                  password: "12345678",
                })
              }
            >
              <div className="credential-badge">Team lead 2</div>
              <div className="credential-info">
                <p className="credential-email">WEB0002</p>
                <p className="credential-password">12345678</p>
              </div>
            </div>

            <div
              className="credential-card attendance"
              onClick={() =>
                setFormData({
                  email: "EDT0001",
                  password: "12345678",
                })
              }
            >
              <div className="credential-badge">Employee 1</div>
              <div className="credential-info">
                <p className="credential-email">EDT0001</p>
                <p className="credential-password">12345678</p>
              </div>
            </div>

            <div
              className="credential-card attendance"
              onClick={() =>
                setFormData({
                  email: "WEB0001",
                  password: "12345678",
                })
              }
            >
              <div className="credential-badge">Employee 2</div>
              <div className="credential-info">
                <p className="credential-email">WEB0001</p>
                <p className="credential-password">12345678</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;