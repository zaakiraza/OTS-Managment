import { useEffect, useState } from "react";
import { departmentAPI, employeeAPI } from "../../Config/Api";
import SideBar from "../../Components/SideBar/SideBar";
import "./Departments.css";

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    head: "",
    teamLead: "",
    leverageTime: {
      checkInMinutes: 15,
      checkOutMinutes: 10,
    },
  });

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Remove empty head field if not provided
      const submitData = { ...formData };
      if (!submitData.head || submitData.head === "") {
        delete submitData.head;
      }
      if (!submitData.teamLead || submitData.teamLead === "") {
        delete submitData.teamLead;
      }
      
      let response;
      if (editMode) {
        response = await departmentAPI.update(editId, submitData);
      } else {
        response = await departmentAPI.create(submitData);
      }
      
      if (response.data.success) {
        setShowModal(false);
        setEditMode(false);
        setEditId(null);
        setFormData({ 
          name: "", 
          code: "", 
          description: "", 
          head: "",
          teamLead: "",
          leverageTime: {
            checkInMinutes: 15,
            checkOutMinutes: 10,
          },
        });
        fetchDepartments();
      }
    } catch (error) {
      console.error("Error creating department:", error);
      alert(error.response?.data?.message || "Failed to create department");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      await departmentAPI.delete(id);
      fetchDepartments();
    } catch (error) {
      console.error("Error deleting department:", error);
      alert(error.response?.data?.message || "Failed to delete department");
    }
  };

  const handleEdit = (dept) => {
    setEditMode(true);
    setEditId(dept._id);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
      head: dept.head?._id || "",
      teamLead: dept.teamLead?._id || "",
      leverageTime: {
        checkInMinutes: dept.leverageTime?.checkInMinutes || 15,
        checkOutMinutes: dept.leverageTime?.checkOutMinutes || 10,
      },
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
    setEditId(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      head: "",
      teamLead: "",
      leverageTime: {
        checkInMinutes: 15,
        checkOutMinutes: 10,
      },
    });
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="departments-page">
          <div className="page-header">
        <h1>Departments</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Department
        </button>
      </div>

      {loading && departments.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="departments-grid">
          {departments.map((dept) => (
            <div key={dept._id} className="department-card">
              <div className="dept-header">
                <h3>{dept.name}</h3>
                <span className="dept-code">{dept.code}</span>
              </div>
              <p className="dept-description">{dept.description || "No description"}</p>
              <div className="dept-info">
                <span className="leverage-info">
                  ⏰ Grace: Check-in {dept.leverageTime?.checkInMinutes || 15}min | Check-out {dept.leverageTime?.checkOutMinutes || 10}min
                </span>
              </div>
              <div className="dept-team-info">
                <span className="info-item">👤 Head: {dept.head?.name || "Not assigned"}</span>
                <span className="info-item">⭐ Team Lead: {dept.teamLead?.name || "Not assigned"}</span>
              </div>
              <div className="dept-footer">
                <div className="dept-actions">
                  <button
                    className="btn-edit"
                    onClick={() => handleEdit(dept)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(dept._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? "Edit Department" : "Add Department"}</h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Department Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Department Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., HR, IT, FIN"
                  required
                  maxLength={5}
                  disabled={editMode}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              
              <h3 className="section-title">Team Lead Assignment</h3>
              <div className="form-group">
                <label>Team Lead (Employee)</label>
                <select
                  value={formData.teamLead}
                  onChange={(e) =>
                    setFormData({ ...formData, teamLead: e.target.value })
                  }
                >
                  <option value="">Select Team Lead</option>
                  {editMode ? (
                    employees
                      .filter(emp => {
                        const dept = departments.find(d => d._id === editId);
                        return emp.department?._id === dept?._id;
                      })
                      .map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} ({emp.employeeId}) - {emp.position}
                        </option>
                      ))
                  ) : (
                    <option value="" disabled>Create department first, then edit to assign team lead</option>
                  )}
                </select>
                <small>
                  {editMode 
                    ? "Select an employee from this department to be the team lead" 
                    : "You can assign a team lead after creating the department"}
                </small>
              </div>
              
              <h3 className="section-title">Attendance Leverage Time (Grace Period)</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Check-in Grace (minutes) *</label>
                  <input
                    type="number"
                    value={formData.leverageTime.checkInMinutes}
                    onChange={(e) =>
                      setFormData({ 
                        ...formData, 
                        leverageTime: { 
                          ...formData.leverageTime, 
                          checkInMinutes: parseInt(e.target.value) || 0 
                        } 
                      })
                    }
                    min="0"
                    required
                  />
                  <small>Minutes allowed after scheduled check-in time</small>
                </div>
                <div className="form-group">
                  <label>Check-out Grace (minutes) *</label>
                  <input
                    type="number"
                    value={formData.leverageTime.checkOutMinutes}
                    onChange={(e) =>
                      setFormData({ 
                        ...formData, 
                        leverageTime: { 
                          ...formData.leverageTime, 
                          checkOutMinutes: parseInt(e.target.value) || 0 
                        } 
                      })
                    }
                    min="0"
                    required
                  />
                  <small>Minutes allowed before scheduled check-out time</small>
                </div>
              </div>
              
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (editMode ? "Updating..." : "Creating...") : (editMode ? "Update Department" : "Create Department")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default Departments;
