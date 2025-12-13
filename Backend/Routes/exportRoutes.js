/**
 * Export Routes
 * Handles data export endpoints with format query parameter
 */

import express from "express";
import {
  exportEmployees,
  exportAttendance,
  exportTasks,
  exportTickets,
  exportAuditLogs,
  exportDepartments,
} from "../Controller/exportController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";
import { intensiveLimiter } from "../Middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Apply rate limiting to all export routes
router.use(intensiveLimiter);

// Employee exports (superAdmin, attendanceDepartment)
// GET /exports/employees?format=csv|xlsx
router.get(
  "/employees",
  hasRole("superAdmin", "attendanceDepartment"),
  exportEmployees
);

// Attendance exports
// GET /exports/attendance?format=csv|xlsx&startDate=&endDate=&departmentId=&employeeId=
router.get(
  "/attendance",
  hasRole("superAdmin", "attendanceDepartment"),
  exportAttendance
);

// Task exports
// GET /exports/tasks?format=csv|xlsx
router.get(
  "/tasks",
  hasRole("superAdmin", "teamLead"),
  exportTasks
);

// Ticket exports
// GET /exports/tickets?format=csv|xlsx
router.get(
  "/tickets",
  hasRole("superAdmin", "attendanceDepartment", "ITAssetManager"),
  exportTickets
);

// Department exports
// GET /exports/departments?format=csv|xlsx
router.get(
  "/departments",
  hasRole("superAdmin", "attendanceDepartment"),
  exportDepartments
);

// Audit log exports (superAdmin only)
// GET /exports/audit-logs?format=csv|xlsx
router.get(
  "/audit-logs",
  hasRole("superAdmin"),
  exportAuditLogs
);

export default router;
