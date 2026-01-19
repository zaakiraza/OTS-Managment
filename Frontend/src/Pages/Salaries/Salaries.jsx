import { useEffect, useState } from "react";
import { salaryAPI, employeeAPI, departmentAPI, attendanceAPI, exportAPI } from "../../Config/Api";
import SideBar from "../../Components/SideBar/SideBar";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Salaries.css";

const Salaries = () => {
  const toast = useToast();
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
    attendanceMarkingMethod: 'checkinCheckout',
    hourlyDeductionRate: 0,
    lateThreshold: 3,
    halfDayThreshold: 0,
    earlyDepartureThreshold: 0,
    lateEarlyDepartureThreshold: 0,
    includeExtraWorkingHours: false,
    includeWeeklyOffDaysWorked: false,
    perfectAttendanceBonusEnabled: false,
    perfectAttendanceThreshold: 100,
    perfectAttendanceBonusAmount: 0,
  });
  const [exporting, setExporting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAllData, setPreviewAllData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch { return {}; }
  })();
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
        // Use flatData to get all departments including sub-departments
        setDepartments(response.data.flatData || response.data.data);
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
          if (!empId) {
            return;
          }
          
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
          
          if (record.status === 'present' || record.status === 'early-departure') {
            statsByEmployee[empId].present++;
          } else if (record.status === 'absent') {
            statsByEmployee[empId].absent++;
          } else if (record.status === 'half-day') {
            statsByEmployee[empId].halfDay++;
          } else if (record.status === 'late' || record.status === 'late-early-departure') {
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
    const year = selectedYear;
    const month = selectedMonth;
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Get employee's weekly offs (default to Saturday and Sunday)
    const weeklyOffs = employee.workSchedule?.weeklyOffs || ["Saturday", "Sunday"];
    
    // Day name to number mapping (0 = Sunday, 6 = Saturday)
    const dayNameToNumber = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6
    };
    
    // Convert weekly offs to day numbers
    const offDayNumbers = weeklyOffs.map(day => dayNameToNumber[day]);
    
    // Count actual working days in the month
    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      
      // If this day is NOT a weekly off, count it as a working day
      if (!offDayNumbers.includes(dayOfWeek)) {
        workingDays++;
      }
    }
    
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

  const handleCalculateSingle = async (employeeId) => {
    try {
      setLoading(true);
      const response = await salaryAPI.calculate({
        employeeId,
        month: selectedMonth,
        year: selectedYear,
        criteria: criteriaData,
      });
      if (response.data.success) {
        toast.success("Salary calculated successfully!");
        setShowCriteriaModal(false);
        fetchSalaries();
        fetchAttendanceForMonth();
      }
    } catch (error) {
      console.error("Error calculating salary:", error);
      toast.error(error.response?.data?.message || "Failed to calculate salary");
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
        departmentId: selectedDepartment || undefined,
        criteria: criteriaData,
      });
      if (response.data.success) {
        const { calculated, errors, errorDetails } = response.data.data;
        
        let message = `Calculated! ${calculated} salaries saved successfully.`;
        
        if (errors > 0 && errorDetails && errorDetails.length > 0) {
          const errorList = errorDetails.map((err, idx) => `${idx + 1}. ${err.employeeId}: ${err.message}`).join(', ');
          toast.warning(`${message} ${errors} employees could not be calculated: ${errorList}`);
        } else {
          toast.success(message);
        }
        
        setShowCriteriaModal(false);
        fetchSalaries();
        fetchAttendanceForMonth();
      }
    } catch (error) {
      console.error("Error calculating salaries:", error);
      toast.error(error.response?.data?.message || "Failed to calculate salaries");
    } finally {
      setLoading(false);
    }
  };

  const openCriteriaModal = (type, employeeId = null) => {
    setCalculationType(type);
    if (employeeId) {
      setFormData({
        employeeId,
        month: selectedMonth,
        year: selectedYear,
      });
    }
    setShowCriteriaModal(true);
    setPreviewData(null);
    setPreviewAllData(null);
    setShowPreview(false);
  };

  const fetchPreview = async () => {
    if (calculationType === 'single' && !formData.employeeId) {
      toast.warning("Please select an employee first");
      return;
    }

    try {
      setPreviewLoading(true);
      if (calculationType === 'single') {
        const response = await salaryAPI.preview({
          employeeId: formData.employeeId,
          month: selectedMonth,
          year: selectedYear,
          criteria: criteriaData,
        });
        if (response.data.success) {
          setPreviewData(response.data.data);
          setShowPreview(true);
        }
      } else {
        const response = await salaryAPI.previewAll({
          month: selectedMonth,
          year: selectedYear,
          departmentId: selectedDepartment || undefined,
          criteria: criteriaData,
        });
        if (response.data.success) {
          setPreviewAllData(response.data.data);
          setShowPreview(true);
        }
      }
    } catch (error) {
      console.error("Error fetching preview:", error);
      toast.error(error.response?.data?.message || "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCriteriaSubmit = (e) => {
    e.preventDefault();
    if (calculationType === 'single') {
      handleCalculateSingle(formData.employeeId);
    } else {
      handleCalculateAll();
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

  const handleExport = async (format) => {
    try {
      setExporting(true);
      
      const params = {
        month: selectedMonth,
        year: selectedYear,
      };
      if (selectedDepartment) params.departmentId = selectedDepartment;
      
      const response = await exportAPI.exportSalaries(format, params);
      
      const blob = new Blob([response.data], {
        type: format === 'xlsx' 
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv"
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `salaries_${months[selectedMonth - 1]}_${selectedYear}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.response?.data?.message || "Failed to export salaries");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="salaries-page">
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-money-bill-wave"></i>
              </div>
              <div>
                <h1>Salary Management</h1>
                <p>Calculate and manage employee salaries</p>
              </div>
            </div>
        <div className="header-actions">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="department-selector"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {"—".repeat(dept.level || 0)} {dept.name} ({dept.code})
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
          <button className="btn-primary" onClick={() => openCriteriaModal('all')} disabled={loading}>
            <i className="fas fa-calculator"></i> Calculate All
          </button>
          <button 
            className="btn-export excel" 
            onClick={() => handleExport('xlsx')} 
            disabled={exporting || displayData.length === 0}
          >
            {exporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-excel"></i>} Export Excel
          </button>
          <button 
            className="btn-export csv" 
            onClick={() => handleExport('csv')} 
            disabled={exporting || displayData.length === 0}
          >
            {exporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-csv"></i>} Export CSV
          </button>
        </div>
      </div>

      {loading && displayData.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : displayData.length === 0 ? (
        <div className="no-data">
          <p>No employees found in this department.</p>
          <small>Try selecting a different department or add employees to this department.</small>
        </div>
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
                          onClick={() => openCriteriaModal('single', item.employee.employeeId)}
                          disabled={loading}
                        >
                          Calculate
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
              <h2>
                <i className="fas fa-calculator"></i> Salary Calculation Criteria
              </h2>
              <button className="close-btn" onClick={() => setShowCriteriaModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleCriteriaSubmit} className="modal-body">
              <div className="form-section-title">
                <i className="fas fa-clipboard-check"></i> Attendance Marking Method
              </div>
              <div className="form-group">
                <label><i className="fas fa-cog"></i> How should attendance be marked?</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="attendanceMethod"
                      value="checkinCheckout"
                      checked={criteriaData.attendanceMarkingMethod === 'checkinCheckout'}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          attendanceMarkingMethod: e.target.value,
                        })
                      }
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">
                      <i className="fas fa-clock"></i> Mark by check-in/check-out timings each day
                    </span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="attendanceMethod"
                      value="weeklyHours"
                      checked={criteriaData.attendanceMarkingMethod === 'weeklyHours'}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          attendanceMarkingMethod: e.target.value,
                        })
                      }
                    />
                    <span className="radio-custom"></span>
                    <span className="radio-label">
                      <i className="fas fa-calendar-week"></i> Mark by weekly hours
                    </span>
                  </label>
                </div>
              </div>

              {criteriaData.attendanceMarkingMethod === 'weeklyHours' && (
                <>
                  <div className="form-section-title">
                    <i className="fas fa-hourglass-half"></i> Hourly Deduction
                  </div>
                  <div className="form-group">
                    <label><i className="fas fa-rupee-sign"></i> Deduction per missing hour (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={criteriaData.hourlyDeductionRate}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          hourlyDeductionRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="e.g., 50"
                      required
                    />
                    <small className="helper-text info">
                      <i className="fas fa-info-circle"></i> Amount to deduct for each hour short of required weekly hours
                    </small>
                  </div>
                </>
              )}

              {criteriaData.attendanceMarkingMethod === 'checkinCheckout' && (
                <>
                  <div className="form-section-title">
                    <i className="fas fa-exclamation-triangle"></i> Late Penalty Rules
                  </div>
                  <div className="form-group">
                    <label><i className="fas fa-clock"></i> How many lates = 1 absent?</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={criteriaData.lateThreshold}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          lateThreshold: parseInt(e.target.value) || 1,
                        })
                      }
                      required
                    />
                    <small className="helper-text info">
                      <i className="fas fa-lightbulb"></i> Example: 3 lates = 1 absent day deduction
                    </small>
                  </div>

                  <div className="form-group">
                    <label><i className="fas fa-clock-half"></i> How many half-days = 1 absent?</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={criteriaData.halfDayThreshold}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          halfDayThreshold: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <small className="helper-text info">
                      <i className="fas fa-lightbulb"></i> Example: 2 half-days = 1 absent day deduction (0 = disabled)
                    </small>
                  </div>

                  <div className="form-group">
                    <label><i className="fas fa-door-open"></i> How many early-departures = 1 absent?</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={criteriaData.earlyDepartureThreshold}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          earlyDepartureThreshold: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <small className="helper-text info">
                      <i className="fas fa-lightbulb"></i> Example: 4 early-departures = 1 absent day deduction (0 = disabled)
                    </small>
                  </div>

                  <div className="form-group">
                    <label><i className="fas fa-exclamation-circle"></i> How many late-early-departures = 1 absent?</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={criteriaData.lateEarlyDepartureThreshold}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          lateEarlyDepartureThreshold: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <small className="helper-text info">
                      <i className="fas fa-lightbulb"></i> Example: 2 late-early-departures = 1 absent day deduction (0 = disabled)
                    </small>
                  </div>


                  <div className="form-section-title">
                    <i className="fas fa-user-times"></i> Absent Deduction
                  </div>
                  <div className="form-group">
                    <div style={{ 
                      padding: '12px', 
                      backgroundColor: '#e7f3ff', 
                      borderRadius: '5px',
                      border: '1px solid #b3d9ff'
                    }}>
                      <i className="fas fa-info-circle" style={{ color: '#2196f3', marginRight: '8px' }}></i>
                      <strong>Auto-calculated:</strong> Deduction per absent day will be automatically calculated as:
                      <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
                        <strong>Base Salary ÷ Total Working Days</strong> (rounded down)
                      </div>
                      <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                        Example: PKR 50,000 ÷ 23 days = PKR 2,173 per absent day
                      </div>
                    </div>
                  </div>

                  <div className="form-section-title">
                    <i className="fas fa-clock"></i> Extra Work Compensation
                  </div>
                  <div className="form-group">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={criteriaData.includeExtraWorkingHours}
                        onChange={(e) =>
                          setCriteriaData({
                            ...criteriaData,
                            includeExtraWorkingHours: e.target.checked,
                          })
                        }
                      />
                      <span className="checkbox-custom"></span>
                      <span className="checkbox-label">
                        <i className="fas fa-hourglass-half"></i> Include extra working hours in salary calculation
                      </span>
                    </label>
                    <small className="helper-text info">
                      <i className="fas fa-lightbulb"></i> If enabled, extra hours worked beyond scheduled daily hours will be paid at per-hour rate
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={criteriaData.includeWeeklyOffDaysWorked}
                        onChange={(e) =>
                          setCriteriaData({
                            ...criteriaData,
                            includeWeeklyOffDaysWorked: e.target.checked,
                          })
                        }
                      />
                      <span className="checkbox-custom"></span>
                      <span className="checkbox-label">
                        <i className="fas fa-calendar-check"></i> Include weekly off days worked in salary calculation
                      </span>
                    </label>
                    <small className="helper-text info">
                      <i className="fas fa-lightbulb"></i> If enabled, days worked on weekly offs will be paid at per-day rate
                    </small>
                  </div>
                </>
              )}

              <div className="form-section-title">
                <i className="fas fa-trophy"></i> Perfect Attendance Bonus
              </div>
              <div className="form-group">
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={criteriaData.perfectAttendanceBonusEnabled}
                    onChange={(e) =>
                      setCriteriaData({
                        ...criteriaData,
                        perfectAttendanceBonusEnabled: e.target.checked,
                      })
                    }
                  />
                  <span className="checkbox-custom"></span>
                  <span className="checkbox-label">
                    <i className="fas fa-star"></i> Enable perfect attendance bonus
                  </span>
                </label>
              </div>
              {criteriaData.perfectAttendanceBonusEnabled && (
                <div className="bonus-settings">
                  <div className="form-group">
                    <label><i className="fas fa-percentage"></i> Minimum attendance for bonus (%)</label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      step="1"
                      value={criteriaData.perfectAttendanceThreshold}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          perfectAttendanceThreshold: parseFloat(e.target.value) || 100,
                        })
                      }
                      required
                    />
                    <small className="helper-text info">
                      <i className="fas fa-lightbulb"></i> Employee must achieve this percentage to receive bonus
                    </small>
                  </div>
                  <div className="form-group">
                    <label><i className="fas fa-rupee-sign"></i> Bonus amount (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={criteriaData.perfectAttendanceBonusAmount}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          perfectAttendanceBonusAmount: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="e.g., 5000"
                      required
                    />
                    <small className="helper-text info">
                      <i className="fas fa-info-circle"></i> Bonus awarded when attendance threshold is met
                    </small>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCriteriaModal(false)}
                >
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button
                  type="button"
                  className="btn-preview"
                  onClick={fetchPreview}
                  disabled={previewLoading || (calculationType === 'single' && !formData.employeeId)}
                  style={{ marginRight: '10px', backgroundColor: '#17a2b8', color: 'white' }}
                >
                  <i className={previewLoading ? "fas fa-spinner fa-spin" : "fas fa-eye"}></i>
                  {previewLoading ? " Loading..." : " Preview Calculation"}
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-calculator"}></i>
                  {loading ? " Calculating..." : calculationType === 'single' ? " Calculate Salary" : " Calculate All Salaries"}
                </button>
              </div>
            </form>

            {/* Preview Section */}
            {showPreview && (
              <div className="preview-section" style={{ 
                marginTop: '20px', 
                padding: '20px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#495057' }}>
                  <i className="fas fa-calculator"></i> Calculation Preview
                </h3>
                
                {calculationType === 'single' && previewData && (
                  <div className="preview-single">
                    <div style={{ marginBottom: '15px' }}>
                      <strong>Employee:</strong> {previewData.employee.name} ({previewData.employee.employeeId})<br/>
                      <strong>Department:</strong> {previewData.employee.department}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '5px' }}>
                        <h4 style={{ marginTop: 0, fontSize: '14px', color: '#6c757d' }}>Base Information</h4>
                        <div style={{ fontSize: '13px' }}>
                          <div><strong>Base Salary:</strong> PKR {previewData.baseSalary.toLocaleString()}</div>
                          <div><strong>Working Days:</strong> {previewData.calculations.totalWorkingDays}</div>
                          <div><strong>Per Day Salary:</strong> PKR {previewData.calculations.perDaySalary.toFixed(2)}</div>
                        </div>
                      </div>
                      
                      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '5px' }}>
                        <h4 style={{ marginTop: 0, fontSize: '14px', color: '#6c757d' }}>Attendance Summary</h4>
                        <div style={{ fontSize: '13px' }}>
                          <div style={{ color: '#28a745' }}><strong>Present:</strong> {previewData.calculations.presentDays} days</div>
                          <div style={{ color: '#dc3545' }}><strong>Absent:</strong> {previewData.calculations.absentDays} days
                            {previewData.calculations.recordedAbsentDays > 0 && (
                              <span style={{ fontSize: '11px', color: '#6c757d' }}>
                                {' '}({previewData.calculations.recordedAbsentDays} recorded, {previewData.calculations.missingDays} missing)
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#ffc107' }}><strong>Late:</strong> {previewData.calculations.lateDays} days</div>
                          <div><strong>Half Days:</strong> {previewData.calculations.halfDays} days</div>
                          {previewData.calculations.leaveDays > 0 && (
                            <div><strong>Leaves:</strong> {previewData.calculations.leaveDays} days</div>
                          )}
                          {previewData.calculations.earlyArrivals > 0 && (
                            <div style={{ color: '#17a2b8' }}><strong>Early Departure:</strong> {previewData.calculations.earlyArrivals}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
                      <h4 style={{ marginTop: 0, fontSize: '14px', color: '#6c757d' }}>Deduction Breakdown</h4>
                      <div style={{ fontSize: '13px' }}>
                        {previewData.deductions.absentDeduction > 0 && (
                          <div style={{ color: '#dc3545' }}>
                            <strong>Absent Deduction:</strong> PKR {previewData.deductions.absentDeduction.toLocaleString()}
                            <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '5px', marginLeft: '10px' }}>
                              {criteriaData.lateThreshold && (
                                <div>
                                  • {criteriaData.lateThreshold} lates = 1 absent: 
                                  {previewData.deductions.lateAsAbsent > 0 ? (
                                    <span> {previewData.deductions.lateAsAbsent} absent day{previewData.deductions.lateAsAbsent !== 1 ? 's' : ''} from {previewData.calculations.lateDays} late{previewData.calculations.lateDays !== 1 ? 's' : ''}</span>
                                  ) : (
                                    <span style={{ color: '#999' }}> 0 absent days (no lates)</span>
                                  )}
                                </div>
                              )}
                              {criteriaData.halfDayThreshold > 0 && (
                                <div>
                                  • {criteriaData.halfDayThreshold} half-day{criteriaData.halfDayThreshold !== 1 ? 's' : ''} = 1 absent: 
                                  {previewData.deductions.halfDayAsAbsent > 0 ? (
                                    <span> {previewData.deductions.halfDayAsAbsent} absent day{previewData.deductions.halfDayAsAbsent !== 1 ? 's' : ''} from {previewData.calculations.halfDays} half-day{previewData.calculations.halfDays !== 1 ? 's' : ''}</span>
                                  ) : (
                                    <span style={{ color: '#999' }}> 0 absent days (no half-days)</span>
                                  )}
                                </div>
                              )}
                              {criteriaData.earlyDepartureThreshold > 0 && (
                                <div>
                                  • {criteriaData.earlyDepartureThreshold} early-departure{criteriaData.earlyDepartureThreshold !== 1 ? 's' : ''} = 1 absent: 
                                  {previewData.deductions.earlyDepartureAsAbsent > 0 ? (
                                    <span> {previewData.deductions.earlyDepartureAsAbsent} absent day{previewData.deductions.earlyDepartureAsAbsent !== 1 ? 's' : ''} from {previewData.calculations.earlyDepartureDays || 0} early-departure{(previewData.calculations.earlyDepartureDays || 0) !== 1 ? 's' : ''}</span>
                                  ) : (
                                    <span style={{ color: '#999' }}> 0 absent days (no early-departures)</span>
                                  )}
                                </div>
                              )}
                              {criteriaData.lateEarlyDepartureThreshold > 0 && (
                                <div>
                                  • {criteriaData.lateEarlyDepartureThreshold} late-early-departure{criteriaData.lateEarlyDepartureThreshold !== 1 ? 's' : ''} = 1 absent: 
                                  {previewData.deductions.lateEarlyDepartureAsAbsent > 0 ? (
                                    <span> {previewData.deductions.lateEarlyDepartureAsAbsent} absent day{previewData.deductions.lateEarlyDepartureAsAbsent !== 1 ? 's' : ''} from {previewData.calculations.lateEarlyDepartureDays || 0} late-early-departure{(previewData.calculations.lateEarlyDepartureDays || 0) !== 1 ? 's' : ''}</span>
                                  ) : (
                                    <span style={{ color: '#999' }}> 0 absent days (no late-early-departures)</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {previewData.deductions.excessLeaves > 0 && (
                          <div style={{ color: '#dc3545' }}>
                            <strong>Excess Leaves Deduction:</strong> {previewData.deductions.excessLeaves} days
                          </div>
                        )}
                        {previewData.deductions.otherDeductions > 0 && (
                          <div style={{ color: '#dc3545' }}>
                            <strong>Other Deductions:</strong> PKR {previewData.deductions.otherDeductions.toLocaleString()}
                          </div>
                        )}
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #dee2e6' }}>
                          <strong style={{ fontSize: '14px' }}>Total Deductions:</strong> 
                          <span style={{ color: '#dc3545', fontSize: '16px', marginLeft: '10px' }}>
                            PKR {previewData.deductions.totalDeductions.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {previewData.additions.bonus > 0 && (
                      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
                        <h4 style={{ marginTop: 0, fontSize: '14px', color: '#6c757d' }}>Bonus Breakdown</h4>
                        <div style={{ fontSize: '13px' }}>
                          {previewData.bonusBreakdown.perfectAttendanceBonus > 0 && (
                            <div style={{ color: '#28a745' }}>
                              <strong>Perfect Attendance Bonus:</strong> PKR {previewData.bonusBreakdown.perfectAttendanceBonus.toLocaleString()}
                            </div>
                          )}
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #dee2e6' }}>
                            <strong style={{ fontSize: '14px' }}>Total Bonus:</strong> 
                            <span style={{ color: '#28a745', fontSize: '16px', marginLeft: '10px' }}>
                              PKR {previewData.additions.bonus.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ backgroundColor: '#e7f3ff', padding: '15px', borderRadius: '5px', border: '2px solid #2196f3' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#6c757d' }}>Base Salary</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>PKR {previewData.baseSalary.toLocaleString()}</div>
                        </div>
                        <div style={{ fontSize: '20px', color: '#6c757d' }}>-</div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#6c757d' }}>Deductions</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>
                            PKR {previewData.deductions.totalDeductions.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ fontSize: '20px', color: '#6c757d' }}>+</div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#6c757d' }}>Additions</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
                            PKR {previewData.additions.totalAdditions.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ fontSize: '20px', color: '#6c757d' }}>=</div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#6c757d' }}>Net Salary</div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>
                            PKR {previewData.netSalary.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {calculationType === 'all' && previewAllData && (
                  <div className="preview-all">
                    <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
                      <h4 style={{ marginTop: 0, fontSize: '14px', color: '#6c757d' }}>Summary</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '13px' }}>
                        <div><strong>Total Employees:</strong> {previewAllData.summary.totalEmployees}</div>
                        <div><strong>Calculated:</strong> {previewAllData.summary.calculated}</div>
                        <div><strong>Errors:</strong> {previewAllData.summary.errors}</div>
                        <div><strong>Total Net Salary:</strong> PKR {previewAllData.summary.totalNetSalary.toLocaleString()}</div>
                      </div>
                    </div>

                    {previewAllData.errors && previewAllData.errors.length > 0 && (
                      <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '5px', marginBottom: '15px', border: '1px solid #ffc107' }}>
                        <h4 style={{ marginTop: 0, fontSize: '14px', color: '#856404' }}>Errors</h4>
                        <div style={{ fontSize: '12px', maxHeight: '150px', overflowY: 'auto' }}>
                          {previewAllData.errors.map((err, idx) => (
                            <div key={idx} style={{ marginBottom: '5px' }}>
                              <strong>{err.employeeId}</strong> ({err.name}): {err.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '12px', backgroundColor: 'white', borderRadius: '5px' }}>
                        <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                          <tr>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Employee</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Base</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Present</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Absent</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Late</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Deductions</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Bonus</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Net Salary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewAllData.previews.map((preview, idx) => (
                            <tr key={idx} style={{ borderTop: '1px solid #dee2e6' }}>
                              <td style={{ padding: '8px' }}>
                                <div><strong>{preview.employeeId}</strong></div>
                                <div style={{ fontSize: '11px', color: '#6c757d' }}>{preview.name}</div>
                                <div style={{ fontSize: '10px', color: '#999' }}>{preview.department}</div>
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>PKR {preview.baseSalary.toLocaleString()}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: '#28a745' }}>{preview.presentDays}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: '#dc3545' }}>{preview.absentDays}</td>
                              <td style={{ padding: '8px', textAlign: 'center', color: '#ffc107' }}>{preview.lateDays}</td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#dc3545' }}>
                                PKR {preview.totalDeductions.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#28a745' }}>
                                {preview.bonus > 0 ? `PKR ${preview.bonus.toLocaleString()}` : '-'}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                                PKR {preview.netSalary.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default Salaries;
