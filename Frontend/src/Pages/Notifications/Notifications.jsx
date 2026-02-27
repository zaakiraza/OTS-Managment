import { useState, useEffect } from "react";
import Sidebar from "../../Components/SideBar/SideBar";
import { useNotifications } from "../../Context/NotificationContext";
import { useToast } from "../../Components/Common/Toast/Toast";
import { useNavigate } from "react-router-dom";
import "./Notifications.css";

const Notifications = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
  } = useNotifications();

  const [filter, setFilter] = useState("unread"); // all, unread, read

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "read") return n.isRead;
    return true;
  });

  const getNotificationIcon = (type) => {
    const iconMap = {
      leave_applied: "fa-calendar-plus",
      leave_approved: "fa-calendar-check",
      leave_rejected: "fa-calendar-xmark",
      leave_cancelled: "fa-calendar-minus",
      task_assigned: "fa-clipboard-list",
      task_status_changed: "fa-arrows-rotate",
      task_completed: "fa-circle-check",
      task_updated: "fa-pen-to-square",
      task_comment: "fa-comment",
      ticket_created: "fa-ticket",
      ticket_assigned: "fa-user-tag",
      ticket_resolved: "fa-check-double",
      ticket_comment: "fa-comments",
      asset_assigned: "fa-laptop",
      asset_returned: "fa-box-archive",
      attendance_marked: "fa-fingerprint",
      attendance_updated: "fa-clock-rotate-left",
      salary_generated: "fa-money-bill-wave",
      feedback_received: "fa-star",
      announcement: "fa-bullhorn",
      system: "fa-gear",
      general: "fa-bell",
      department_created: "fa-building",
      department_updated: "fa-building-circle-arrow-right",
      employee_created: "fa-user-plus",
      employee_updated: "fa-user-pen",
      password_changed: "fa-key",
    };
    return iconMap[type] || "fa-bell";
  };

  const getTypeColor = (type) => {
    const colorMap = {
      leave_applied: "#1F6A75",
      leave_approved: "#2ecc71",
      leave_rejected: "#e74c3c",
      leave_cancelled: "#95a5a6",
      task_assigned: "#9b59b6",
      task_status_changed: "#3498db",
      task_completed: "#27ae60",
      task_updated: "#f39c12",
      task_comment: "#e67e22",
      ticket_created: "#e67e22",
      ticket_assigned: "#8e44ad",
      ticket_resolved: "#1abc9c",
      ticket_comment: "#f39c12",
      asset_assigned: "#8e44ad",
      asset_returned: "#16a085",
      attendance_marked: "#3498db",
      attendance_updated: "#2980b9",
      salary_generated: "#27ae60",
      feedback_received: "#f1c40f",
      announcement: "#2980b9",
      system: "#7f8c8d",
      general: "#1F6A75",
      department_created: "#1F6A75",
      department_updated: "#16a085",
      employee_created: "#9b59b6",
      employee_updated: "#8e44ad",
      password_changed: "#e74c3c",
    };
    return colorMap[type] || "#1F6A75";
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

    // Navigate based on notification type (more specific than referenceType)
    const type = notification.type;
    const rawRef =
      notification?.data?.referenceId ??
      notification?.referenceId ??
      notification?.data?.extra?.taskId;
    const taskIdParam =
      rawRef != null
        ? typeof rawRef === "object" && rawRef.$oid
          ? rawRef.$oid
          : String(rawRef)
        : null;

    // Deep-link task comments to open specific task with comments focused
    if (type === "task_comment" && taskIdParam) {
      navigate(`/my-tasks?taskId=${taskIdParam}&focus=comments`);
      return;
    }

    // Task notifications: navigate to my-tasks and open that task's modal
    const taskTypes = ["task_assigned", "task_status_changed", "task_completed", "task_updated"];
    if (taskTypes.includes(type) && taskIdParam) {
      navigate(`/my-tasks?taskId=${taskIdParam}`);
      return;
    }
    
    // Route map based on notification type
    const routeMap = {
      // Leave notifications - admins go to leave-approval, employees go to my-attendance
      leave_applied: "/leave-approval",
      leave_approved: "/my-attendance",
      leave_rejected: "/my-attendance",
      leave_cancelled: "/my-attendance",
      // Task notifications (fallback when no referenceId)
      task_assigned: "/my-tasks",
      task_status_changed: "/my-tasks",
      task_completed: "/my-tasks",
      task_updated: "/my-tasks",
      task_comment: "/my-tasks",
      // Ticket notifications
      ticket_created: "/tickets",
      ticket_assigned: "/tickets",
      ticket_resolved: "/tickets",
      ticket_comment: "/tickets",
      // Asset notifications
      asset_assigned: "/my-assets",
      asset_returned: "/my-assets",
      // Attendance notifications
      attendance_marked: "/my-attendance",
      attendance_updated: "/my-attendance",
      attendance_justification: "/attendance-justifications",
      justification_reviewed: "/my-attendance",
      // Department notifications
      department_created: "/department",
      department_updated: "/department",
      // Employee notifications
      employee_created: "/employees",
      employee_updated: "/employees",
      // Other
      salary_generated: "/salaries",
      feedback_received: "/feedback",
      password_changed: "/profile",
    };

    if (routeMap[type]) {
      if (type === "leave_approved") {
        navigate(routeMap[type], { state: { defaultStatus: "approved" } });
      } else {
        navigate(routeMap[type]);
      }
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    showToast("All notifications marked as read", "success");
  };

  const handleDeleteAllRead = async () => {
    await deleteAllRead();
    showToast("All read notifications deleted", "success");
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteNotification(id);
    showToast("Notification deleted", "success");
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <div className="notifications-page">
          <div className="notifications-hero">
            <div className="hero-background">
              <div className="hero-shape shape-1"></div>
              <div className="hero-shape shape-2"></div>
              <div className="hero-shape shape-3"></div>
            </div>
            <div className="hero-content">
              <div className="hero-icon">
                <i className="fas fa-bell"></i>
                {unreadCount > 0 && <span className="hero-badge">{unreadCount}</span>}
              </div>
              <div className="hero-text">
                <h1>Notifications</h1>
                <p>Stay updated with your activities</p>
              </div>
            </div>
            <div className="hero-actions">
              <button
                className="btn-hero btn-mark-all"
                onClick={handleMarkAllRead}
                disabled={!notifications.some((n) => !n.isRead)}
              >
                <i className="fas fa-check-double"></i>
                <span>Mark All Read</span>
              </button>
              <button
                className="btn-hero btn-clear"
                onClick={handleDeleteAllRead}
                disabled={!notifications.some((n) => n.isRead)}
              >
                <i className="fas fa-trash-alt"></i>
                <span>Clear Read</span>
              </button>
            </div>
          </div>

          <div className="notifications-filters">
            <button
              className={`filter-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              <i className="fas fa-inbox"></i>
              <span className="filter-label">All</span>
              <span className="filter-count">{notifications.length}</span>
            </button>
            <button
              className={`filter-tab unread-tab ${filter === "unread" ? "active" : ""}`}
              onClick={() => setFilter("unread")}
            >
              <i className="fas fa-envelope"></i>
              <span className="filter-label">Unread</span>
              <span className="filter-count unread">{notifications.filter((n) => !n.isRead).length}</span>
            </button>
            <button
              className={`filter-tab ${filter === "read" ? "active" : ""}`}
              onClick={() => setFilter("read")}
            >
              <i className="fas fa-envelope-open"></i>
              <span className="filter-label">Read</span>
              <span className="filter-count">{notifications.filter((n) => n.isRead).length}</span>
            </button>
          </div>

          <div className="notifications-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-illustration">
                  <div className="empty-bell">
                    <i className="fas fa-bell-slash"></i>
                  </div>
                  <div className="empty-circles">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
                <h3>{filter === "unread" ? "You're all caught up!" : "No notifications yet"}</h3>
                <p>
                  {filter === "unread"
                    ? "Great job! You've read all your notifications."
                    : "When you receive notifications, they'll appear here."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification, index) => (
                <div
                  key={notification._id}
                  className={`notification-card ${!notification.isRead ? "unread" : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="card-accent" style={{ background: getTypeColor(notification.type) }}></div>
                  <div className="card-content">
                    <div
                      className="notification-icon"
                      style={{ 
                        background: `linear-gradient(135deg, ${getTypeColor(notification.type)}20 0%, ${getTypeColor(notification.type)}40 100%)`,
                        color: getTypeColor(notification.type)
                      }}
                    >
                      <i className={`fas ${getNotificationIcon(notification.type)}`}></i>
                    </div>
                    <div className="notification-body">
                      <div className="notification-header">
                        <h4>{notification.title}</h4>
                        {!notification.isRead && <span className="new-badge">NEW</span>}
                      </div>
                      <p className="notification-message">{notification.message}</p>
                      <div className="notification-footer">
                        <span className="notification-time">
                          <i className="far fa-clock"></i>
                          {formatTime(notification.createdAt)}
                        </span>
                        <span className="notification-type">{notification.type.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div className="notification-actions">
                      <button
                        className="btn-action-icon"
                        onClick={(e) => handleDelete(e, notification._id)}
                        title="Delete"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
