import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "leave_applied",
        "leave_approved",
        "leave_rejected",
        "leave_cancelled",
        "ticket_created",
        "ticket_assigned",
        "ticket_resolved",
        "ticket_comment",
        "task_assigned",
        "task_updated",
        "task_completed",
        "task_comment",
        "task_status_changed",
        "attendance_marked",
        "attendance_updated",
        "asset_assigned",
        "asset_returned",
        "salary_generated",
        "feedback_received",
        "announcement",
        "system",
        "general",
        "department_created",
        "department_updated",
        "employee_created",
        "employee_updated",
        "password_changed",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      // Reference ID for the related entity
      referenceId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      // Type of entity (leave, ticket, task, etc.)
      referenceType: {
        type: String,
        enum: ["Leave", "Ticket", "Task", "Attendance", "Asset", "Salary", "Feedback", "Employee"],
      },
      // Additional data as needed
      extra: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Static method to create notification
notificationSchema.statics.createNotification = async function ({
  recipient,
  type,
  title,
  message,
  referenceId,
  referenceType,
  extra,
  sender,
}) {
  return await this.create({
    recipient,
    type,
    title,
    message,
    data: {
      referenceId,
      referenceType,
      extra,
    },
    sender,
  });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (recipientId) {
  return await this.countDocuments({ recipient: recipientId, isRead: false });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function (recipientId) {
  return await this.updateMany(
    { recipient: recipientId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
