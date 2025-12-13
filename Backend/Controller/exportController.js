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
import { logExportAction } from "../Utils/auditLogger.js";

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
 * Export Employees to Excel or CSV
 */
export const exportEmployees = async (req, res) => {
  try {
    const { department, isActive = "true", format = 'xlsx' } = req.query;
    const filter = { isActive: isActive === "true" };
    if (department) filter.department = department;

    const employees = await Employee.find(filter)
      .populate("department", "name")
      .populate("role", "name")
      .populate("additionalDepartments", "name")
      .populate("leadingDepartments", "name")
      .sort({ name: 1 });

    // Prepare data rows
    const dataRows = employees.map((emp) => ({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email || "",
      phone: emp.phone || "",
      department: emp.department?.name || "N/A",
      additionalDepts: emp.additionalDepartments?.map((d) => d.name).join(", ") || "",
      leadingDepts: emp.leadingDepartments?.map((d) => d.name).join(", ") || "",
      role: emp.role?.name || "N/A",
      position: emp.position || "",
      joinDate: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : "",
      salary: emp.salary?.monthlySalary || 0,
      status: emp.isActive ? "Active" : "Inactive",
    }));

    await logExportAction(req, "Employee", `Exported ${employees.length} employees to ${format.toUpperCase()}`);

    if (format === 'csv') {
      // Export as CSV
      const headers = ["Employee ID", "Name", "Email", "Phone", "Department", "Additional Depts", "Leading Depts", "Role", "Position", "Join Date", "Salary", "Status"];
      const rows = dataRows.map((row) => [
        row.employeeId, row.name, row.email, row.phone, row.department,
        row.additionalDepts, row.leadingDepts, row.role, row.position,
        row.joinDate, row.salary, row.status
      ]);
      const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      
      setCsvHeaders(res, `employees_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csvContent);
    } else {
      // Export as Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "AMS System";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Employees");

      worksheet.columns = [
        { header: "Employee ID", key: "employeeId", width: 15 },
        { header: "Name", key: "name", width: 25 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 15 },
        { header: "Department", key: "department", width: 20 },
        { header: "Additional Depts", key: "additionalDepts", width: 25 },
        { header: "Leading Depts", key: "leadingDepts", width: 25 },
        { header: "Role", key: "role", width: 15 },
        { header: "Position", key: "position", width: 20 },
        { header: "Join Date", key: "joinDate", width: 15 },
        { header: "Salary", key: "salary", width: 12 },
        { header: "Status", key: "status", width: 10 },
      ];

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
        cell.border = headerStyle.border;
      });

      dataRows.forEach((row) => worksheet.addRow(row));
      worksheet.autoFilter = "A1:L1";

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
    const { startDate, endDate, departmentId, employeeId, format = 'xlsx' } = req.query;
    const filter = {};

    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (employeeId) filter.employee = employeeId;

    let query = Attendance.find(filter)
      .populate("employee", "name employeeId department")
      .sort({ date: -1 });

    const attendanceRecords = await query;

    // Filter by department if specified
    let filteredRecords = attendanceRecords;
    if (departmentId) {
      filteredRecords = attendanceRecords.filter(
        (a) => a.employee?.department?.toString() === departmentId
      );
    }

    // Prepare data rows
    const dataRows = filteredRecords.map((record) => ({
      date: new Date(record.date).toLocaleDateString(),
      employeeId: record.employee?.employeeId || "N/A",
      name: record.employee?.name || "N/A",
      checkIn: record.checkIn || "N/A",
      checkOut: record.checkOut || "N/A",
      workingHours: record.workingHours?.toFixed(2) || "0",
      status: record.status || "N/A",
      late: record.isLate ? "Yes" : "No",
    }));

    await logExportAction(req, "Attendance", `Exported ${filteredRecords.length} attendance records to ${format.toUpperCase()}`);

    if (format === 'csv') {
      // Export as CSV
      const headers = ["Date", "Employee ID", "Employee Name", "Check In", "Check Out", "Working Hours", "Status", "Late"];
      const rows = dataRows.map((row) => [
        row.date,
        row.employeeId,
        row.name,
        row.checkIn,
        row.checkOut,
        row.workingHours,
        row.status,
        row.late,
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
        { header: "Employee Name", key: "name", width: 25 },
        { header: "Check In", key: "checkIn", width: 12 },
        { header: "Check Out", key: "checkOut", width: 12 },
        { header: "Working Hours", key: "workingHours", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Late", key: "late", width: 10 },
      ];

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
      });

      dataRows.forEach((row) => worksheet.addRow(row));

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

