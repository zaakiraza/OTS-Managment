import { useState, useMemo } from "react";
import { authAPI } from "../../Config/Api";
import "./ChangePassword.css";

function ChangePassword({ show, onClose }) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Password validation rules
  const passwordValidation = useMemo(() => {
    const password = formData.newPassword;
    return {
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  }, [formData.newPassword]);

  const isPasswordValid = useMemo(() => {
    return Object.values(passwordValidation).every(Boolean);
  }, [passwordValidation]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!isPasswordValid) {
      setError("Password does not meet all requirements");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError("New password must be different from current password");
      return;
    }

    try {
      setLoading(true);
      const response = await authAPI.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });

      if (response.data.success) {
        setSuccess("Password changed successfully!");
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      // Handle validation errors from server
      if (err.response?.data?.errors) {
        const errorMessages = err.response.data.errors.map(e => e.message).join(", ");
        setError(errorMessages);
      } else {
        setError(err.response?.data?.message || "Failed to change password");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="change-password-overlay" onClick={onClose}>
      <div className="change-password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Change Password</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="change-password-form">
          {error && <div className="alert-error">{error}</div>}
          {success && <div className="alert-success">{success}</div>}

          <div className="form-group">
            <label htmlFor="currentPassword">Current Password *</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password *</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {/* Password Requirements Checklist */}
            <div className="password-requirements">
              <p className="requirements-title">Password Requirements:</p>
              <ul className="requirements-list">
                <li className={passwordValidation.minLength ? "valid" : "invalid"}>
                  {passwordValidation.minLength ? "✓" : "○"} At least 8 characters
                </li>
                <li className={passwordValidation.hasLowercase ? "valid" : "invalid"}>
                  {passwordValidation.hasLowercase ? "✓" : "○"} One lowercase letter
                </li>
                <li className={passwordValidation.hasUppercase ? "valid" : "invalid"}>
                  {passwordValidation.hasUppercase ? "✓" : "○"} One uppercase letter
                </li>
                <li className={passwordValidation.hasNumber ? "valid" : "invalid"}>
                  {passwordValidation.hasNumber ? "✓" : "○"} One number
                </li>
                <li className={passwordValidation.hasSpecial ? "valid" : "invalid"}>
                  {passwordValidation.hasSpecial ? "✓" : "○"} One special character (!@#$%^&*...)
                </li>
              </ul>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePassword;
