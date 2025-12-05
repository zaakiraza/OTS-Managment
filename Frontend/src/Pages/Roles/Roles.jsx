import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { roleAPI } from "../../Config/Api";
import "./Roles.css";

function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await roleAPI.getAllRoles();
      setRoles(response.data.data || []);
    } catch (err) {
      console.error("Error fetching roles:", err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const permissions = formData.permissions
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p);

      await roleAPI.createRole({
        name: formData.name,
        description: formData.description,
        permissions,
      });

      setSuccess("Role created successfully!");
      setFormData({
        name: "",
        description: "",
        permissions: "",
      });
      fetchRoles();
      setTimeout(() => {
        setShowModal(false);
        setSuccess("");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create role");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this role?")) {
      try {
        await roleAPI.deleteRole(id);
        setSuccess("Role deleted successfully!");
        fetchRoles();
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to delete role");
        setTimeout(() => setError(""), 3000);
      }
    }
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>Roles Management</h1>
              <p>Manage system roles and permissions</p>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              ➕ Add New Role
            </button>
          </div>

          {success && <div className="alert alert-success">{success}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          <div className="roles-grid">
            {roles.length === 0 ? (
              <p>No roles found</p>
            ) : (
              roles.map((role) => (
                <div key={role._id} className="role-card">
                  <div className="role-header">
                    <h3>{role.name}</h3>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(role._id)}
                    >
                      🗑️
                    </button>
                  </div>
                  <p className="role-description">{role.description}</p>
                  <div className="permissions-list">
                    <strong>Permissions:</strong>
                    <div className="permissions-tags">
                      {role.permissions && role.permissions.length > 0 ? (
                        role.permissions.map((perm, index) => (
                          <span key={index} className="permission-tag">
                            {perm}
                          </span>
                        ))
                      ) : (
                        <span className="no-permissions">No permissions</span>
                      )}
                    </div>
                  </div>
                  <div className="role-status">
                    <span
                      className={`status ${
                        role.isActive ? "active" : "inactive"
                      }`}
                    >
                      {role.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Role</h2>
              <button
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label>Role Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Manager, HR, etc."
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Enter role description"
                />
              </div>

              <div className="form-group">
                <label>Permissions (comma-separated)</label>
                <input
                  type="text"
                  name="permissions"
                  value={formData.permissions}
                  onChange={handleChange}
                  placeholder="e.g., view_users, edit_users, delete_users"
                />
                <small>Separate multiple permissions with commas</small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Creating..." : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Roles;
