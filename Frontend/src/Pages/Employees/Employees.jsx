import { useEffect, useState } from "react";
import { employeeAPI, departmentAPI } from "../../Config/Api";
import SideBar from "../../Components/SideBar/SideBar";
import "./Employees.css";

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedDept, setSelectedDept] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cnic: "",
    biometricId: "",
    department: "",
    position: "",
    salary: {
      monthlySalary: "",
      currency: "PKR",
      leaveThreshold: 0,
    },
    workSchedule: {
      checkInTime: "09:00",
      checkOutTime: "17:00",
      workingDaysPerWeek: 5,
      weeklyOffs: ["Saturday", "Sunday"],
      workingHoursPerWeek: 40,
    },
    joiningDate: "",
    password: "",
    isTeamLead: false,
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const fetchEmployees = async (deptId = "") => {
    try {
      setLoading(true);
      const response = await employeeAPI.getAll(deptId ? { department: deptId } : {});
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let response;
      if (editMode) {
        response = await employeeAPI.update(editId, formData);
      } else {
        response = await employeeAPI.create(formData);
      }
      
      if (response.data.success) {
        setShowModal(false);
        setEditMode(false);
        setEditId(null);
        setFormData({
          name: "",
          email: "",
          phone: "",
          cnic: "",
          biometricId: "",
          department: "",
          position: "",
          salary: { monthlySalary: "", currency: "PRK", leaveThreshold: 0 },
          workSchedule: {
            checkInTime: "09:00",
            checkOutTime: "17:00",
            workingDaysPerWeek: 5,
            weeklyOffs: ["Saturday", "Sunday"],
            workingHoursPerWeek: 40,
          },
          joiningDate: "",
          password: "",
          isTeamLead: false,
        });
        fetchEmployees(selectedDept);
      }
    } catch (error) {
      console.error("Error creating employee:", error);
      alert(error.response?.data?.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    try {
      await employeeAPI.delete(id);
      fetchEmployees(selectedDept);
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert(error.response?.data?.message || "Failed to delete employee");
    }
  };

  const handleEdit = (emp) => {
    setEditMode(true);
    setEditId(emp._id);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      cnic: emp.cnic || "",
      biometricId: emp.biometricId || "",
      department: emp.department?._id || "",
      position: emp.position,
      salary: {
        monthlySalary: emp.salary.monthlySalary,
        currency: emp.salary.currency,
        leaveThreshold: emp.salary.leaveThreshold || 0,
      },
      workSchedule: {
        checkInTime: emp.workSchedule.checkInTime,
        checkOutTime: emp.workSchedule.checkOutTime,
        workingDaysPerWeek: emp.workSchedule.workingDaysPerWeek,
        weeklyOffs: emp.workSchedule.weeklyOffs,
        workingHoursPerWeek: emp.workSchedule.workingHoursPerWeek,
      },
      joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : "",
      password: "",
      isTeamLead: emp.isTeamLead || false,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
    setEditId(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      cnic: "",
      biometricId: "",
      department: "",
      position: "",
      salary: { monthlySalary: "", currency: "PKR", leaveThreshold: 0 },
      workSchedule: {
        checkInTime: "09:00",
        checkOutTime: "17:00",
        workingDaysPerWeek: 5,
        weeklyOffs: ["Saturday", "Sunday"],
        workingHoursPerWeek: 40,
      },
      joiningDate: "",
    });
  };

  const handleWeeklyOffToggle = (day) => {
    const currentOffs = formData.workSchedule.weeklyOffs;
    const newOffs = currentOffs.includes(day)
      ? currentOffs.filter((d) => d !== day)
      : [...currentOffs, day];
    
    // Calculate working days and hours when weekly offs change
    const workingDays = 7 - newOffs.length;
    const weeklyHours = calculateWeeklyHours(
      formData.workSchedule.checkInTime,
      formData.workSchedule.checkOutTime,
      newOffs
    );
    
    setFormData({
      ...formData,
      workSchedule: { 
        ...formData.workSchedule, 
        weeklyOffs: newOffs,
        workingDaysPerWeek: workingDays,
        workingHoursPerWeek: weeklyHours,
      },
    });
  };

  const handleCNICChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    
    if (value.length > 13) {
      value = value.slice(0, 13); // Limit to 13 digits
    }
    
    // Format: XXXXX-XXXXXXX-X
    let formatted = '';
    if (value.length > 0) {
      formatted = value.slice(0, 5);
    }
    if (value.length > 5) {
      formatted += '-' + value.slice(5, 12);
    }
    if (value.length > 12) {
      formatted += '-' + value.slice(12, 13);
    }
    
    setFormData({ ...formData, cnic: formatted });
  };

  const calculateWeeklyHours = (checkIn, checkOut, weeklyOffs) => {
    if (!checkIn || !checkOut) return 0;
    
    // Calculate working days from weeklyOffs (7 days - number of offs)
    const workingDays = 7 - (weeklyOffs?.length || 0);
    
    const [inHour, inMinute] = checkIn.split(':').map(Number);
    const [outHour, outMinute] = checkOut.split(':').map(Number);
    
    const inMinutes = inHour * 60 + inMinute;
    const outMinutes = outHour * 60 + outMinute;
    
    const dailyMinutes = outMinutes - inMinutes;
    const dailyHours = dailyMinutes / 60;
    
    return dailyHours * workingDays;
  };

  const handleWorkScheduleChange = (field, value) => {
    const updatedSchedule = { ...formData.workSchedule, [field]: value };
    
    // Calculate working days from weeklyOffs
    const workingDays = 7 - (updatedSchedule.weeklyOffs?.length || 0);
    
    // Auto-calculate weekly hours
    const weeklyHours = calculateWeeklyHours(
      updatedSchedule.checkInTime,
      updatedSchedule.checkOutTime,
      updatedSchedule.weeklyOffs
    );
    
    setFormData({
      ...formData,
      workSchedule: {
        ...updatedSchedule,
        workingDaysPerWeek: workingDays,
        workingHoursPerWeek: weeklyHours,
      },
    });
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="employees-page">
          <div className="page-header">
        <h1>Employees</h1>
        <div className="header-actions">
          <select
            className="dept-filter"
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              fetchEmployees(e.target.value);
            }}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Add Employee
          </button>
        </div>
      </div>

      {loading && employees.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="employees-table">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Biometric ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>CNIC</th>
                <th>Department</th>
                <th>Position</th>
                <th>Role</th>
                <th>Salary</th>
                <th>Working Hours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp._id}>
                  <td className="emp-id">{emp.employeeId}</td>
                  <td className="bio-id">{emp.biometricId || "-"}</td>
                  <td>{emp.name}</td>
                  <td>{emp.email || "-"}</td>
                  <td>{emp.phone || "-"}</td>
                  <td>{emp.cnic || "-"}</td>
                  <td>
                    <span className="dept-badge">
                      {emp.department?.name || "-"}
                    </span>
                  </td>
                  <td>{emp.position}</td>
                  <td>
                    <span className={`role-badge ${emp.isTeamLead ? 'team-lead' : 'employee'}`}>
                      {emp.isTeamLead ? '⭐ Team Lead' : 'Employee'}
                    </span>
                  </td>
                  <td>
                    {emp.salary?.monthlySalary?.toLocaleString() || "0"}/{emp.salary?.currency || "PKR"}
                  </td>
                  <td>
                    {emp.workSchedule?.checkInTime || "0"} - {emp.workSchedule?.checkOutTime || "-"}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-edit-small"
                        onClick={() => handleEdit(emp)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-delete-small"
                        onClick={() => handleDelete(emp._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div
            className="modal-content modal-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{editMode ? "Edit Employee" : "Add Employee"}</h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
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
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={editMode}
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>CNIC</label>
                  <input
                    type="text"
                    value={formData.cnic}
                    onChange={handleCNICChange}
                    placeholder="XXXXX-XXXXXXX-X"
                    maxLength="15"
                    title="Format: XXXXX-XXXXXXX-X (e.g., 12345-1234567-1)"
                  />
                </div>
                <div className="form-group">
                  <label>Biometric ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.biometricId}
                    onChange={(e) =>
                      setFormData({ ...formData, biometricId: e.target.value })
                    }
                    placeholder="e.g., 1001"
                    maxLength="10"
                  />
                  <small>Numeric ID used in biometric device (if applicable)</small>
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    required
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Position *</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Salary</label>
                  <input
                    type="number"
                    value={formData.salary.monthlySalary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salary: { ...formData.salary, monthlySalary: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Leave Threshold (Allowed Leaves per Month)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.salary.leaveThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salary: { ...formData.salary, leaveThreshold: parseInt(e.target.value) || 0 },
                      })
                    }
                    placeholder="0 = all leaves deducted from salary"
                  />
                  <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px'}}>
                    Leaves exceeding this number will be marked as absent for salary calculation
                  </small>
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) =>
                      setFormData({ ...formData, joiningDate: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Employee Role *</label>
                  <select
                    value={formData.isTeamLead ? "teamLead" : "employee"}
                    onChange={(e) =>
                      setFormData({ ...formData, isTeamLead: e.target.value === "teamLead" })
                    }
                    required
                  >
                    <option value="employee">Employee (Can view/update own tasks)</option>
                    <option value="teamLead">Team Lead (Can manage tasks & assign work)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Password {!editMode && "(Optional)"}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={editMode ? "Leave blank to keep current" : "Auto: Emp@{last4digits}"}
                  />
                  <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px'}}>
                    {editMode 
                      ? "Leave empty to keep existing password" 
                      : "If empty, password will be auto-generated as: Emp@{last 4 digits of Employee ID}"}
                  </small>
                </div>
              </div>

              <h3 className="section-title">Work Schedule</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Check-in Time *</label>
                  <input
                    type="time"
                    value={formData.workSchedule.checkInTime}
                    onChange={(e) => handleWorkScheduleChange('checkInTime', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Check-out Time *</label>
                  <input
                    type="time"
                    value={formData.workSchedule.checkOutTime}
                    onChange={(e) => handleWorkScheduleChange('checkOutTime', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Working Days Per Week *</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={formData.workSchedule.workingDaysPerWeek}
                    onChange={(e) => handleWorkScheduleChange('workingDaysPerWeek', parseInt(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Working Hours Per Week (Auto-calculated)</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={formData.workSchedule.workingHoursPerWeek}
                    readOnly
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                  <small>Automatically calculated from check-in/out times and working days</small>
                </div>
              </div>

              <div className="form-group">
                <label>Weekly Offs *</label>
                <div className="weekdays-grid">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <label key={day} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.workSchedule.weeklyOffs.includes(day)}
                        onChange={() => handleWeeklyOffToggle(day)}
                      />
                      {day}
                    </label>
                  ))}
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
                  {loading ? (editMode ? "Updating..." : "Creating...") : (editMode ? "Update Employee" : "Create Employee")}
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

export default Employees;
