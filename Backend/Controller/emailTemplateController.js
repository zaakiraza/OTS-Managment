import {
  notifyTaskAssigned,
  notifyTicketCreatedAgainst,
  notifyTicketResolved,
  notifyTaskStatusChange,
  notifyTicketComment,
  notifyPasswordChanged,
  notifyTeamLeadAssignment,
  notifyEmployeeCreated,
  getEmailTemplate,
} from '../Utils/emailNotifications.js';

// Sample data for previews
const getSampleData = (templateId) => {
  const samples = {
    'task-assigned': {
      userEmail: 'preview@example.com',
      taskData: {
        title: 'Implement User Dashboard',
        description: 'Create a comprehensive dashboard showing user statistics, recent activities, and key metrics with real-time updates.',
        priority: 'High',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      }
    },
    'ticket-created': {
      userEmail: 'preview@example.com',
      ticketData: {
        ticketId: 'TCK-12345',
        subject: 'System Performance Issue',
        description: 'The application is running slowly during peak hours. Users are experiencing significant delays in page load times.',
        reportedBy: 'John Smith - Senior Manager',
        priority: 'High',
      }
    },
    'ticket-resolved': {
      userEmail: 'preview@example.com',
      ticketData: {
        ticketId: 'TCK-12345',
        subject: 'System Performance Issue',
        resolution: 'Optimized database queries and added Redis caching layer. Performance improved by 60%. All tests passed successfully.',
        resolvedBy: 'Jane Doe - Senior Developer',
      }
    },
    'task-status-change': {
      userEmail: 'preview@example.com',
      taskData: {
        taskId: 'TSK-789',
        title: 'Implement User Dashboard',
        status: 'In Progress',
        comment: 'Started working on the frontend components. Backend API endpoints are ready and tested. Expected completion by Friday.',
        updatedBy: 'Sarah Johnson - Frontend Developer',
      }
    },
    'ticket-comment': {
      userEmail: 'preview@example.com',
      commentData: {
        ticketId: 'TCK-12345',
        ticketSubject: 'System Performance Issue',
        commentedBy: 'Mike Wilson - DevOps Engineer',
        comment: 'I have reviewed the logs and identified the bottleneck. The issue is in the database connection pool. I recommend increasing the pool size from 10 to 25 and implementing connection reuse strategies. This should resolve the performance degradation.',
      }
    },
    'password-changed': {
      userEmail: 'preview@example.com',
      userData: {
        email: 'preview@example.com',
      }
    },
    'team-lead-assignment': {
      userEmail: 'preview@example.com',
      teamData: {
        departmentName: 'Engineering Department',
        assignedBy: 'David Brown - HR Manager',
      }
    },
    'employee-created': {
      userEmail: 'preview@example.com',
      employeeData: {
        name: 'Alex Martinez',
        email: 'preview@example.com',
        employeeId: 'EMP-2026-001',
        department: 'Engineering Department',
        tempPassword: 'TempPass123!',
      }
    },
  };

  return samples[templateId];
};

// Get list of all templates
export const getTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'task-assigned',
        name: 'Task Assigned',
        description: 'Notification sent when a task is assigned to an employee',
        category: 'Tasks'
      },
      {
        id: 'ticket-created',
        name: 'Ticket Created Against',
        description: 'Notification when a ticket is reported against an employee',
        category: 'Tickets'
      },
      {
        id: 'ticket-resolved',
        name: 'Ticket Resolved',
        description: 'Notification when a ticket is resolved',
        category: 'Tickets'
      },
      {
        id: 'task-status-change',
        name: 'Task Status Change',
        description: 'Notification when task status is updated',
        category: 'Tasks'
      },
      {
        id: 'ticket-comment',
        name: 'Ticket Comment',
        description: 'Notification when someone comments on a ticket',
        category: 'Tickets'
      },
      {
        id: 'password-changed',
        name: 'Password Changed',
        description: 'Security notification when password is changed',
        category: 'Security'
      },
      {
        id: 'team-lead-assignment',
        name: 'Team Lead Assignment',
        description: 'Notification when assigned as team lead',
        category: 'Organization'
      },
      {
        id: 'employee-created',
        name: 'Employee Created',
        description: 'Welcome email when new employee account is created',
        category: 'Organization'
      }
    ];

    res.status(200).json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
    });
  }
};

