import express from "express";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} from "../Controller/notificationController.js";
import { verifyToken } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get notifications for current user
router.get("/", getMyNotifications);

// Get unread count
router.get("/unread-count", getUnreadCount);

// Mark all as read
router.put("/mark-all-read", markAllAsRead);

// Delete all read notifications
router.delete("/read", deleteAllRead);

// Mark single notification as read
router.put("/:id/read", markAsRead);

// Delete single notification
router.delete("/:id", deleteNotification);

export default router;
