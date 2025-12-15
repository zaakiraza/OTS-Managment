import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { reportAPI, departmentAPI, employeeAPI, exportAPI } from "../../Config/Api";
import "./Reports.css";

function Reports() {
  const [reportType, setReportType] = useState("attendance");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [filters, setFilters] = useState({
    reportFormat: "detailed", // 'detailed' or 'summary'
    startDate: "",
    endDate: "",
    month: "",
    week: "", // Week selection
    departmentId: "",
    employeeId: "",
    status: "",
  });

  // Format time to show local PKT time
  const formatTime = (time) => {
    if (!time) return "-";
    try {
      const date = new Date(time);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      return "-";
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (filters.departmentId) {
      fetchEmployeesByDepartment(filters.departmentId);
    }
  }, [filters.departmentId]);

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        // Use flatData to get all departments including sub-departments
        setDepartments(response.data.flatData || response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchEmployeesByDepartment = async (deptId) => {
    try {
      const response = await employeeAPI.getAll({ department: deptId });
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });

    // Clear dependent filters
    if (name === "departmentId" && !value) {
      setFilters({ ...filters, departmentId: "", employeeId: "" });
      setEmployees([]);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let response;
      const params = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        month: filters.month || undefined,
        week: filters.week || undefined,
        departmentId: filters.departmentId || undefined,
        employeeId: filters.employeeId || undefined,
        status: filters.status || undefined,
        reportType: filters.reportFormat,
      };

      switch (reportType) {
        case "attendance":
          response = await reportAPI.generateAttendanceReport(params);
          break;
        case "department-wise":
          response = await reportAPI.getDepartmentWiseReport(params);
          break;
        case "employee-wise":
          if (!filters.employeeId) {
            alert("Please select an employee for employee-wise report");
            setLoading(false);
            return;
          }
          response = await reportAPI.getEmployeeWiseReport(params);
          break;
        case "monthly-summary":
          if (!filters.month) {
            alert("Please select a month for monthly summary");
            setLoading(false);
            return;
          }
          response = await reportAPI.getMonthlyAttendanceSummary(params);
          break;
        default:
          break;
      }

      setReportData(response.data);
    } catch (error) {
      console.error("Error generating report:", error);
      alert(error.response?.data?.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format = 'csv') => {
    try {
      setLoading(true);
      const params = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        month: filters.month || undefined,
        departmentId: filters.departmentId || undefined,
        employeeId: filters.employeeId || undefined,
        status: filters.status || undefined,
      };

      // Use the export API for attendance
      const response = await exportAPI.exportAttendance(format, params);
      
      // Download the file
      const blob = new Blob([response.data], { 
        type: format === 'xlsx' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'text/csv' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert(`Report exported to ${format.toUpperCase()} successfully!`);
    } catch (error) {
      console.error("Error exporting report:", error);
      // Fallback to local CSV export if API fails
      if (format === 'csv' && reportData?.data) {
        const csvData = convertToCSV(reportData.data);
        downloadCSV(csvData, `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        alert("Failed to export report. Please generate a report first.");
      }
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return "";

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => 
      Object.values(row).map(value => 
        `"${String(value).replace(/"/g, '""')}"`
      ).join(",")
    );

    return [headers, ...rows].join("\n");
  };

  const downloadCSV = (csvData, filename) => {
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const renderSummaryStats = (summary, salaryInfo = null) => {
    if (!summary) return null;

    return (
      <div className="summary-stats">
        <div className="stat-box">
          <h3>Total Records</h3>
          <p className="stat-number">{summary.totalRecords || 0}</p>
        </div>
        <div className="stat-box">
          <h3>Total Hours</h3>
          <p className="stat-number">{summary.totalWorkingHours?.toFixed(2) || 0}</p>
        </div>
        <div className="stat-box">
          <h3>Avg Hours</h3>
          <p className="stat-number">{summary.averageWorkingHours?.toFixed(2) || 0}</p>
        </div>
        {salaryInfo && (
          <>
            <div className="stat-box salary-box">
              <h3>Base Salary</h3>
              <p className="stat-number">${typeof salaryInfo.baseSalary === 'number' ? salaryInfo.baseSalary.toFixed(2) : '0.00'}</p>
            </div>
            <div className="stat-box salary-box">
              <h3>Deductions</h3>
              <p className="stat-number deduction">-${typeof salaryInfo.deductions === 'number' ? salaryInfo.deductions.toFixed(2) : '0.00'}</p>
            </div>
            <div className="stat-box salary-box net-salary">
              <h3>Net Salary</h3>
              <p className="stat-number">${typeof salaryInfo.netSalary === 'number' ? salaryInfo.netSalary.toFixed(2) : '0.00'}</p>
            </div>
          </>
        )}
        {summary.statusBreakdown && (
          <div className="stat-box full-width">
            <h3>Status Breakdown</h3>
            <div className="status-grid">
              {Object.entries(summary.statusBreakdown).map(([status, count]) => (
                <div key={status} className="status-item">
                  <span className={`status-badge status-${status}`}>{status}</span>
                  <span className="count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAttendanceReport = () => {
    if (!reportData || !reportData.data) return null;

    // Check if it's weekly summary
    if (reportData.isWeeklySummary && Array.isArray(reportData.data)) {
      return (
        <div className="report-result">
          <h2>Weekly Attendance Summary</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Total Hrs</th>
                  <th>Completed Hrs</th>
                  <th>Late</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Early Arrival</th>
                  <th>Late + Early</th>
                </tr>
              </thead>
              <tbody>
                {reportData.data.map((emp, index) => (
                  <tr key={index}>
                    <td>{emp.employee.employeeId}</td>
                    <td>{emp.employee.name}</td>
                    <td>{emp.employee.department}</td>
                    <td>{emp.expectedHours.toFixed(2)}</td>
                    <td style={{ fontWeight: 'bold', color: emp.totalHours >= emp.expectedHours ? 'green' : 'orange' }}>
                      {emp.totalHours.toFixed(2)}
                    </td>
                    <td><span className="status status-late">{emp.late}</span></td>
                    <td><span className="status status-present">{emp.present}</span></td>
                    <td><span className="status status-absent">{emp.absent}</span></td>
                    <td>{emp.leaves}</td>
                    <td><span className="status status-early-arrival">{emp.earlyArrival}</span></td>
                    <td><span className="status status-late-early-arrival">{emp.lateEarlyArrival}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="report-result">
        <h2>Attendance Report</h2>
        {reportData.summary && renderSummaryStats(reportData.summary, reportData.salaryInfo)}

        {filters.reportFormat === "detailed" && Array.isArray(reportData.data) && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.data.map((record, index) => (
                  <tr key={index}>
                    <td>{new Date(record.date).toLocaleDateString()}</td>
                    <td>{record.userId}</td>
                    <td>{record.employee?.name || record.user?.name || "N/A"}</td>
                    <td>{record.employee?.department?.name || "N/A"}</td>
                    <td>{formatTime(record.checkIn)}</td>
                    <td>{formatTime(record.checkOut)}</td>
                    <td>{record.workingHours?.toFixed(2) || "0"}</td>
                    <td>
                      <span className={`status status-${record.status}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderDepartmentWiseReport = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      return (
        <div className="report-result">
          <h2>Department-Wise Report</h2>
          <p>No data available for the selected filters.</p>
        </div>
      );
    }

    return (
      <div className="report-result">
        <h2>Department-Wise Report</h2>
        <div className="department-cards">
          {reportData.data.map((dept, index) => (
            <div key={index} className="department-card">
              <h3>
                {dept.department?.name || 'Unknown Department'} 
                {dept.department?.code ? ` (${dept.department.code})` : ''}
              </h3>
              {renderSummaryStats(dept.statistics)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEmployeeWiseReport = () => {
    if (!reportData || !reportData.employee) return null;

    return (
      <div className="report-result">
        <h2>Employee Report: {reportData.employee.name}</h2>
        <div className="employee-info">
          <p><strong>Employee ID:</strong> {reportData.employee.employeeId}</p>
          <p><strong>Email:</strong> {reportData.employee.email}</p>
          <p><strong>Department:</strong> {reportData.employee.department?.name}</p>
          <p><strong>Position:</strong> {reportData.employee.position}</p>
          <p><strong>Monthly Salary:</strong> ${reportData.employee.monthlySalary?.toFixed(2) || 0}</p>
        </div>

        {reportData.statistics && renderSummaryStats(reportData.statistics, reportData.salaryInfo)}

        <div className="table-container">
          <h3>Attendance Records</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reportData.records?.map((record, index) => (
                <tr key={index}>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{formatTime(record.checkIn)}</td>
                  <td>{formatTime(record.checkOut)}</td>
                  <td>{record.workingHours?.toFixed(2) || "0"}</td>
                  <td>
                    <span className={`status status-${record.status}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMonthlySummary = () => {
    if (!reportData) return null;

    return (
      <div className="report-result">
        <h2>Monthly Summary: {filters.month}</h2>
        {reportData.monthSummary && renderSummaryStats(reportData.monthSummary)}

        {reportData.dailyBreakdown && (
          <div className="table-container">
            <h3>Daily Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Half Day</th>
                  <th>Late</th>
                  <th>Early Arrival</th>
                  <th>Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {reportData.dailyBreakdown.map((day, index) => (
                  <tr key={index}>
                    <td>{day._id}</td>
                    <td>{day.totalPresent || 0}</td>
                    <td>{day.totalAbsent || 0}</td>
                    <td>{day.totalHalfDay || 0}</td>
                    <td>{day.totalLate || 0}</td>
                    <td>{day.totalEarlyArrival || 0}</td>
                    <td>{day.totalWorkingHours?.toFixed(2) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderReportContent = () => {
    switch (reportType) {
      case "attendance":
        return renderAttendanceReport();
      case "department-wise":
        return renderDepartmentWiseReport();
      case "employee-wise":
        return renderEmployeeWiseReport();
      case "monthly-summary":
        return renderMonthlySummary();
      default:
        return null;
    }
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1><i className="fas fa-chart-bar"></i> Reports</h1>
              <p>Generate and export attendance reports</p>
            </div>
          </div>

          <div className="report-controls">
            <div className="report-type-selector">
              <label>Report Type</label>
              <div className="btn-group">
                <button
                  className={reportType === "attendance" ? "active" : ""}
                  onClick={() => setReportType("attendance")}
                >
                  Attendance Report
                </button>
                <button
                  className={reportType === "department-wise" ? "active" : ""}
                  onClick={() => setReportType("department-wise")}
                >
                  Department-Wise
                </button>
                <button
                  className={reportType === "employee-wise" ? "active" : ""}
                  onClick={() => setReportType("employee-wise")}
                >
                  Employee-Wise
                </button>
                <button
                  className={reportType === "monthly-summary" ? "active" : ""}
                  onClick={() => setReportType("monthly-summary")}
                >
                  Monthly Summary
                </button>
              </div>
            </div>

            <div className="filters-container">
              <div className="filter-row">
                <div className="filter-group">
                  <label>Report Format</label>
                  <select
                    name="reportFormat"
                    value={filters.reportFormat}
                    onChange={handleFilterChange}
                  >
                    <option value="detailed">Detailed</option>
                    <option value="summary">Summary Only</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Month</label>
                  <input
                    type="month"
                    name="month"
                    value={filters.month}
                    onChange={handleFilterChange}
                    placeholder="Select month"
                  />
                </div>

                <div className="filter-group">
                  <label>Week</label>
                  <input
                    type="week"
                    name="week"
                    value={filters.week}
                    onChange={handleFilterChange}
                    placeholder="Select week"
                  />
                  <small style={{ color: "#666", fontSize: "0.85em" }}>
                    Select specific week for weekly report
                  </small>
                </div>

                <div className="filter-group">
                  <label>Or Date Range</label>
                  <div className="date-range">
                    <input
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      placeholder="Start Date"
                    />
                    <span>to</span>
                    <input
                      type="date"
                      name="endDate"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                      placeholder="End Date"
                    />
                  </div>
                </div>
              </div>

              <div className="filter-row">
                <div className="filter-group">
                  <label>Department</label>
                  <select
                    name="departmentId"
                    value={filters.departmentId}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {"—".repeat(dept.level || 0)} {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Employee</label>
                  <select
                    name="employeeId"
                    value={filters.employeeId}
                    onChange={handleFilterChange}
                    disabled={!filters.departmentId && reportType !== "employee-wise"}
                  >
                    <option value="">
                      {filters.departmentId ? "All Employees" : "Select Department First"}
                    </option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp.employeeId}>
                        {emp.employeeId} - {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Status</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="half-day">Half Day</option>
                    <option value="late">Late</option>
                    <option value="early-arrival">Early Arrival</option>
                  </select>
                </div>
              </div>

              <div className="action-buttons">
                <button
                  className="btn-primary"
                  onClick={generateReport}
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate Report"}
                </button>
                <button
                  className="btn-export csv"
                  onClick={() => exportReport('csv')}
                  disabled={loading}
                >
                  <i className="fas fa-file-csv"></i> Export CSV
                </button>
                <button
                  className="btn-export excel"
                  onClick={() => exportReport('xlsx')}
                  disabled={loading}
                >
                  <i className="fas fa-file-excel"></i> Export Excel
                </button>
              </div>
            </div>
          </div>

          {renderReportContent()}
        </div>
      </div>
    </div>
  );
}

export default Reports;

