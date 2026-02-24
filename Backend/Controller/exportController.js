/**
 * Export Controller
 * Handles data export to CSV and Excel formats
 */

import ExcelJS from "exceljs";
import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import Attendance from "../Model/Attendance.js";
import Task from "../Model/Task.js";
import Ticket from "../Model/Ticket.js";
import AuditLog from "../Model/AuditLog.js";
import Salary from "../Model/Salary.js";
import { logExportAction } from "../Utils/auditLogger.js";
import { formatLocalTime } from "../Utils/timezone.js";

/**
 * Helper to set Excel headers for download
 */
const setExcelHeaders = (res, filename) => {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
};

/**
 * Helper to set CSV headers for download
 */
const setCsvHeaders = (res, filename) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
};

/**
 * Style for Excel headers
 */
const headerStyle = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF667EEA" } },
  alignment: { horizontal: "center", vertical: "middle" },
  border: {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  },
};

/**
 * Convert 24-hour format to 12-hour format
 */
const convertTo12HourFormat = (time24) => {
  if (!time24) return '';
  
  const [hours, minutes] = time24.split(':');
  let hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  
  if (hour > 12) {
    hour -= 12;
  } else if (hour === 0) {
    hour = 12;
  }
  
  return `${hour}:${minutes} ${ampm}`;
};

/**
 * Export Employees to Excel or CSV
 */
