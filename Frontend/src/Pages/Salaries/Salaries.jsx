import { useEffect, useState } from "react";
import { salaryAPI, employeeAPI, departmentAPI, attendanceAPI } from "../../Config/Api";
import SideBar from "../../Components/SideBar/SideBar";
import "./Salaries.css";

const Salaries = () => {
  const [salaries, setSalaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({});
  const [displayData, setDisplayData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [calculationType, setCalculationType] = useState(''); // 'single' or 'all'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [formData, setFormData] = useState({
    employeeId: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [criteriaData, setCriteriaData] = useState({
    lateThreshold: 3,
    lateAsAbsent: true,
    perfectAttendanceBonus: 0,
    halfDayDeduction: 0.5,
    customDeductions: 0,
  });

  const user = JSON.parse(localStorage.getItem("user"));
  const isSuperAdmin = user?.role?.name === "superAdmin";

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchSalaries();
    fetchAttendanceForMonth();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    combineData();
  }, [employees, salaries, selectedDepartment, attendanceStats]);

  const fetchSalaries = async () => {
    try {
      setLoading(true);
      const response = await salaryAPI.getAll({
        month: selectedMonth,
        year: selectedYear,
      });
      if (response.data.success) {
        setSalaries(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching salaries:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ isActive: true });
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
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

  const fetchAttendanceForMonth = async () => {
    try {
      // Calculate month start and end dates
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Fetch all attendance for the month
      const response = await attendanceAPI.getAllAttendance({
        startDate: startDateStr,
        endDate: endDateStr,
      });

      if (response.data.success) {
        // Group attendance by employee
        const statsByEmployee = {};
        const attendanceRecords = response.data.data;

        attendanceRecords.forEach((record) => {
          const empId = record.employee?.employeeId || record.userId;
          if (!statsByEmployee[empId]) {
            statsByEmployee[empId] = {
              present: 0,
              absent: 0,
              halfDay: 0,
              late: 0,
              total: 0,
            };
          }

          statsByEmployee[empId].total++;
          
          if (record.status === 'present' || record.status === 'early-arrival') {
            statsByEmployee[empId].present++;
          } else if (record.status === 'absent') {
            statsByEmployee[empId].absent++;
          } else if (record.status === 'half-day') {
            statsByEmployee[empId].halfDay++;
          } else if (record.status === 'late' || record.status === 'late-early-arrival') {
            statsByEmployee[empId].late++;
            statsByEmployee[empId].present++; // Late is still present
          }
        });

        setAttendanceStats(statsByEmployee);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const getWorkingDaysInMonth = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    return daysInMonth;
  };

  const calculateWorkingDaysForEmployee = (employee) => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const workingDaysPerWeek = employee.workSchedule?.workingDaysPerWeek || 5;
    
    // Calculate approximately how many weeks in the month
    const weeksInMonth = daysInMonth / 7;
    const workingDays = Math.round(weeksInMonth * workingDaysPerWeek);
    
    return workingDays;
  };

  const combineData = () => {
    // Filter employees by department if selected
    let filteredEmployees = employees;
    if (selectedDepartment) {
      filteredEmployees = employees.filter(
        (emp) => emp.department._id === selectedDepartment
      );
    }

    // Combine employee data with salary data and attendance stats
    const combined = filteredEmployees.map((emp) => {
      const salary = salaries.find((s) => s.employeeId === emp.employeeId);
      const attendance = attendanceStats[emp.employeeId] || {
        present: 0,
        absent: 0,
        halfDay: 0,
        late: 0,
        total: 0,
      };
      
      return {
        employee: emp,
        salary: salary || null,
        attendance: attendance,
        workingDays: calculateWorkingDaysForEmployee(emp),
      };
    });

    setDisplayData(combined);
  };

  const handleCalculateSingle = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await salaryAPI.calculate({
        ...formData,
        criteria: criteriaData,
      });
      if (response.data.success) {
        alert("Salary calculated successfully!");
        setShowModal(false);
        setShowCriteriaModal(false);
        setFormData({
          employeeId: "",
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
        });
        fetchSalaries();
        fetchAttendanceForMonth();
      }
    } catch (error) {
      console.error("Error calculating salary:", error);
      alert(error.response?.data?.message || "Failed to calculate salary");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateAll = async () => {
    try {
      setLoading(true);
      const response = await salaryAPI.calculateAll({
        month: selectedMonth,
        year: selectedYear,
        criteria: criteriaData,
      });
      if (response.data.success) {
        alert(`Calculated: ${response.data.data.calculated}, Errors: ${response.data.data.errors}`);
        setShowCriteriaModal(false);
        fetchSalaries();
        fetchAttendanceForMonth();
      }
    } catch (error) {
      console.error("Error calculating salaries:", error);
      alert(error.response?.data?.message || "Failed to calculate salaries");
    } finally {
      setLoading(false);
    }
  };

  const openCriteriaModal = (type) => {
    setCalculationType(type);
    setShowCriteriaModal(true);
  };

  const handleCriteriaSubmit = (e) => {
    e.preventDefault();
    if (calculationType === 'single') {
      handleCalculateSingle(e);
    } else {
      handleCalculateAll();
    }
  };

  const handleApprove = async (id) => {
    if (!confirm("Approve this salary?")) return;
    try {
      await salaryAPI.approve(id);
      fetchSalaries();
    } catch (error) {
      console.error("Error approving salary:", error);
      alert(error.response?.data?.message || "Failed to approve salary");
    }
  };

  const handleMarkPaid = async (id) => {
    if (!confirm("Mark this salary as paid?")) return;
    try {
      await salaryAPI.markPaid(id);
      fetchSalaries();
    } catch (error) {
      console.error("Error marking salary as paid:", error);
      alert(error.response?.data?.message || "Failed to mark as paid");
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      pending: "#ff9800",
      calculated: "#2196f3",
      approved: "#4caf50",
      paid: "#8bc34a",
    };
    return (
      <span
        className="status-badge"
        style={{ background: statusColors[status] || "#999" }}
      >
        {status}
      </span>
    );
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="salaries-page">
          <div className="page-header">
        <h1>Salary Management</h1>
        <div className="header-actions">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="department-selector"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="month-selector"
          >
            {months.map((month, idx) => (
              <option key={idx} value={idx + 1}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="year-selector"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => openCriteriaModal('all')}>
            Calculate All
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Calculate Single
          </button>
        </div>
      </div>

      {loading && displayData.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="salaries-table">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Month/Year</th>
                <th>Base Salary</th>
                <th>Working Days</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Late</th>
                <th>Half Days</th>
                <th>Deductions</th>
                <th>Bonus</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((item) => (
                <tr key={item.employee._id}>
                  <td className="emp-id">{item.employee.employeeId}</td>
                  <td>{item.employee.name}</td>
                  <td>{item.employee.department?.name || "N/A"}</td>
                  <td>{`${months[selectedMonth - 1]} ${selectedYear}`}</td>
                  <td>
                    {item.salary
                      ? `PKR ${item.salary.baseSalary.toLocaleString()}`
                      : `PKR ${item.employee.salary?.monthlySalary?.toLocaleString() || 0}`}
                  </td>
                  <td>
                    {item.salary?.calculations?.totalWorkingDays || item.workingDays}
                  </td>
                  <td className="present-days">
                    {item.salary?.calculations?.presentDays ?? item.attendance.present}
                  </td>
                  <td className="absent-days">
                    {item.salary?.calculations?.absentDays ?? item.attendance.absent}
                  </td>
                  <td className="late-days">
                    {item.salary?.calculations?.lateDays ?? item.attendance.late}
                  </td>
                  <td>{item.salary?.calculations?.halfDays ?? item.attendance.halfDay}</td>
                  <td className="deduction">
                    {item.salary ? (
                      <div className="deduction-details">
                        <div className="total-deduction">
                          -PKR {item.salary.deductions.totalDeductions.toLocaleString()}
                        </div>
                        {(item.salary.deductions.absentDeduction > 0 ||
                          item.salary.deductions.lateDeduction > 0 ||
                          item.salary.deductions.otherDeductions > 0) && (
                          <small className="deduction-breakdown">
                            {item.salary.deductions.absentDeduction > 0 && (
                              <span>Absent: PKR {item.salary.deductions.absentDeduction.toLocaleString()}</span>
                            )}
                            {item.salary.deductions.lateDeduction > 0 && (
                              <span>Late: PKR {item.salary.deductions.lateDeduction.toLocaleString()}</span>
                            )}
                            {item.salary.deductions.otherDeductions > 0 && (
                              <span>Other: PKR {item.salary.deductions.otherDeductions.toLocaleString()}</span>
                            )}
                          </small>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="bonus-cell">
                    {item.salary?.additions?.bonus > 0
                      ? `+PKR ${item.salary.additions.bonus.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="net-salary">
                    {item.salary ? `PKR ${item.salary.netSalary.toLocaleString()}` : "-"}
                  </td>
                  <td>
                    {item.salary ? (
                      getStatusBadge(item.salary.status)
                    ) : (
                      <span className="status-badge" style={{ background: "#999" }}>
                        Not Calculated
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {!item.salary && (
                        <button
                          className="btn-calculate"
                          onClick={() => {
                            setFormData({
                              employeeId: item.employee.employeeId,
                              month: selectedMonth,
                              year: selectedYear,
                            });
                            openCriteriaModal('single');
                          }}
                        >
                          Calculate
                        </button>
                      )}
                      {isSuperAdmin && item.salary?.status === "calculated" && (
                        <button
                          className="btn-approve"
                          onClick={() => handleApprove(item.salary._id)}
                        >
                          Approve
                        </button>
                      )}
                      {isSuperAdmin && item.salary?.status === "approved" && (
                        <button
                          className="btn-paid"
                          onClick={() => handleMarkPaid(item.salary._id)}
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Calculate Salary</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCalculateSingle}>
              <div className="form-group">
                <label>Employee ID *</label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                  placeholder="e.g., HR0001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Month *</label>
                <select
                  value={formData.month}
                  onChange={(e) =>
                    setFormData({ ...formData, month: parseInt(e.target.value) })
                  }
                  required
                >
                  {months.map((month, idx) => (
                    <option key={idx} value={idx + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Year *</label>
                <select
                  value={formData.year}
                  onChange={(e) =>
                    setFormData({ ...formData, year: parseInt(e.target.value) })
                  }
                  required
                >
                  {[2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary"
                  onClick={() => {
                    setShowModal(false);
                    openCriteriaModal('single');
                  }}
                >
                  Next: Set Criteria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Calculation Criteria Modal */}
      {showCriteriaModal && (
        <div className="modal-overlay" onClick={() => setShowCriteriaModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Salary Calculation Criteria</h2>
              <button className="close-btn" onClick={() => setShowCriteriaModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCriteriaSubmit}>
              <div className="criteria-section">
                <h3>Late Penalty Rules</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={criteriaData.lateAsAbsent}
                        onChange={(e) =>
                          setCriteriaData({
                            ...criteriaData,
                            lateAsAbsent: e.target.checked,
                          })
                        }
                      />
                      {' '}Count late days as absent
                    </label>
                  </div>
                  {criteriaData.lateAsAbsent && (
                    <div className="form-group">
                      <label>How many lates = 1 absent?</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={criteriaData.lateThreshold}
                        onChange={(e) =>
                          setCriteriaData({
                            ...criteriaData,
                            lateThreshold: parseInt(e.target.value),
                          })
                        }
                      />
                      <small className="help-text">
                        Example: 3 lates = 1 absent day
                      </small>
                    </div>
                  )}
                </div>
              </div>

              <div className="criteria-section">
                <h3>Half Day Deduction</h3>
                <div className="form-group">
                  <label>Deduction per half day (in days)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={criteriaData.halfDayDeduction}
                    onChange={(e) =>
                      setCriteriaData({
                        ...criteriaData,
                        halfDayDeduction: parseFloat(e.target.value),
                      })
                    }
                  />
                  <small className="help-text">
                    Default: 0.5 (half day = 50% deduction)
                  </small>
                </div>
              </div>

              <div className="criteria-section">
                <h3>Perfect Attendance Bonus</h3>
                <div className="form-group">
                  <label>Bonus for 100% attendance (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={criteriaData.perfectAttendanceBonus}
                    onChange={(e) =>
                      setCriteriaData({
                        ...criteriaData,
                        perfectAttendanceBonus: parseFloat(e.target.value),
                      })
                    }
                    placeholder="e.g., 5000"
                  />
                  <small className="help-text">
                    Awarded to employees with 100% present days (no absents, no half-days)
                  </small>
                </div>
              </div>

              <div className="criteria-section">
                <h3>Additional Deductions</h3>
                <div className="form-group">
                  <label>Custom deductions (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={criteriaData.customDeductions}
                    onChange={(e) =>
                      setCriteriaData({
                        ...criteriaData,
                        customDeductions: parseFloat(e.target.value),
                      })
                    }
                    placeholder="e.g., 1000"
                  />
                  <small className="help-text">
                    Additional flat deductions (taxes, advances, etc.)
                  </small>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCriteriaModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Calculating..." : `Calculate ${calculationType === 'all' ? 'All' : 'Salary'}`}
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

export default Salaries;
