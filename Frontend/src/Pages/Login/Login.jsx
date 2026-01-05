import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setError("");
      setLoading(true);

      console.log("Attempting login with:", formData.email);
      const response = await authAPI.login(formData);
      console.log("Login response:", response.data);

      if (response.data.success) {
        // Store token and user data
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.data));

        toast.success("Login successful!");

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
        navigate(redirectPath);
      } else {
        // If response is not successful, treat as error
        hidsetError(response.data?.message || "Login failed. Please try again.");
        toast.error(
          response.data?.message || "Login failed. Please try again."
        );
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      console.error("Error response:", err.response);

      let errorMessage =
        err.response?.data?.message || "Login failed. Please try again.";

      // Check if this is a rate limit error and format the time remaining
      if (err.response?.data?.retryAfter) {
        const retryAfterSeconds = err.response.data.retryAfter;
        const minutes = Math.floor(retryAfterSeconds / 60);
        const seconds = retryAfterSeconds % 60;

        if (minutes > 0) {
          errorMessage = `Too many login attempts. Please try again after ${minutes} minute${
            minutes !== 1 ? "s" : ""
          }${
            seconds > 0
              ? ` and ${seconds} second${seconds !== 1 ? "s" : ""}`
              : ""
          }.`;
        } else {
          errorMessage = `Too many login attempts. Please try again after ${seconds} second${
            seconds !== 1 ? "s" : ""
          }.`;
        }
      }

      console.error("Error message:", errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-circle">
              <i className="fas fa-building"></i>
            </div>
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>

        <form
          onSubmit={(e) => {
            handleSubmit(e);
          }}
          className="login-form"
        >
          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">
              <i className="fas fa-user"></i>
              Email / Employee ID
            </label>
            <div className="input-wrapper">
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
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <i className="fas fa-lock"></i>
              Password
            </label>
            <div className="input-wrapper password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                <i
                  className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                ></i>
              </button>
            </div>
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <i className="fas fa-arrow-right"></i>
              </>
            )}
          </button>
        </form>

        {/* <div className="test-credentials">
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
        </div> */}
      </div>
    </div>
  );
}

export default Login;
