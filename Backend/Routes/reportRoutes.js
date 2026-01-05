import express from "express";
import {
  generateAttendanceReport,
  getDepartmentWiseReport,
  getEmployeeWiseReport,
  getMonthlyAttendanceSummary,
  exportAttendanceData,
} from "../Controller/reportController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";
import { intensiveLimiter } from "../Middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Apply intensive rate limiting to all report routes (resource-heavy operations)
router.use(intensiveLimiter);

// Only superAdmin and attendanceDepartment can generate reports
router.use(hasRole("superAdmin", "attendanceDepartment"));

// Generate attendance report with flexible filters
router.get("/attendance", generateAttendanceReport);

// Department-wise attendance report
router.get("/department-wise", getDepartmentWiseReport);

// Employee-wise attendance report
router.get("/employee-wise", getEmployeeWiseReport);

// Monthly attendance summary
router.get("/monthly-summary", getMonthlyAttendanceSummary);

// Export attendance data
router.get("/export", exportAttendanceData);

export default router;
