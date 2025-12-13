/**
 * Audit Logging Utility
 * Provides functions to log all significant system actions
 */

import AuditLog from "../Model/AuditLog.js";

/**
 * Create an audit log entry
 * @param {Object} logData - The audit log data
 */
export const createAuditLog = async (logData) => {
  try {
    const {
      performedBy,
      action,
      resourceType,
      resourceId,
      description,
      changes,
      metadata,
      status = "success",
      errorMessage,
    } = logData;

    await AuditLog.create({
      performedBy: performedBy._id || performedBy,
      performedByName: performedBy.name || "System",
      performedByRole: performedBy.role?.name || performedBy.role || "System",
      action,
      resourceType,
      resourceId,
      description,
      changes,
      metadata,
      status,
      errorMessage,
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main operation
    console.error("Audit log creation failed:", error.message);
  }
};

/**
 * Middleware to extract request metadata
 */
export const extractRequestMetadata = (req) => ({
  ipAddress: req.ip || req.connection?.remoteAddress || "unknown",
  userAgent: req.get("User-Agent") || "unknown",
  endpoint: req.originalUrl,
  method: req.method,
});

/**
 * Log employee actions
 */
export const logEmployeeAction = async (req, action, employee, changes = null) => {
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType: "Employee",
    resourceId: employee._id,
    description: `${action} employee: ${employee.name} (${employee.employeeId})`,
    changes,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Log department actions
 */
export const logDepartmentAction = async (req, action, department, changes = null) => {
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType: "Department",
    resourceId: department._id,
    description: `${action} department: ${department.name}`,
    changes,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Log task actions
 */
export const logTaskAction = async (req, action, task, changes = null) => {
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType: "Task",
    resourceId: task._id,
    description: `${action} task: ${task.title}`,
    changes,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Log ticket actions
 */
export const logTicketAction = async (req, action, ticket, changes = null) => {
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType: "Ticket",
    resourceId: ticket._id,
    description: `${action} ticket: ${ticket.ticketId} - ${ticket.title}`,
    changes,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Log authentication actions
 */
export const logAuthAction = async (req, action, user, success = true, errorMessage = null) => {
  await createAuditLog({
    performedBy: user || { _id: null, name: "Anonymous", role: "Unknown" },
    action,
    resourceType: "System",
    resourceId: user?._id,
    description: `${action}: ${user?.email || "Unknown user"}`,
    metadata: extractRequestMetadata(req),
    status: success ? "success" : "failed",
    errorMessage,
  });
};

/**
 * Log export actions
 */
export const logExportAction = async (req, resourceType, description) => {
  await createAuditLog({
    performedBy: req.user,
    action: "EXPORT",
    resourceType,
    description,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Get audit logs with filtering and pagination
 */
export const getAuditLogs = async (filters = {}, page = 1, limit = 50) => {
  const query = {};

  if (filters.performedBy) query.performedBy = filters.performedBy;
  if (filters.action) query.action = filters.action;
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.resourceId) query.resourceId = filters.resourceId;
  if (filters.status) query.status = filters.status;

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate("performedBy", "name email employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    data: logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export default {
  createAuditLog,
  logEmployeeAction,
  logDepartmentAction,
  logTaskAction,
  logTicketAction,
  logAuthAction,
  logExportAction,
  getAuditLogs,
  extractRequestMetadata,
};

