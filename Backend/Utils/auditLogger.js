/**
 * Audit Logging Utility
 * Provides functions to log all significant system actions
 * Tracks IP address and request metadata for security
 */

import AuditLog from "../Model/AuditLog.js";

/**
 * Get real IP address from request (handles proxies, load balancers, and various network setups)
 * Returns the actual client IP address, even if it's localhost (for local testing)
 */
const getRealIP = (req) => {
  // Safety check
  if (!req || !req.headers) {
    return 'unknown';
  }
  
  // Priority order for IP extraction:
  // 1. X-Forwarded-For (most common proxy header) - first IP is original client
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip);
    if (ips.length > 0) {
      // Return the first IP (original client)
      // Note: This could be localhost if accessing from same machine, which is correct
      return ips[0];
    }
  }
  
  // 2. X-Real-IP (nginx and other proxies)
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP.trim();
  }
  
  // 3. CF-Connecting-IP (Cloudflare)
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP) {
    return cfIP.trim();
  }
  
  // 4. X-Client-IP (some proxies)
  const clientIP = req.headers['x-client-ip'];
  if (clientIP) {
    return clientIP.trim();
  }
  
  // 5. Express req.ip (works when trust proxy is enabled)
  // This is the most reliable when trust proxy is set
  if (req.ip) {
    // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 -> 192.168.1.1)
    if (req.ip.startsWith('::ffff:')) {
      return req.ip.substring(7);
    }
    return req.ip;
  }
  
  // 6. Connection remote address (fallback - may not work with trust proxy)
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (remoteAddress) {
    // Handle IPv6-mapped IPv4 addresses
    if (remoteAddress.startsWith('::ffff:')) {
      return remoteAddress.substring(7);
    }
    return remoteAddress;
  }
  
  // 7. Last resort
  return "unknown";
};

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
      performedBy: performedBy?._id || performedBy,
      performedByName: performedBy?.name || "System",
      performedByRole: performedBy?.role?.name || performedBy?.role || "System",
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
 * Middleware to extract request metadata including IP
 */
export const extractRequestMetadata = (req) => ({
  ipAddress: getRealIP(req),
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
 * Log asset actions
 */
export const logAssetAction = async (req, action, asset, changes = null) => {
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType: "Asset",
    resourceId: asset._id,
    description: `${action} asset: ${asset.name} (${asset.assetTag || 'No Tag'})`,
    changes,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Log attendance actions
 */
export const logAttendanceAction = async (req, action, attendance, changes = null, description = null) => {
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType: "Attendance",
    resourceId: attendance._id,
    description: description || `${action} attendance record`,
    changes,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Log salary actions
 */
export const logSalaryAction = async (req, action, salary, changes = null, description = null) => {
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType: "Salary",
    resourceId: salary?._id,
    description: description || `${action} salary record`,
    changes,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Log role actions
 */
export const logRoleAction = async (req, action, role, changes = null) => {
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType: "Role",
    resourceId: role._id,
    description: `${action} role: ${role.name}`,
    changes,
    metadata: extractRequestMetadata(req),
  });
};

/**
 * Log import actions
 */
export const logImportAction = async (req, resourceType, description, changes = null) => {
  await createAuditLog({
    performedBy: req.user,
    action: "IMPORT",
    resourceType,
    description,
    changes,
    metadata: extractRequestMetadata(req),
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
 * Log system actions (settings, feedback, todos, etc.)
 */
export const logSystemAction = async (req, action, resource, changes = null, description = null) => {
  const resourceType = resource?.constructor?.modelName || "System";
  const resourceId = resource?._id || null;
  
  await createAuditLog({
    performedBy: req.user,
    action,
    resourceType,
    resourceId,
    description: description || `${action} ${resourceType.toLowerCase()}`,
    changes,
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
  logAssetAction,
  logAttendanceAction,
  logSalaryAction,
  logRoleAction,
  logAuthAction,
  logImportAction,
  logExportAction,
  logSystemAction,
  getAuditLogs,
  extractRequestMetadata,
};

