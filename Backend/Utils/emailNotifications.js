import nodemailer from "nodemailer";
import Settings from "../Model/Settings.js";

// Helper function to create transporter with current settings
const createTransporter = async () => {
  try {
    // Use environment variables directly (no database lookup)
    const emailService = process.env.EMAIL_SERVICE || "gmail";
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;

    // Debug: Log all email-related env variables
    console.log("[Email Debug] Checking environment variables:");
    console.log(`  EMAIL_SERVICE: ${process.env.EMAIL_SERVICE || 'not set (using default: gmail)'}`);
    console.log(`  EMAIL_USER: ${emailUser ? 'SET (length: ' + emailUser.length + ')' : 'NOT SET'}`);
    console.log(`  EMAIL_PASSWORD: ${emailPassword ? 'SET (length: ' + emailPassword.length + ')' : 'NOT SET'}`);

    if (!emailUser || !emailPassword) {
      console.warn("Email credentials not configured in environment variables");
      console.warn("Make sure EMAIL_USER and EMAIL_PASSWORD are set in Backend/.env file");
      return null;
    }

    console.log(`[Email Config] Using email service: ${emailService}, user: ${emailUser}`);

    return nodemailer.createTransport({
      service: emailService,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  } catch (error) {
    console.error("Error creating email transporter:", error);
    return null;
  }
};

// Base email template with OTS theme
export const getEmailTemplate = (content) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OTS Notification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                    OTS Management
                  </h1>
                  <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500;">
                    Your Workspace, Simplified
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); padding: 25px 30px; text-align: center;">
                  <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; line-height: 1.6;">
                    This is an automated notification from OTS.<br>
                    Please do not reply to this email.
                  </p>
                  <p style="margin: 15px 0 0 0; color: rgba(255, 255, 255, 0.7); font-size: 12px;">
                    © ${new Date().getFullYear()} OTS Management. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Helper function to send email
const sendEmail = async (to, subject, htmlContent) => {
  try {
    const transporter = await createTransporter();

    if (!transporter) {
      return {
        success: false,
        error: "Email service not configured. Please configure email settings."
      };
    }

    const emailFromName = process.env.EMAIL_FROM_NAME || await Settings.getValue("emailFromName", "OTS Management");
    const emailUser = process.env.EMAIL_USER;

    const mailOptions = {
      from: `"${emailFromName}" <${emailUser}>`,
      to,
      subject: `[OTS] ${subject}`,
      html: getEmailTemplate(htmlContent),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email sending failed:", error);
    return { success: false, error: error.message };
  }
};

// Notification: Task Assigned
const notifyTaskAssigned = async (userEmail, taskData) => {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #F49040 0%, #EE8939 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        New Task Assignment
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      You have been assigned a new task
    </h2>

    <div style="background: linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%); border-left: 4px solid #1F6A75; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Task Title:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${taskData.title
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Description:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${taskData.description
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Priority:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: ${taskData.priority === "High"
      ? "#fef3c7"
      : taskData.priority === "Medium"
        ? "#dbeafe"
        : "#f3f4f6"
    }; color: ${taskData.priority === "High"
      ? "#92400e"
      : taskData.priority === "Medium"
        ? "#1e40af"
        : "#374151"
    };">
              ${taskData.priority}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Due Date:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${new Date(
      taskData.dueDate
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://managment.offtheschool.io/tasks" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        View Task Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Please review the task details and start working on it at your earliest convenience.
    </p>
  `;

  return await sendEmail(userEmail, "New Task Assigned", content);
};

// Notification: Ticket Created Against User
const notifyTicketCreatedAgainst = async (userEmail, ticketData) => {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #F49040 0%, #EE8939 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Ticket Reported
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      A ticket has been reported against you
    </h2>

    <div style="background: linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%); border-left: 4px solid #1F6A75; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Ticket ID:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">#${ticketData.ticketId
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Subject:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${ticketData.subject
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Description:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${ticketData.description
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Reported By:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${ticketData.reportedBy
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Priority:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: ${ticketData.priority === "High"
      ? "#fef3c7"
      : ticketData.priority === "Medium"
        ? "#dbeafe"
        : "#f3f4f6"
    }; color: ${ticketData.priority === "High"
      ? "#92400e"
      : ticketData.priority === "Medium"
        ? "#1e40af"
        : "#374151"
    };">
              ${ticketData.priority}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://managment.offtheschool.io/tickets/${ticketData.ticketId
    }" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        View Ticket Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Please review the ticket and provide your response at the earliest.
    </p>
  `;

  return await sendEmail(
    userEmail,
    `Ticket #${ticketData.ticketId} Reported`,
    content
  );
};

// Notification: Ticket Resolved
const notifyTicketResolved = async (userEmail, ticketData) => {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Ticket Resolved
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      Your ticket has been resolved
    </h2>

    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%); border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Ticket ID:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">#${ticketData.ticketId
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Subject:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${ticketData.subject
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Resolution:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${ticketData.resolution ||
    "The issue has been addressed and resolved."
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Resolved By:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${ticketData.resolvedBy
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Status:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: #d1fae5; color: #065f46;">
              Resolved
            </span>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://managment.offtheschool.io/tickets/${ticketData.ticketId
    }" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        View Resolution Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      If you have any further concerns, please feel free to create a new ticket.
    </p>
  `;

  return await sendEmail(
    userEmail,
    `Ticket #${ticketData.ticketId} Resolved`,
    content
  );
};

// Notification: Task Status Change
const notifyTaskStatusChange = async (userEmail, taskData) => {
  const statusColors = {
    "To Do": { bg: "#f3f4f6", color: "#374151" },
    "In Progress": { bg: "#dbeafe", color: "#1e40af" },
    Completed: { bg: "#d1fae5", color: "#065f46" },
    "On Hold": { bg: "#fef3c7", color: "#92400e" },
  };

  const statusColor = statusColors[taskData.status] || statusColors["To Do"];

  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #F49040 0%, #EE8939 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Task Status Update
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      Task status has been updated
    </h2>

    <div style="background: linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%); border-left: 4px solid #1F6A75; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Task Title:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${taskData.title
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">New Status:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: ${statusColor.bg
    }; color: ${statusColor.color};">
              ${taskData.status}
            </span>
          </td>
        </tr>
        ${taskData.comment
      ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Comment:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${taskData.comment}</td>
        </tr>
        `
      : ""
    }
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Updated By:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${taskData.updatedBy
    }</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://managment.offtheschool.io/tasks/${taskData.taskId
    }" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        View Task Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Keep track of your tasks and stay updated with the latest progress.
    </p>
  `;

  return await sendEmail(
    userEmail,
    `Task Status Updated: ${taskData.title}`,
    content
  );
};

// Notification: Ticket Comment
const notifyTicketComment = async (userEmail, commentData) => {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #F49040 0%, #EE8939 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        New Comment
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      New comment on your ticket
    </h2>

    <div style="background: linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%); border-left: 4px solid #1F6A75; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Ticket ID:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">#${commentData.ticketId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Subject:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${commentData.ticketSubject}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Commented By:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${commentData.commentedBy}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Comment:
      </p>
      <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
        ${commentData.comment}
      </p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://managment.offtheschool.io/tickets/${commentData.ticketId}" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        View Full Conversation
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Click the button above to view the ticket and respond to the comment.
    </p>
  `;

  return await sendEmail(
    userEmail,
    `New Comment on Ticket #${commentData.ticketId}`,
    content
  );
};

// Notification: Password Changed
const notifyPasswordChanged = async (userEmail, userData) => {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #F49040 0%, #EE8939 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Security Alert
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      Your password has been changed
    </h2>

    <div style="background: linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%); border-left: 4px solid #1F6A75; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
        This is a confirmation that your password for <strong>${userData.email
    }</strong> was successfully changed on ${new Date().toLocaleString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    )}.
      </p>
    </div>

    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="margin: 0 0 12px 0; color: #92400e; font-size: 14px; font-weight: 600;">
        ⚠️ Didn't make this change?
      </p>
      <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6;">
        If you did not change your password, please contact Attendance Department immediately as your account may be compromised.
      </p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://managment.offtheschool.io/login" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        Go to Login
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      For security reasons, please keep your password confidential and change it regularly.
    </p>
  `;

  return await sendEmail(userEmail, "Password Changed Successfully", content);
};

// Notification: Team Lead Assignment
const notifyTeamLeadAssignment = async (userEmail, teamData) => {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #F49040 0%, #EE8939 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        New Assignment
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      You've been assigned as Team Lead
    </h2>

    <div style="background: linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%); border-left: 4px solid #1F6A75; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Department:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${teamData.departmentName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Role:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background: linear-gradient(135deg, #F49040 0%, #EE8939 100%); color: #ffffff;">
              Team Lead
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Assigned By:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${teamData.assignedBy}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="margin: 0 0 12px 0; color: #093635; font-size: 14px; font-weight: 600;">
        Your new responsibilities include:
      </p>
      <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
        <li>Managing and coordinating team activities</li>
        <li>Assigning tasks to team members</li>
        <li>Monitoring team performance and progress</li>
        <li>Reporting to department management</li>
      </ul>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://managment.offtheschool.io/my-tasks" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        Go to My Tasks
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Congratulations on your new role! We're confident in your leadership abilities.
    </p>
  `;

  return await sendEmail(userEmail, "Team Lead Assignment", content);
};

// Notification: Employee Created
const notifyEmployeeCreated = async (userEmail, employeeData) => {
  const content = `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Welcome to OTS
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      Your account has been created
    </h2>

    <div style="background: linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%); border-left: 4px solid #1F6A75; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Name:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${employeeData.name
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Email:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${employeeData.email
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Employee ID:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${employeeData.employeeId
    }</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Department:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${employeeData.department
    }</td>
        </tr>
        ${employeeData.tempPassword
      ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Temporary Password:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600; font-family: monospace; background-color: #f3f4f6; padding: 8px; border-radius: 4px;">${employeeData.tempPassword}</td>
        </tr>
        `
      : ""
    }
      </table>
    </div>

    ${employeeData.tempPassword
      ? `
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">
        🔒 Important Security Notice
      </p>
      <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6;">
        Please change your temporary password immediately after logging in. Keep your credentials confidential and never share them with anyone.
      </p>
    </div>
    `
      : ""
    }

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://managment.offtheschool.io/login" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        Login to Your Account
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Welcome to the team! We're excited to have you on board.
    </p>
  `;

  const result = await sendEmail(
    userEmail,
    "Welcome to OTS Management",
    content
  );

  if (!result.success) {
    console.error(`[notifyEmployeeCreated] Email failed for ${userEmail}:`, result.error);
  }

  return result;
};

export {
  notifyTaskAssigned,
  notifyTicketCreatedAgainst,
  notifyTicketResolved,
  notifyTaskStatusChange,
  notifyTicketComment,
  notifyPasswordChanged,
  notifyTeamLeadAssignment,
  notifyEmployeeCreated,
};
