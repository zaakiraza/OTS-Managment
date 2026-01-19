import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { notificationAPI } from "../Config/Api";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await notificationAPI.getUnreadCount();
      if (response.data.success) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, []);

  // Fetch all notifications
  const fetchNotifications = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      const response = await notificationAPI.getAll(params);
      if (response.data.success) {
        setNotifications(response.data.data);
        // Update unread count from the response if available
        if (response.data.unreadCount !== undefined) {
          setUnreadCount(response.data.unreadCount);
        }
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      const response = await notificationAPI.markAsRead(id);
      if (response.data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await notificationAPI.markAllAsRead();
      if (response.data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  }, []);

  // Delete single notification
  const deleteNotification = useCallback(async (id) => {
    try {
      const response = await notificationAPI.delete(id);
      if (response.data.success) {
        const notification = notifications.find((n) => n._id === id);
        if (notification && !notification.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        setNotifications((prev) => prev.filter((n) => n._id !== id));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }, [notifications]);

  // Delete all read notifications
  const deleteAllRead = useCallback(async () => {
    try {
      const response = await notificationAPI.deleteAllRead();
      if (response.data.success) {
        setNotifications((prev) => prev.filter((n) => !n.isRead));
      }
    } catch (error) {
      console.error("Error deleting read notifications:", error);
    }
  }, []);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Refresh notifications when unreadCount changes
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token && unreadCount > 0) {
      // Only fetch notifications if we have unread ones
    }
  }, [unreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

export default NotificationContext;