export const exportEmployees = async (req, res) => {
  try {
    const { department, isActive = "true", format = 'xlsx', fields } = req.query;
    const filter = { isActive: isActive === "true" };
    if (department) filter['shifts.department'] = department;

    const employees = await Employee.find(filter)
      .populate("department", "name")
      .populate("role", "name")
      .populate("shifts.department", "name")
      .populate("leadingDepartments", "name")
      .sort({ name: 1 });

    // Parse selected fields, default to all if not provided
    let selectedFields = fields ? fields.split(',') : [
      'employeeId', 'name', 'email', 'phone', 'cnic', 'department', 
      'shifts', 'leadingDepts', 'role', 'position', 'workSchedule', 'joinDate', 'salary', 'status'
    ];

    // Prepare data rows with all possible data
    const fullDataRows = employees.map((emp) => {
      const primaryShift = emp.shifts?.find(s => s.isPrimary) || emp.shifts?.[0];
      return {
        employeeId: emp.employeeId,
        name: emp.name,
        email: emp.email || "",
        phone: emp.phone || "",
        cnic: emp.cnic || "",
        department: emp.department?.name || "N/A",
        shifts: emp.shifts?.map(s => s.department?.name || "N/A").join(", ") || "",
        leadingDepts: emp.leadingDepartments?.map((d) => d.name).join(", ") || "",
        role: emp.role?.name || "N/A",
        position: primaryShift?.position || emp.position || "",
        workSchedule: primaryShift?.workSchedule 
          ? `${convertTo12HourFormat(primaryShift.workSchedule.checkInTime)} - ${convertTo12HourFormat(primaryShift.workSchedule.checkOutTime)}`
          : "N/A",
        joinDate: primaryShift?.joiningDate ? new Date(primaryShift.joiningDate).toLocaleDateString() : "",
        salary: primaryShift?.monthlySalary || 0,
        status: emp.isActive ? "Active" : "Inactive",
      };
    });

    // Filter to only selected fields
    const dataRows = fullDataRows.map(row => {
      const filtered = {};
      selectedFields.forEach(field => {
        if (field in row) {
          filtered[field] = row[field];
        }
      });
      return filtered;
    });

    // Define field labels
    const fieldLabels = {
      'employeeId': 'Employee ID',
      'name': 'Name',
      'email': 'Email',
      'phone': 'Phone',
      'cnic': 'CNIC',
      'department': 'Department',
      'additionalDepts': 'Additional Depts',
      'leadingDepts': 'Leading Depts',
      'role': 'Role',
      'position': 'Position',
      'workSchedule': 'Work Schedule',
      'joinDate': 'Join Date',
      'salary': 'Salary',
      'status': 'Status',
    };

    // Get headers for selected fields
    const headers = selectedFields.map(field => fieldLabels[field] || field);

    await logExportAction(req, "Employee", `Exported ${employees.length} employees to ${format.toUpperCase()}`);

    if (format === 'csv') {
      // Export as CSV
      const rows = dataRows.map((row) => 
        selectedFields.map(field => `"${row[field] || ''}"`)
      );
      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      
      setCsvHeaders(res, `employees_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csvContent);
    } else {
      // Export as Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "AMS System";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Employees");

      // Define columns dynamically based on selected fields
      const columns = selectedFields.map(field => ({
        header: fieldLabels[field] || field,
        key: field,
        width: field === 'email' || field === 'additionalDepts' || field === 'leadingDepts' ? 30 : 
               field === 'name' || field === 'position' || field === 'workSchedule' ? 25 : 15
      }));

      worksheet.columns = columns;

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
        cell.border = headerStyle.border;
      });

      dataRows.forEach((row) => worksheet.addRow(row));
      
      // Set autofilter range
      const lastColumn = String.fromCharCode(64 + selectedFields.length);
      worksheet.autoFilter = `A1:${lastColumn}1`;

      setExcelHeaders(res, `employees_${new Date().toISOString().split("T")[0]}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export Attendance to Excel or CSV
 */
export const exportAttendance = async (req, res) => {
  try {
    const { startDate, endDate, departmentId, employeeId, status, month, format = 'xlsx' } = req.query;
    const filter = {};

    // Handle date range
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (month) {
      // Parse month in format "YYYY-MM"
      const [year, monthNum] = month.split('-');
      const startOfMonth = new Date(year, parseInt(monthNum) - 1, 1);
      const endOfMonth = new Date(year, parseInt(monthNum), 0, 23, 59, 59);
      filter.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    // Handle status filter
    if (status) {
      filter.status = status;
    }

    // Handle employeeId - need to find by string employeeId, not MongoDB _id
    let employeeObjectId = null;
    if (employeeId) {
      // Check if it's a MongoDB ObjectId or a string employeeId
      if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
        employeeObjectId = employeeId;
      } else {
        // Find employee by their string employeeId
        const employee = await Employee.findOne({ employeeId: employeeId });
        if (employee) {
          employeeObjectId = employee._id;
        }
      }
      if (employeeObjectId) {
        filter.employee = employeeObjectId;
      }
    }

    let query = Attendance.find(filter)
      .populate("employee", "name employeeId biometricId department")
      .sort({ date: -1 });

    const attendanceRecords = await query;

    // Filter by department if specified
    let filteredRecords = attendanceRecords;
    if (departmentId) {
      filteredRecords = attendanceRecords.filter(
        (a) => a.employee?.department?.toString() === departmentId
      );
    }

    // Use centralized timezone utility for correct local time formatting
    const formatTime = (dateTime) => {
      if (!dateTime) return "-";
      try {
        const timeStr = formatLocalTime(dateTime);
        if (!timeStr || timeStr === "-") return "N/A";
        // Optionally, convert to 12-hour format for Excel if needed
        const [hours, minutes] = timeStr.split(":");
        let hour = parseInt(hours);
        const ampm = hour >= 12 ? "PM" : "AM";
        if (hour > 12) hour -= 12;
        else if (hour === 0) hour = 12;
        return `${hour}:${minutes} ${ampm}`;
      } catch (e) {
        return "N/A";
      }
    };

    // Helper function to format date
    const formatDate = (dateValue) => {
      if (!dateValue) return "N/A";
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return "N/A";
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      } catch (e) {
        return "N/A";
      }
    };

    // Only include employees who have marked attendance (i.e., have checkIn or checkOut)
    const dataRows = filteredRecords
      .filter((record) => record.checkIn || record.checkOut)
      .map((record) => ({
        date: formatDate(record.date),
        employeeId: record.employee?.employeeId || "N/A",
        biometricId: record.employee?.biometricId || "N/A",
        name: record.employee?.name || "N/A",
        checkIn: formatTime(record.checkIn),
        checkOut: formatTime(record.checkOut),
        workingHours: record.workingHours?.toFixed(2) || "0.00",
        status: record.status || "N/A",
      }));

    await logExportAction(req, "Attendance", `Exported ${filteredRecords.length} attendance records to ${format.toUpperCase()}`);

    if (format === 'csv') {
      // Export as CSV
      const headers = ["Date", "Employee ID", "Biometric ID", "Employee Name", "Check In", "Check Out", "Working Hours", "Status"];
      const rows = dataRows.map((row) => [
        row.date,
        row.employeeId,
        row.biometricId,
        row.name,
        row.checkIn,
        row.checkOut,
        row.workingHours,
        row.status,
      ]);
      const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      
      setCsvHeaders(res, `attendance_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csvContent);
    } else {
      // Export as Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Attendance");

      worksheet.columns = [
        { header: "Date", key: "date", width: 15 },
        { header: "Employee ID", key: "employeeId", width: 15 },
        { header: "Biometric ID", key: "biometricId", width: 15 },
        { header: "Employee Name", key: "name", width: 25 },
        { header: "Check In", key: "checkIn", width: 14 },
        { header: "Check Out", key: "checkOut", width: 14 },
        { header: "Working Hours", key: "workingHours", width: 15 },
        { header: "Status", key: "status", width: 12 },
      ];

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      // Add data rows with explicit text formatting for time columns
      dataRows.forEach((row) => {
        const newRow = worksheet.addRow(row);
        // Set Check In and Check Out cells as text to prevent auto-formatting
        newRow.getCell('checkIn').numFmt = '@'; // Text format
        newRow.getCell('checkOut').numFmt = '@'; // Text format
      });

      setExcelHeaders(res, `attendance_${new Date().toISOString().split("T")[0]}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export Tasks to Excel
 */
export const exportTasks = async (req, res) => {
  try {
    const { status, department, priority } = req.query;
    const filter = { isActive: true };
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (priority) filter.priority = priority;

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name employeeId")
      .populate("assignedBy", "name")
      .populate("department", "name")
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tasks");

    worksheet.columns = [
      { header: "Task ID", key: "taskId", width: 15 },
      { header: "Title", key: "title", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Status", key: "status", width: 12 },
      { header: "Priority", key: "priority", width: 12 },
      { header: "Assigned To", key: "assignedTo", width: 30 },
      { header: "Assigned By", key: "assignedBy", width: 20 },
      { header: "Department", key: "department", width: 20 },
      { header: "Due Date", key: "dueDate", width: 15 },
      { header: "Created At", key: "createdAt", width: 15 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
    });

    tasks.forEach((task) => {
      worksheet.addRow({
        taskId: task.taskId,
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        assignedTo: task.assignedTo?.map((e) => e.name).join(", ") || "Unassigned",
        assignedBy: task.assignedBy?.name || "N/A",
        department: task.department?.name || "N/A",
        dueDate: new Date(task.dueDate).toLocaleDateString(),
        createdAt: new Date(task.createdAt).toLocaleDateString(),
      });
    });

    await logExportAction(req, "Task", `Exported ${tasks.length} tasks`);

    setExcelHeaders(res, `tasks_${new Date().toISOString().split("T")[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export Tickets to Excel
 */
export const exportTickets = async (req, res) => {
  try {
    const { status, category, priority } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const tickets = await Ticket.find(filter)
      .populate("reportedBy", "name employeeId")
      .populate("reportedAgainst", "name employeeId")
      .populate("assignedTo", "name")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tickets");

    worksheet.columns = [
      { header: "Ticket ID", key: "ticketId", width: 15 },
      { header: "Title", key: "title", width: 30 },
      { header: "Category", key: "category", width: 15 },
      { header: "Priority", key: "priority", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Reported By", key: "reportedBy", width: 20 },
      { header: "Reported Against", key: "reportedAgainst", width: 20 },
      { header: "Assigned To", key: "assignedTo", width: 20 },
      { header: "Created At", key: "createdAt", width: 15 },
      { header: "Resolved At", key: "resolvedAt", width: 15 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
    });

    tickets.forEach((ticket) => {
      worksheet.addRow({
        ticketId: ticket.ticketId,
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        reportedBy: ticket.reportedBy?.name || "N/A",
        reportedAgainst: ticket.reportedAgainst?.name || "N/A",
        assignedTo: ticket.assignedTo?.name || "Unassigned",
        createdAt: new Date(ticket.createdAt).toLocaleDateString(),
        resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleDateString() : "N/A",
      });
    });

    await logExportAction(req, "Ticket", `Exported ${tickets.length} tickets`);

    setExcelHeaders(res, `tickets_${new Date().toISOString().split("T")[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export Audit Logs to Excel
 */
export const exportAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, action, resourceType } = req.query;
    const filter = {};

    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;

    const logs = await AuditLog.find(filter)
      .populate("performedBy", "name employeeId")
      .sort({ createdAt: -1 })
      .limit(5000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Audit Logs");

    worksheet.columns = [
      { header: "Timestamp", key: "timestamp", width: 20 },
      { header: "Action", key: "action", width: 15 },
      { header: "Resource Type", key: "resourceType", width: 15 },
      { header: "Description", key: "description", width: 50 },
      { header: "Performed By", key: "performedBy", width: 20 },
      { header: "Role", key: "role", width: 15 },
      { header: "IP Address", key: "ip", width: 15 },
      { header: "Status", key: "status", width: 10 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
    });

    logs.forEach((log) => {
      worksheet.addRow({
        timestamp: new Date(log.createdAt).toLocaleString(),
        action: log.action,
        resourceType: log.resourceType,
        description: log.description,
        performedBy: log.performedByName,
        role: log.performedByRole,
        ip: log.metadata?.ipAddress || "N/A",
        status: log.status,
      });
    });

    setExcelHeaders(res, `audit_logs_${new Date().toISOString().split("T")[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export Departments to Excel
 */
export const exportDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .populate("parentDepartment", "name")
      .sort({ path: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Departments");

    worksheet.columns = [
      { header: "Department Name", key: "name", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Parent Department", key: "parent", width: 25 },
      { header: "Level", key: "level", width: 10 },
      { header: "Path", key: "path", width: 50 },
      { header: "Working Hours Start", key: "startTime", width: 18 },
      { header: "Working Hours End", key: "endTime", width: 18 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
    });

    departments.forEach((dept) => {
      worksheet.addRow({
        name: dept.name,
        description: dept.description || "",
        parent: dept.parentDepartment?.name || "Root",
        level: dept.level || 0,
        path: dept.path || dept.name,
        startTime: dept.workingHours?.start || "09:00",
        endTime: dept.workingHours?.end || "18:00",
      });
    });

    await logExportAction(req, "Department", `Exported ${departments.length} departments`);

    setExcelHeaders(res, `departments_${new Date().toISOString().split("T")[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export Salaries to Excel or CSV
 */
export const exportSalaries = async (req, res) => {
  try {
    const { month, year, departmentId, format = 'xlsx' } = req.query;
    const filter = {};

    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);

    let salaries = await Salary.find(filter)
      .populate({
        path: "employee",
        select: "name employeeId department position",
        populate: {
          path: "department",
          select: "name code"
        }
      })
      .sort({ createdAt: -1 });

    // Filter by department if specified
    if (departmentId) {
      salaries = salaries.filter(
        (s) => s.employee?.department?._id?.toString() === departmentId
      );
    }

    const months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    // Prepare data rows
    const dataRows = salaries.map((salary) => ({
      employeeId: salary.employee?.employeeId || salary.employeeId || "N/A",
      name: salary.employee?.name || "N/A",
      department: salary.employee?.department?.name || "N/A",
      position: salary.employee?.position || "N/A",
      period: `${months[(salary.month || 1) - 1]} ${salary.year}`,
      baseSalary: salary.baseSalary || 0,
      workingDays: salary.calculations?.totalWorkingDays || 0,
      presentDays: salary.calculations?.presentDays || 0,
      absentDays: salary.calculations?.absentDays || 0,
      lateDays: salary.calculations?.lateDays || 0,
      halfDays: salary.calculations?.halfDays || 0,
      absentDeduction: salary.deductions?.absentDeduction || 0,
      lateDeduction: salary.deductions?.lateDeduction || 0,
      otherDeductions: salary.deductions?.otherDeductions || 0,
      totalDeductions: salary.deductions?.totalDeductions || 0,
      bonus: salary.additions?.bonus || 0,
      overtime: salary.additions?.overtime || 0,
      netSalary: salary.netSalary || 0,
      status: salary.status || "pending",
    }));

    await logExportAction(req, "Salary", `Exported ${salaries.length} salary records to ${format.toUpperCase()}`);

    if (format === 'csv') {
      // Export as CSV
      const headers = [
        "Employee ID", "Name", "Department", "Position", "Period",
        "Base Salary", "Working Days", "Present", "Absent", "Late", "Half Days",
        "Absent Deduction", "Late Deduction", "Other Deductions", "Total Deductions",
        "Bonus", "Overtime", "Net Salary", "Status"
      ];
      const rows = dataRows.map((row) => [
        row.employeeId, row.name, row.department, row.position, row.period,
        row.baseSalary, row.workingDays, row.presentDays, row.absentDays, row.lateDays, row.halfDays,
        row.absentDeduction, row.lateDeduction, row.otherDeductions, row.totalDeductions,
        row.bonus, row.overtime, row.netSalary, row.status
      ]);
      const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      
      const periodStr = month && year ? `${months[parseInt(month) - 1]}_${year}` : new Date().toISOString().split("T")[0];
      setCsvHeaders(res, `salaries_${periodStr}.csv`);
      res.send(csvContent);
    } else {
      // Export as Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Salaries");

      worksheet.columns = [
        { header: "Employee ID", key: "employeeId", width: 15 },
        { header: "Name", key: "name", width: 25 },
        { header: "Department", key: "department", width: 20 },
        { header: "Position", key: "position", width: 20 },
        { header: "Period", key: "period", width: 18 },
        { header: "Base Salary", key: "baseSalary", width: 15 },
        { header: "Working Days", key: "workingDays", width: 14 },
        { header: "Present", key: "presentDays", width: 10 },
        { header: "Absent", key: "absentDays", width: 10 },
        { header: "Late", key: "lateDays", width: 10 },
        { header: "Half Days", key: "halfDays", width: 12 },
        { header: "Absent Ded.", key: "absentDeduction", width: 14 },
        { header: "Late Ded.", key: "lateDeduction", width: 12 },
        { header: "Other Ded.", key: "otherDeductions", width: 12 },
        { header: "Total Ded.", key: "totalDeductions", width: 14 },
        { header: "Bonus", key: "bonus", width: 12 },
        { header: "Overtime", key: "overtime", width: 12 },
        { header: "Net Salary", key: "netSalary", width: 15 },
        { header: "Status", key: "status", width: 12 },
      ];

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      dataRows.forEach((row) => {
        const newRow = worksheet.addRow(row);
        // Format currency columns
        ['baseSalary', 'absentDeduction', 'lateDeduction', 'otherDeductions', 'totalDeductions', 'bonus', 'overtime', 'netSalary'].forEach(key => {
          newRow.getCell(key).numFmt = '#,##0';
        });
      });

      const periodStr = month && year ? `${months[parseInt(month) - 1]}_${year}` : new Date().toISOString().split("T")[0];
      setExcelHeaders(res, `salaries_${periodStr}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    console.error("Export salaries error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

