import Ticket from "../Model/Ticket.js";
import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import Role from "../Model/Role.js";
import { 
  notifyTicketCreatedAgainst, 
  notifyTicketResolved, 
  notifyTicketComment 
} from "../Utils/emailNotifications.js";
import { logTicketAction } from "../Utils/auditLogger.js";
import { getFileInfo } from "../Middleware/fileUpload.js";
import { uploadBase64ToS3 } from "../Config/s3.js";
import { createNotification, createBulkNotifications } from "./notificationController.js";

// Helper to get role IDs by name
const getRoleIdsByName = async (names) => {
  const roles = await Role.find({ name: { $in: names } }).select("_id");
  return roles.map((r) => r._id);
};

// Get all tickets
export const getAllTickets = async (req, res) => {
  try {
    const { status, category, priority, reportedBy, includeInactive } = req.query;
    const filter = {};
    
    // Only show active tickets unless includeInactive is true
    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (reportedBy) filter.reportedBy = reportedBy;

    const tickets = await Ticket.find(filter)
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department")
      .populate("assignedTo", "name email")
      .populate("resolvedBy", "name email")
      .populate("comments.employee", "name employeeId")
      .populate("visibleToDepartments", "name")
      .sort({ createdAt: -1 });

    // Filter tickets based on visibility rules
    const currentUser = req.user;
    const currentUserDeptId = currentUser.department?._id?.toString() || currentUser.department?.toString();
    const currentUserId = currentUser._id.toString();
    const isSuperAdmin = currentUser.role?.name === "superAdmin";
    
    const visibleTickets = tickets.filter(ticket => {
      // Creator can always see their own ticket
      if (ticket.reportedBy && ticket.reportedBy._id.toString() === currentUserId) {
        return true;
      }
      
      // Person reported against can see the ticket
      if (ticket.reportedAgainst && ticket.reportedAgainst._id.toString() === currentUserId) {
        return true;
      }
      
      // SuperAdmin can see all tickets
      if (isSuperAdmin) {
        return true;
      }
      
      // If visibleToDepartments is empty or null, ticket is public (visible to all)
      if (!ticket.visibleToDepartments || ticket.visibleToDepartments.length === 0) {
        return true;
      }
      
      // For restricted tickets, check if user's department is in the visible departments list
      if (currentUserDeptId) {
        const isVisible = ticket.visibleToDepartments.some(
          dept => dept._id.toString() === currentUserDeptId
        );
        return isVisible;
      }
      
      // If user has no department and ticket is restricted, they can't see it
      return false;
    });

    res.status(200).json({
      success: true,
      count: visibleTickets.length,
      data: visibleTickets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get ticket by ID
export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department position")
      .populate("assignedTo", "name email")
      .populate("resolvedBy", "name email")
      .populate("comments.employee", "name employeeId")
      .populate("visibleToDepartments", "name");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create new ticket
export const createTicket = async (req, res) => {
  try {
    const ticketData = {
      ...req.body,
      reportedBy: req.user._id,
    };

    // Handle attachments array
    ticketData.attachments = [];

    // Handle file attachments if uploaded (multipart/form-data)
    if (req.files && req.files.length > 0) {
      const fileAttachments = req.files.map((file) => {
        const fileInfo = getFileInfo(file);
        return {
          url: fileInfo.path,
          originalName: fileInfo.originalName,
          uploadedBy: req.user._id,
          uploadedAt: new Date(),
        };
      });
      ticketData.attachments.push(...fileAttachments);
    }

    // Handle compressed images (base64 data URLs) - upload to S3
    if (req.body.compressedImages) {
      const compressedImages = typeof req.body.compressedImages === "string" 
        ? JSON.parse(req.body.compressedImages) 
        : req.body.compressedImages;
      
      if (Array.isArray(compressedImages)) {
        for (const img of compressedImages) {
          try {
            const s3Result = await uploadBase64ToS3(
              img.dataUrl,
              "tickets",
              img.name || `image_${Date.now()}.jpg`
            );
            ticketData.attachments.push({
              url: s3Result.path,
              originalName: s3Result.originalName,
              uploadedBy: req.user._id,
              uploadedAt: new Date(),
            });
          } catch (uploadError) {
            console.error("Error uploading compressed image to S3:", uploadError);
          }
        }
      }
    }

    // Clean up the compressedImages field from ticketData
    delete ticketData.compressedImages;

    const ticket = await Ticket.create(ticketData);

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department email")
      .populate("visibleToDepartments", "name");

    // Send email notification to reported against person
    if (populatedTicket.reportedAgainst && populatedTicket.reportedAgainst.email) {
      notifyTicketCreatedAgainst(
        populatedTicket.reportedAgainst,
        populatedTicket,
        req.user
      ).catch((err) => console.error("Email notification failed:", err));
    }

    // Send in-app notification to admins
    try {
      const adminRoleIds = await getRoleIdsByName(["superAdmin", "attendanceDepartment"]);
      const admins = await Employee.find({ role: { $in: adminRoleIds }, isActive: true }).select("_id");
      
      if (admins.length > 0) {
        await createBulkNotifications({
          recipients: admins.map((a) => a._id),
          type: "ticket_created",
          title: "New Ticket Raised",
          message: `${req.user.name} raised a new ${populatedTicket.category} ticket: ${populatedTicket.subject}`,
          data: {
            referenceId: populatedTicket._id,
            referenceType: "Ticket",
          },
          sender: req.user._id,
        });
      }

      // Notify person reported against
      if (populatedTicket.reportedAgainst) {
        await createNotification({
          recipient: populatedTicket.reportedAgainst._id,
          type: "ticket_created",
          title: "Ticket Filed Against You",
          message: `A ${populatedTicket.category} ticket has been filed regarding you`,
          data: {
            referenceId: populatedTicket._id,
            referenceType: "Ticket",
          },
          sender: req.user._id,
        });
      }

      // Notify members of selected departments if visibility is restricted
      if (populatedTicket.visibleToDepartments && populatedTicket.visibleToDepartments.length > 0) {
        const deptIds = populatedTicket.visibleToDepartments.map(d => d._id);
        
        // Build exclusion list: creator, reported against, and admins (they already got notified)
        const excludeIds = [req.user._id];
        if (populatedTicket.reportedAgainst?._id) {
          excludeIds.push(populatedTicket.reportedAgainst._id);
        }
        const adminIds = admins.map(a => a._id);
        excludeIds.push(...adminIds);
        
        const deptMembers = await Employee.find({ 
          department: { $in: deptIds }, 
          isActive: true,
          _id: { $nin: excludeIds } // Exclude creator, reported against, and admins
        }).select("_id");
        
        if (deptMembers.length > 0) {
          await createBulkNotifications({
            recipients: deptMembers.map((m) => m._id),
            type: "ticket_created",
            title: "New Ticket in Your Department",
            message: `${req.user.name} raised a new ${populatedTicket.category} ticket`,
            data: {
              referenceId: populatedTicket._id,
              referenceType: "Ticket",
            },
            sender: req.user._id,
          });
        }
      }
    } catch (notifError) {
      console.error("Error creating notification:", notifError);
    }

    // Log the action
    await logTicketAction(req, "CREATE", populatedTicket);

    res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: populatedTicket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update ticket
export const updateTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate("reportedBy");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Check if user is the creator or superAdmin
    const isCreator = ticket.reportedBy._id.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role?.name === "superAdmin";

    if (!isCreator && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only edit tickets you created",
      });
    }

    // Clean up empty ObjectId fields - convert empty strings to null
    if (req.body.assignedTo === "") req.body.assignedTo = null;
    if (req.body.reportedAgainst === "") req.body.reportedAgainst = null;
    if (req.body.resolvedBy === "") req.body.resolvedBy = null;

    // Handle attachments
    let updatedAttachments = [];

    // Keep existing attachments if specified
    if (req.body.existingAttachments) {
      const existingAttachments = typeof req.body.existingAttachments === "string"
        ? JSON.parse(req.body.existingAttachments)
        : req.body.existingAttachments;
      
      if (Array.isArray(existingAttachments)) {
        updatedAttachments.push(...existingAttachments);
      }
    }

    // Add new file attachments if uploaded (multipart/form-data)
    if (req.files && req.files.length > 0) {
      const fileAttachments = req.files.map((file) => {
        const fileInfo = getFileInfo(file);
        return {
          url: fileInfo.path,
          originalName: fileInfo.originalName,
          uploadedBy: req.user._id,
          uploadedAt: new Date(),
        };
      });
      updatedAttachments.push(...fileAttachments);
    }

    // Handle compressed images (base64 data URLs) - upload to S3
    if (req.body.compressedImages) {
      const compressedImages = typeof req.body.compressedImages === "string"
        ? JSON.parse(req.body.compressedImages)
        : req.body.compressedImages;
      
      if (Array.isArray(compressedImages)) {
        for (const img of compressedImages) {
          try {
            const s3Result = await uploadBase64ToS3(
              img.dataUrl,
              "tickets",
              img.name || `image_${Date.now()}.jpg`
            );
            updatedAttachments.push({
              url: s3Result.path,
              originalName: s3Result.originalName,
              uploadedBy: req.user._id,
              uploadedAt: new Date(),
            });
          } catch (uploadError) {
            console.error("Error uploading compressed image to S3:", uploadError);
          }
        }
      }
    }

    // Only update attachments if we have processed any
    if (updatedAttachments.length > 0 || req.body.existingAttachments !== undefined || req.body.compressedImages !== undefined || (req.files && req.files.length > 0)) {
      req.body.attachments = updatedAttachments;
    }

    // Clean up temp fields
    delete req.body.existingAttachments;
    delete req.body.compressedImages;

    // If status is being changed to Resolved or Closed, update resolved fields and make inactive
    if ((req.body.status === "Resolved" || req.body.status === "Closed") && ticket.status !== req.body.status) {
      req.body.resolvedAt = new Date();
      req.body.resolvedBy = req.user._id;
      req.body.isActive = false; // Mark as inactive when resolved/closed
    }
    
    // If reopening a ticket (changing from Resolved/Closed to Open/In Progress), make it active again
    if ((req.body.status === "Open" || req.body.status === "In Progress") && 
        (ticket.status === "Resolved" || ticket.status === "Closed")) {
      req.body.isActive = true;
      req.body.resolvedAt = null;
      req.body.resolvedBy = null;
    }

    const previousStatus = ticket.status;

    const updatedTicket = await Ticket.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department")
      .populate("assignedTo", "name email")
      .populate("resolvedBy", "name email")
      .populate("visibleToDepartments", "name");

    // Send notification if ticket was resolved
    if ((req.body.status === "Resolved" || req.body.status === "Closed") && 
        previousStatus !== req.body.status && 
        updatedTicket.reportedBy?.email) {
      notifyTicketResolved(
        updatedTicket.reportedBy,
        updatedTicket,
        req.user
      ).catch((err) => console.error("Email notification failed:", err));
    }

    // Log the action
    await logTicketAction(req, "UPDATE", updatedTicket, {
      before: { status: previousStatus },
      after: { status: updatedTicket.status },
    });

    res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      data: updatedTicket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add comment to ticket
export const addComment = async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: "Comment is required",
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    ticket.comments.push({
      employee: req.user._id,
      comment,
    });

    await ticket.save();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department")
      .populate("assignedTo", "name email")
      .populate("comments.employee", "name employeeId");

    // Notify ticket creator and reported against about new comment
    try {
      const notifyIds = new Set();
      if (populatedTicket.reportedBy && populatedTicket.reportedBy._id.toString() !== req.user._id.toString()) {
        notifyIds.add(populatedTicket.reportedBy._id.toString());
      }
      if (populatedTicket.reportedAgainst && populatedTicket.reportedAgainst._id.toString() !== req.user._id.toString()) {
        notifyIds.add(populatedTicket.reportedAgainst._id.toString());
      }

      if (notifyIds.size > 0) {
        await createBulkNotifications({
          recipients: Array.from(notifyIds),
          type: "ticket_comment",
          title: "New Comment on Ticket",
          message: `${req.user.name} commented on ticket: ${populatedTicket.subject}`,
          data: {
            referenceId: populatedTicket._id,
            referenceType: "Ticket",
          },
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating comment notification:", notifError);
    }

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: populatedTicket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete ticket (soft delete)
export const deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate("reportedBy");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Check if user is the creator or superAdmin
    const isCreator = ticket.reportedBy._id.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role?.name === "superAdmin";

    if (!isCreator && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only delete tickets you created",
      });
    }

    await Ticket.findByIdAndUpdate(req.params.id, {
      isActive: false,
    });

    res.status(200).json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get tickets reported against the current user
export const getTicketsAgainstMe = async (req, res) => {
  try {
    const tickets = await Ticket.find({
      reportedAgainst: req.user._id,
      isActive: true,
    })
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department")
      .populate("assignedTo", "name email")
      .populate("comments.employee", "name employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get ticket statistics
export const getTicketStats = async (req, res) => {
  try {
    const stats = await Ticket.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedStats = {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
    };

    stats.forEach((stat) => {
      formattedStats.total += stat.count;
      if (stat._id === "Open") formattedStats.open = stat.count;
      if (stat._id === "In Progress") formattedStats.inProgress = stat.count;
      if (stat._id === "Resolved") formattedStats.resolved = stat.count;
      if (stat._id === "Closed") formattedStats.closed = stat.count;
    });

    res.status(200).json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get employees for ticket filing (limited info, accessible by all authenticated users)
export const getEmployeesForTicket = async (req, res) => {
  try {
    const { departmentId } = req.query;
    const filter = { isActive: true };
    
    if (departmentId) {
      filter.department = departmentId;
    }

    // Return only necessary fields for ticket filing
    const employees = await Employee.find(filter)
      .select("_id name employeeId department position")
      .populate("department", "name code")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get departments for ticket filing (accessible by all authenticated users)
export const getDepartmentsForTicket = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .select("_id name code parentDepartment")
      .populate("parentDepartment", "name code")
      .sort({ name: 1 });

    // Build flat list with hierarchy level
    const buildFlatList = (departments) => {
      const deptMap = new Map();
      departments.forEach(dept => {
        deptMap.set(dept._id.toString(), { ...dept.toObject(), level: 0 });
      });

      // Calculate levels
      departments.forEach(dept => {
        let level = 0;
        let current = dept;
        while (current.parentDepartment) {
          level++;
          const parentId = current.parentDepartment._id?.toString() || current.parentDepartment.toString();
          current = deptMap.get(parentId);
          if (!current) break;
        }
        deptMap.get(dept._id.toString()).level = level;
      });

      return Array.from(deptMap.values());
    };

    const flatData = buildFlatList(departments);

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments,
      flatData: flatData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
