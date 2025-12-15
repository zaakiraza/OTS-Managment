/**
 * Email Notification Service
 * Handles all email notifications for the system
 */

import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Get email credentials (support both EMAIL_* and MAIL_* env vars)
const getEmailUser = () => process.env.EMAIL_USER || process.env.MAIL_USER;
const getEmailPass = () => process.env.EMAIL_PASS || process.env.MAIL_PASS;

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.MAIL_SERVICE || "Gmail",
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT || 587,
    secure: process.env.MAIL_SECURE === "true",
    auth: {
      user: getEmailUser(),
      pass: getEmailPass(),
    },
  });
};

// Check if email is configured
const isEmailConfigured = () => {
  return getEmailUser() && getEmailPass();
};

// Base email template
const getEmailTemplate = (content, title) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    .btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
    .alert-box { padding: 15px; border-radius: 8px; margin: 15px 0; }
    .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; color: #92400e; }
    .alert-info { background: #dbeafe; border-left: 4px solid #3b82f6; color: #1e40af; }
    .alert-success { background: #d1fae5; border-left: 4px solid #10b981; color: #065f46; }
    .alert-danger { background: #fee2e2; border-left: 4px solid #ef4444; color: #991b1b; }
    .meta { color: #64748b; font-size: 14px; }
    .priority-high { color: #ef4444; font-weight: bold; }
    .priority-critical { color: #7c3aed; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Attendance Management System</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated notification. Please do not reply to this email.</p>
      <p>© ${new Date().getFullYear()} Your Organization</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Send email wrapper with error handling
 */
const sendEmail = async (to, subject, htmlContent) => {
  if (!isEmailConfigured()) {
    console.log("Email not configured - skipping notification to:", to);
    return { success: false, reason: "Email not configured" };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"AMS Notifications" <${getEmailUser()}>`,
      to,
      subject: `[AMS] ${subject}`,
      html: htmlContent,
    });
    console.log("Email sent successfully to:", to);
    return { success: true };
  } catch (error) {
    console.error("Email sending failed:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Notify when a task is assigned to an employee
 */
export const notifyTaskAssigned = async (employee, task, assignedBy) => {
  const priorityClass = ["High", "Critical"].includes(task.priority) 
    ? `priority-${task.priority.toLowerCase()}` 
    : "";

  const content = `
    <h2>📋 New Task Assigned to You</h2>
    <div class="alert-box alert-info">
      <strong>${task.title}</strong>
    </div>
    <p>${task.description || "No description provided."}</p>
    <table style="width: 100%; margin: 20px 0;">
      <tr><td class="meta">Priority:</td><td class="${priorityClass}">${task.priority}</td></tr>
      <tr><td class="meta">Due Date:</td><td>${new Date(task.dueDate).toLocaleDateString()}</td></tr>
      <tr><td class="meta">Department:</td><td>${task.department?.name || "N/A"}</td></tr>
      <tr><td class="meta">Assigned By:</td><td>${assignedBy?.name || "System"}</td></tr>
    </table>
    <p>Please log in to the system to view task details and update its status.</p>
  `;

  return sendEmail(
    employee.email,
    `New Task Assigned: ${task.title}`,
    getEmailTemplate(content, "New Task Assigned")
  );
};

/**
 * Notify when a ticket is created against an employee
 */
export const notifyTicketCreatedAgainst = async (employee, ticket, reportedBy) => {
  const content = `
    <h2>⚠️ A Ticket Has Been Reported Against You</h2>
    <div class="alert-box alert-warning">
      <strong>Ticket ID:</strong> ${ticket.ticketId}<br>
      <strong>Title:</strong> ${ticket.title}
    </div>
    <table style="width: 100%; margin: 20px 0;">
      <tr><td class="meta">Category:</td><td>${ticket.category}</td></tr>
      <tr><td class="meta">Priority:</td><td>${ticket.priority}</td></tr>
      <tr><td class="meta">Reported By:</td><td>${reportedBy?.name || "Anonymous"}</td></tr>
      <tr><td class="meta">Date:</td><td>${new Date().toLocaleDateString()}</td></tr>
    </table>
    <p>Please log in to the system to view the full ticket details and respond if necessary.</p>
  `;

  return sendEmail(
    employee.email,
    `Ticket Reported Against You: ${ticket.ticketId}`,
    getEmailTemplate(content, "Ticket Notification")
  );
};

/**
 * Notify when a ticket is resolved
 */
export const notifyTicketResolved = async (employee, ticket, resolvedBy) => {
  const content = `
    <h2>✅ Your Ticket Has Been Resolved</h2>
    <div class="alert-box alert-success">
      <strong>Ticket ID:</strong> ${ticket.ticketId}<br>
      <strong>Title:</strong> ${ticket.title}
    </div>
    <table style="width: 100%; margin: 20px 0;">
      <tr><td class="meta">Status:</td><td>Resolved</td></tr>
      <tr><td class="meta">Resolved By:</td><td>${resolvedBy?.name || "System"}</td></tr>
      <tr><td class="meta">Resolved On:</td><td>${new Date().toLocaleDateString()}</td></tr>
    </table>
    <p>If you have any further questions or the issue persists, please create a new ticket.</p>
  `;

  return sendEmail(
    employee.email,
    `Ticket Resolved: ${ticket.ticketId}`,
    getEmailTemplate(content, "Ticket Resolved")
  );
};

/**
 * Notify when task status is updated
 */
export const notifyTaskStatusChange = async (assignedBy, task, newStatus, changedBy) => {
  const statusColors = {
    "todo": "alert-info",
    "in-progress": "alert-warning",
    "completed": "alert-success",
  };

  const content = `
    <h2>📋 Task Status Updated</h2>
    <div class="alert-box ${statusColors[newStatus] || 'alert-info'}">
      <strong>${task.title}</strong> is now <strong>${newStatus.replace("-", " ").toUpperCase()}</strong>
    </div>
    <table style="width: 100%; margin: 20px 0;">
      <tr><td class="meta">Updated By:</td><td>${changedBy?.name || "System"}</td></tr>
      <tr><td class="meta">New Status:</td><td>${newStatus.replace("-", " ")}</td></tr>
      <tr><td class="meta">Updated On:</td><td>${new Date().toLocaleString()}</td></tr>
    </table>
  `;

  return sendEmail(
    assignedBy.email,
    `Task Status Updated: ${task.title}`,
    getEmailTemplate(content, "Task Status Update")
  );
};

/**
 * Notify when a comment is added to a ticket
 */
export const notifyTicketComment = async (employee, ticket, comment, commentedBy) => {
  const content = `
    <h2>💬 New Comment on Your Ticket</h2>
    <div class="alert-box alert-info">
      <strong>Ticket ID:</strong> ${ticket.ticketId}<br>
      <strong>Title:</strong> ${ticket.title}
    </div>
    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-style: italic;">"${comment}"</p>
      <p class="meta" style="margin: 10px 0 0 0;">— ${commentedBy?.name || "Someone"}</p>
    </div>
  `;

  return sendEmail(
    employee.email,
    `New Comment on Ticket: ${ticket.ticketId}`,
    getEmailTemplate(content, "Ticket Comment")
  );
};

/**
 * Send password reset notification
 */
export const notifyPasswordChanged = async (employee) => {
  const content = `
    <h2>🔐 Password Changed Successfully</h2>
    <div class="alert-box alert-success">
      Your password has been successfully changed.
    </div>
    <p>If you did not make this change, please contact your administrator immediately.</p>
    <table style="width: 100%; margin: 20px 0;">
      <tr><td class="meta">Changed On:</td><td>${new Date().toLocaleString()}</td></tr>
      <tr><td class="meta">Account:</td><td>${employee.email}</td></tr>
    </table>
  `;

  return sendEmail(
    employee.email,
    "Your Password Has Been Changed",
    getEmailTemplate(content, "Password Changed")
  );
};

/**
 * Notify when assigned as team lead
 */
export const notifyTeamLeadAssignment = async (employee, department) => {
  const content = `
    <h2>🎉 You Have Been Assigned as Team Lead</h2>
    <div class="alert-box alert-success">
      <strong>Department:</strong> ${department.name}
    </div>
    <p>Congratulations! You have been assigned as the Team Lead for the ${department.name} department.</p>
    <p>As a Team Lead, you can now:</p>
    <ul>
      <li>Create and assign tasks to team members</li>
      <li>View and manage department resources</li>
      <li>Monitor team performance</li>
    </ul>
  `;

  return sendEmail(
    employee.email,
    `You are now Team Lead of ${department.name}`,
    getEmailTemplate(content, "Team Lead Assignment")
  );
};

export default {
  notifyTaskAssigned,
  notifyTicketCreatedAgainst,
  notifyTicketResolved,
  notifyTaskStatusChange,
  notifyTicketComment,
  notifyPasswordChanged,
  notifyTeamLeadAssignment,
};

