import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { roleAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Roles.css";

function Roles() {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: "",
  });

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
    setLoading(true);

    try {
      const permissions = formData.permissions
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p);

      const roleData = {
        name: formData.name,
        description: formData.description,
        permissions,
      };

      if (editMode) {
        await roleAPI.updateRole(editId, roleData);
        toast.success("Role updated successfully!");
      } else {
        await roleAPI.createRole(roleData);
        toast.success("Role created successfully!");
      }

      setFormData({
        name: "",
        description: "",
        permissions: "",
      });
      setEditMode(false);
      setEditId(null);
      fetchRoles();
      setTimeout(() => {
        setShowModal(false);
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${editMode ? 'update' : 'create'} role`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this role?")) {
      try {
        await roleAPI.deleteRole(id);
        toast.success("Role deleted successfully!");
        fetchRoles();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to delete role");
      }
    }
  };

  const handleEdit = (role) => {
    setEditMode(true);
    setEditId(role._id);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions ? role.permissions.join(", ") : "",
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
    setEditId(null);
    setFormData({
      name: "",
      description: "",
      permissions: "",
    });
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
              <i className="fas fa-plus"></i> Add New Role
            </button>
          </div>

          <div className="roles-grid">
            {roles.length === 0 ? (
              <p>No roles found</p>
            ) : (
              roles.map((role) => (
                <div key={role._id} className="role-card">
                  <div className="role-header">
                    <h3>{role.name}</h3>
                    <div className="role-actions">
                      <button
                        className="btn-edit-icon"
                        onClick={() => handleEdit(role)}
                        title="Edit role"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(role._id)}
                        title="Delete role"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
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
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className={editMode ? "fas fa-edit" : "fas fa-plus-circle"}></i>
                {editMode ? " Edit Role" : " Add New Role"}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-section-title">
                <i className="fas fa-info-circle"></i> Role Details
              </div>

              <div className="form-group">
                <label><i className="fas fa-tag"></i> Role Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Manager, HR, Team Lead"
                />
                <small className="helper-text">Use camelCase without spaces (e.g., teamLead, hrManager)</small>
              </div>

              <div className="form-group">
                <label><i className="fas fa-align-left"></i> Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Describe what this role can do..."
                />
                <small className="helper-text">Brief description of the role's responsibilities</small>
              </div>

              <div className="form-section-title">
                <i className="fas fa-key"></i> Access Control
              </div>

              <div className="form-group">
                <label><i className="fas fa-shield-alt"></i> Permissions</label>
                <input
                  type="text"
                  name="permissions"
                  value={formData.permissions}
                  onChange={handleChange}
                  placeholder="view_users, edit_users, delete_users"
                />
                <small className="helper-text info"><i className="fas fa-lightbulb"></i> Separate multiple permissions with commas</small>
              </div>

              <div className="permissions-preview">
                <label><i className="fas fa-eye"></i> Preview:</label>
                <div className="preview-tags">
                  {formData.permissions.split(',').filter(p => p.trim()).length > 0 ? (
                    formData.permissions.split(',').filter(p => p.trim()).map((perm, idx) => (
                      <span key={idx} className="permission-tag-preview">{perm.trim()}</span>
                    ))
                  ) : (
                    <span className="no-permissions-preview">No permissions added yet</span>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                >
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <i className={loading ? "fas fa-spinner fa-spin" : (editMode ? "fas fa-save" : "fas fa-plus")}></i>
                  {loading ? (editMode ? " Updating..." : " Creating...") : (editMode ? " Update Role" : " Create Role")}
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