// Get preview of a specific template
export const getTemplatePreview = async (req, res) => {
  try {
    const { templateId } = req.params;
    const sampleData = getSampleData(templateId);

    if (!sampleData) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Generate HTML content based on template type
    let htmlContent = '';
    
    switch (templateId) {
      case 'task-assigned':
        htmlContent = generateTaskAssignedContent(sampleData.taskData);
        break;
      case 'ticket-created':
        htmlContent = generateTicketCreatedContent(sampleData.ticketData);
        break;
      case 'ticket-resolved':
        htmlContent = generateTicketResolvedContent(sampleData.ticketData);
        break;
      case 'task-status-change':
        htmlContent = generateTaskStatusChangeContent(sampleData.taskData);
        break;
      case 'ticket-comment':
        htmlContent = generateTicketCommentContent(sampleData.commentData);
        break;
      case 'password-changed':
        htmlContent = generatePasswordChangedContent(sampleData.userData);
        break;
      case 'team-lead-assignment':
        htmlContent = generateTeamLeadContent(sampleData.teamData);
        break;
      case 'employee-created':
        htmlContent = generateEmployeeCreatedContent(sampleData.employeeData);
        break;
      default:
        throw new Error('Invalid template ID');
    }

    // Wrap content in email template
    const fullHtml = getEmailTemplate(htmlContent);

    res.status(200).json({
      success: true,
      html: fullHtml,
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate preview',
      error: error.message,
    });
  }
};

// Helper functions to generate content for each template type
const generateTaskAssignedContent = (taskData) => {
  return `
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
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${taskData.title}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Description:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${taskData.description}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Priority:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: ${taskData.priority === 'High' ? '#fef3c7' : taskData.priority === 'Medium' ? '#dbeafe' : '#f3f4f6'}; color: ${taskData.priority === 'High' ? '#92400e' : taskData.priority === 'Medium' ? '#1e40af' : '#374151'};">
              ${taskData.priority}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Due Date:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${new Date(taskData.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL}/tasks" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2); transition: all 0.3s ease;">
        View Task Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Please review the task details and start working on it at your earliest convenience.
    </p>
  `;
};

const generateTicketCreatedContent = (ticketData) => {
  return `
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
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">#${ticketData.ticketId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Subject:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${ticketData.subject}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Description:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${ticketData.description}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Reported By:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${ticketData.reportedBy}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Priority:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: ${ticketData.priority === 'High' ? '#fef3c7' : ticketData.priority === 'Medium' ? '#dbeafe' : '#f3f4f6'}; color: ${ticketData.priority === 'High' ? '#92400e' : ticketData.priority === 'Medium' ? '#1e40af' : '#374151'};">
              ${ticketData.priority}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL}/tickets/${ticketData.ticketId}" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2);">
        View Ticket Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Please review the ticket and provide your response at the earliest.
    </p>
  `;
};

const generateTicketResolvedContent = (ticketData) => {
  return `
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
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">#${ticketData.ticketId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Subject:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${ticketData.subject}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Resolution:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${ticketData.resolution || 'The issue has been addressed and resolved.'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Resolved By:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${ticketData.resolvedBy}</td>
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
      <a href="${process.env.FRONTEND_URL}/tickets/${ticketData.ticketId}" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2);">
        View Resolution Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      If you have any further concerns, please feel free to create a new ticket.
    </p>
  `;
};

const generateTaskStatusChangeContent = (taskData) => {
  const statusColors = {
    'To Do': { bg: '#f3f4f6', color: '#374151' },
    'In Progress': { bg: '#dbeafe', color: '#1e40af' },
    'Completed': { bg: '#d1fae5', color: '#065f46' },
    'On Hold': { bg: '#fef3c7', color: '#92400e' }
  };
  const statusColor = statusColors[taskData.status] || statusColors['To Do'];

  return `
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
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${taskData.title}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">New Status:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: ${statusColor.bg}; color: ${statusColor.color};">
              ${taskData.status}
            </span>
          </td>
        </tr>
        ${taskData.comment ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Comment:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${taskData.comment}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Updated By:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${taskData.updatedBy}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL}/tasks/${taskData.taskId}" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2);">
        View Task Details
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Keep track of your tasks and stay updated with the latest progress.
    </p>
  `;
};

