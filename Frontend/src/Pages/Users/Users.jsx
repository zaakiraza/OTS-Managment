import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { userAPI, roleAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Users.css";

// Admin roles that can be assigned through this page
const ADMIN_ROLES = ["superAdmin", "attendanceDepartment", "ITAssetManager"];

function Users() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [adminRoles, setAdminRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "",
  });
  const [editData, setEditData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userAPI.getAllUsers();
      setUsers(response.data.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await roleAPI.getAllRoles();
      const allRoles = response.data.data || [];
      setRoles(allRoles);
      // Filter to only show admin roles in this page
      setAdminRoles(allRoles.filter(role => ADMIN_ROLES.includes(role.name)));
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
      await userAPI.createUser(formData);
      toast.success("User created successfully!");
      setFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "",
      });
      fetchUsers();
      setTimeout(() => {
        setShowModal(false);
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await userAPI.deleteUser(id);
        toast.success("User deleted successfully!");
        fetchUsers();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to delete user");
      }
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setEditData({
      email: user.email,
      password: "",
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = { email: editData.email };
      if (editData.password) {
        updateData.password = editData.password;
      }

      await userAPI.updateUser(selectedUser._id, updateData);
      toast.success("User updated successfully!");
      setEditData({ email: "", password: "" });
      setSelectedUser(null);
      fetchUsers();
      setTimeout(() => {
        setShowEditModal(false);
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1><i className="fas fa-user-shield"></i> Admin Users</h1>
              <p>Manage system administrators and department managers</p>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <i className="fas fa-plus"></i> Add Admin User
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Admin Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>
                      No admin users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user._id}>
                      <td>{user.employeeId || user.userId}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone}</td>
                      <td>
                        <span className="badge">{user.role?.name}</span>
                      </td>
                      <td>
                        <span
                          className={`status ${
                            user.isActive ? "active" : "inactive"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-edit"
                          onClick={() => handleEdit(user)}
                          title="Edit Email/Password"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(user._id)}
                          title="Delete"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-user-plus"></i> Add Admin User</h2>
              <button
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-section-title">
                <i className="fas fa-user-tag"></i> Role Selection
              </div>

              <div className="form-group">
                <label><i className="fas fa-user-shield"></i> Admin Role <span className="required">*</span></label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Admin Role</option>
                  {adminRoles.map((role) => (
                    <option key={role._id} value={role._id}>
                      {role.name === "superAdmin" ? "🛡️ Super Admin" : 
                       role.name === "attendanceDepartment" ? "📋 Attendance Department" :
                       role.name === "ITAssetManager" ? "💻 IT Asset Manager" : role.name}
                    </option>
                  ))}
                </select>
                <small className="helper-text info"><i className="fas fa-magic"></i> Employee ID will be auto-generated based on role</small>
              </div>

              <div className="form-section-title">
                <i className="fas fa-id-card"></i> Personal Information
              </div>

              <div className="form-group">
                <label><i className="fas fa-user"></i> Full Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter full name"
                />
              </div>

              <div className="form-group">
                <label><i className="fas fa-envelope"></i> Email <span className="required">*</span></label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="Enter email address"
                />
                <small className="helper-text">Used for login and notifications</small>
              </div>

              <div className="form-group">
                <label><i className="fas fa-phone"></i> Phone <span className="required">*</span></label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="Enter phone number"
                />
              </div>

              <div className="form-section-title">
                <i className="fas fa-shield-alt"></i> Security
              </div>

              <div className="form-group">
                <label><i className="fas fa-key"></i> Password <span className="required">*</span></label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength="6"
                  placeholder="Enter password (min 6 characters)"
                />
                <small className="helper-text warning"><i className="fas fa-info-circle"></i> Password must be at least 6 characters</small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-user-plus"}></i>
                  {loading ? " Creating..." : " Create Admin User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-user-edit"></i> Edit Admin User</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="modal-body">
              <div className="form-section-title">
                <i className="fas fa-id-card"></i> User Information
              </div>

              <div className="form-group">
                <label><i className="fas fa-user"></i> Name</label>
                <input
                  type="text"
                  value={selectedUser.name}
                  disabled
                />
                <small className="helper-text info"><i className="fas fa-lock"></i> Name cannot be changed from here</small>
              </div>

              <div className="form-group">
                <label><i className="fas fa-id-badge"></i> Employee ID</label>
                <input
                  type="text"
                  value={selectedUser.employeeId || selectedUser.userId}
                  disabled
                />
                <small className="helper-text info"><i className="fas fa-lock"></i> System-generated ID cannot be modified</small>
              </div>

              <div className="form-section-title">
                <i className="fas fa-shield-alt"></i> Credentials
              </div>

              <div className="form-group">
                <label><i className="fas fa-envelope"></i> Email <span className="required">*</span></label>
                <input
                  type="email"
                  name="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  required
                  placeholder="Enter email address"
                />
                <small className="helper-text">Used for login and notifications</small>
              </div>

              <div className="form-group">
                <label><i className="fas fa-key"></i> New Password</label>
                <input
                  type="password"
                  name="password"
                  value={editData.password}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  minLength="6"
                  placeholder="Leave blank to keep current password"
                />
                <small className="helper-text warning"><i className="fas fa-info-circle"></i> Only fill if you want to change the password (min 6 characters)</small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-save"}></i>
                  {loading ? " Updating..." : " Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
