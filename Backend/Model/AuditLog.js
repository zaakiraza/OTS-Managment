import mongoose from "mongoose";

/**
 * Audit Log Schema
 * Tracks all significant actions performed in the system
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    performedByName: {
      type: String,
      required: true,
    },
    performedByRole: {
      type: String,
      required: true,
    },

    // What action was performed
    action: {
      type: String,
      required: true,
      enum: [
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
        "LEAVE_APPLIED",
        "LEAVE_APPROVED",
        "LEAVE_REJECTED",
        "LEAVE_CANCELLED",
      ],
    },

    // Which resource/entity was affected
    resourceType: {
      type: String,
      required: true,
      enum: [
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
        "Leave",
      ],
    },

    // The ID of the affected resource
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },

    // Human-readable description
    description: {
      type: String,
      required: true,
    },

    // Before and after values for updates
    changes: {
      before: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      after: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },

    // Request metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      endpoint: String,
      method: String,
    },

    // Status of the action
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },

    // Error details if failed
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// TTL index - automatically delete logs older than 90 days (optional)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;

