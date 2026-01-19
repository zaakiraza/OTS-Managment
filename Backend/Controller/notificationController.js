import Notification from "../Model/Notification.js";
import Employee from "../Model/Employee.js";
import logger from "../Utils/logger.js";

// Get notifications for current user
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const filter = { recipient: userId };
    if (unreadOnly === "true") {
      filter.isRead = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(filter)
      .populate("sender", "name employeeId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error(`Error fetching notifications: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get unread notification count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await Notification.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    logger.error(`Error fetching unread count: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error(`Error marking notification as read: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    logger.error(`Error marking all as read: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    logger.error(`Error deleting notification: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete all read notifications
export const deleteAllRead = async (req, res) => {
  try {
    const userId = req.user._id;
    
    await Notification.deleteMany({
      recipient: userId,
      isRead: true,
    });

    res.status(200).json({
      success: true,
      message: "All read notifications deleted",
    });
  } catch (error) {
    logger.error(`Error deleting read notifications: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper function to create notifications (used by other controllers)
export const createNotification = async ({
  recipient,
  type,
  title,
  message,
  referenceId,
  referenceType,
  extra,
  sender,
}) => {
  try {
    // Don't create notification if sender and recipient are the same
    if (sender && recipient && sender.toString() === recipient.toString()) {
      return null;
    }

    const notification = await Notification.createNotification({
      recipient,
      type,
      title,
      message,
      referenceId,
      referenceType,
      extra,
      sender,
    });

    return notification;
  } catch (error) {
    logger.error(`Error creating notification: ${error.message}`);
    return null;
  }
};

// Bulk create notifications for multiple recipients
export const createBulkNotifications = async ({
  recipients,
  type,
  title,
  message,
  referenceId,
  referenceType,
  extra,
  sender,
}) => {
  try {
    const notifications = recipients
      .filter((recipientId) => {
        // Don't create notification if sender and recipient are the same
        return !sender || sender.toString() !== recipientId.toString();
      })
      .map((recipientId) => ({
        recipient: recipientId,
        type,
        title,
        message,
        data: {
          referenceId,
          referenceType,
          extra,
        },
        sender,
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    return notifications.length;
  } catch (error) {
    logger.error(`Error creating bulk notifications: ${error.message}`);
    return 0;
  }
};