const generateTicketCommentContent = (commentData) => {
  return `
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
      <a href="${process.env.FRONTEND_URL}/tickets/${commentData.ticketId}" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2);">
        View Full Conversation
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Click the button above to view the ticket and respond to the comment.
    </p>
  `;
};

const generatePasswordChangedContent = (userData) => {
  return `
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
        This is a confirmation that your password for <strong>${userData.email}</strong> was successfully changed on ${new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.
      </p>
    </div>

    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="margin: 0 0 12px 0; color: #92400e; font-size: 14px; font-weight: 600;">
        ⚠️ Didn't make this change?
      </p>
      <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6;">
        If you did not change your password, please contact your system administrator immediately as your account may be compromised.
      </p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2);">
        Go to Login
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      For security reasons, please keep your password confidential and change it regularly.
    </p>
  `;
};

const generateTeamLeadContent = (teamData) => {
  return `
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
      <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2);">
        Go to Dashboard
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Congratulations on your new role! We're confident in your leadership abilities.
    </p>
  `;
};

const generateEmployeeCreatedContent = (employeeData) => {
  return `
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Welcome to OMS
      </div>
    </div>

    <h2 style="margin: 0 0 20px 0; color: #093635; font-size: 22px; font-weight: 600; line-height: 1.3;">
      Your account has been created
    </h2>

    <div style="background: linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%); border-left: 4px solid #1F6A75; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Name:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600;">${employeeData.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Email:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${employeeData.email}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Employee ID:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${employeeData.employeeId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Department:</td>
          <td style="padding: 8px 0; color: #374151; font-size: 14px;">${employeeData.department}</td>
        </tr>
        ${employeeData.tempPassword ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-weight: 600;">Temporary Password:</td>
          <td style="padding: 8px 0; color: #093635; font-size: 14px; font-weight: 600; font-family: monospace; background-color: #f3f4f6; padding: 8px; border-radius: 4px;">${employeeData.tempPassword}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${employeeData.tempPassword ? `
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
      <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">
        🔒 Important Security Notice
      </p>
      <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6;">
        Please change your temporary password immediately after logging in. Keep your credentials confidential and never share them with anyone.
      </p>
    </div>
    ` : ''}

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background: linear-gradient(135deg, #093635 0%, #1F6A75 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(9, 54, 53, 0.2);">
        Login to Your Account
      </a>
    </div>

    <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      Welcome to the team! We're excited to have you on board.
    </p>
  `;
};

// Send test email
export const sendTestEmail = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return res.status(500).json({
        success: false,
        message: 'Email service not configured. Please configure EMAIL_USER and EMAIL_PASSWORD in the .env file.',
        hint: 'Add EMAIL_USER and EMAIL_PASSWORD to your Backend/.env file to enable email sending.',
      });
    }

    const sampleData = getSampleData(templateId);
    if (!sampleData) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    // Update email to the provided one
    sampleData.userEmail = email;

    // Send the actual email
    let result;
    switch (templateId) {
      case 'task-assigned':
        result = await notifyTaskAssigned(email, sampleData.taskData);
        break;
      case 'ticket-created':
        result = await notifyTicketCreatedAgainst(email, sampleData.ticketData);
        break;
      case 'ticket-resolved':
        result = await notifyTicketResolved(email, sampleData.ticketData);
        break;
      case 'task-status-change':
        result = await notifyTaskStatusChange(email, sampleData.taskData);
        break;
      case 'ticket-comment':
        result = await notifyTicketComment(email, sampleData.commentData);
        break;
      case 'password-changed':
        result = await notifyPasswordChanged(email, sampleData.userData);
        break;
      case 'team-lead-assignment':
        result = await notifyTeamLeadAssignment(email, sampleData.teamData);
        break;
      case 'employee-created':
        result = await notifyEmployeeCreated(email, sampleData.employeeData);
        break;
      default:
        throw new Error('Invalid template ID');
    }

    if (result.success) {
      res.status(200).json({
        success: true,
        message: `Test email sent to ${email}`,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message || 'Unknown error occurred',
    });
  }
};
