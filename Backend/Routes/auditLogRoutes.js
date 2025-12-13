/**
 * Audit Log Routes
 * Provides access to system audit logs
 */

import express from "express";
import { verifyToken, hasRole } from "../Middleware/auth.js";
import { getAuditLogs } from "../Utils/auditLogger.js";

const router = express.Router();

// All routes require authentication and superAdmin role
router.use(verifyToken);
router.use(hasRole("superAdmin"));

/**
 * GET /api/audit-logs
 * Get audit logs with filtering and pagination
 */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      resourceType,
      performedBy,
      startDate,
      endDate,
      status,
    } = req.query;

    const filters = {};
    if (action) filters.action = action;
    if (resourceType) filters.resourceType = resourceType;
    if (performedBy) filters.performedBy = performedBy;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (status) filters.status = status;

    const result = await getAuditLogs(
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/audit-logs/actions
 * Get list of available action types
 */
router.get("/actions", (req, res) => {
  const actions = [
    "CREATE",
    "UPDATE",
    "DELETE",
    "LOGIN",
    "LOGOUT",
    "PASSWORD_CHANGE",
    "STATUS_CHANGE",
    "ASSIGN",
    "UNASSIGN",
    "EXPORT",
    "IMPORT",
    "UPLOAD",
    "DOWNLOAD",
  ];

  res.status(200).json({
    success: true,
    data: actions,
  });
});

/**
 * GET /api/audit-logs/resource-types
 * Get list of available resource types
 */
router.get("/resource-types", (req, res) => {
  const resourceTypes = [
    "Employee",
    "Department",
    "Task",
    "Ticket",
    "Asset",
    "Attendance",
    "Salary",
    "Role",
    "Resource",
    "System",
  ];

  res.status(200).json({
    success: true,
    data: resourceTypes,
  });
});

export default router;

