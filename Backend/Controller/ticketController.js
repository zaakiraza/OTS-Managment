import Ticket from "../Model/Ticket.js";
import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import { 
  notifyTicketCreatedAgainst, 
  notifyTicketResolved, 
  notifyTicketComment 
} from "../Utils/emailNotifications.js";
import { logTicketAction } from "../Utils/auditLogger.js";
import { getFileInfo } from "../Middleware/fileUpload.js";

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

// Get ticket by ID
export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department position")
      .populate("assignedTo", "name email")
      .populate("resolvedBy", "name email")
      .populate("comments.employee", "name employeeId");

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
      const fileAttachments = req.files.map((file) => ({
        ...getFileInfo(file),
        uploadedBy: req.user._id,
      }));
      ticketData.attachments.push(...fileAttachments);
    }

    // Handle compressed images (base64 data URLs)
    if (req.body.compressedImages) {
      const compressedImages = typeof req.body.compressedImages === "string" 
        ? JSON.parse(req.body.compressedImages) 
        : req.body.compressedImages;
      
      if (Array.isArray(compressedImages)) {
        const imageAttachments = compressedImages.map((img) => ({
          filename: img.name || `image_${Date.now()}.jpg`,
          originalName: img.name || `image_${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          size: Math.round((img.dataUrl?.length || 0) * 0.75),
          path: img.dataUrl, // Store base64 data URL as path
          uploadedBy: req.user._id,
        }));
        ticketData.attachments.push(...imageAttachments);
      }
    }

    // Clean up the compressedImages field from ticketData
    delete ticketData.compressedImages;

    const ticket = await Ticket.create(ticketData);

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department email");

    // Send email notification to reported against person
    if (populatedTicket.reportedAgainst && populatedTicket.reportedAgainst.email) {
      notifyTicketCreatedAgainst(
        populatedTicket.reportedAgainst,
        populatedTicket,
        req.user
      ).catch((err) => console.error("Email notification failed:", err));
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
      const fileAttachments = req.files.map((file) => ({
        ...getFileInfo(file),
        uploadedBy: req.user._id,
      }));
      updatedAttachments.push(...fileAttachments);
    }

    // Handle compressed images (base64 data URLs)
    if (req.body.compressedImages) {
      const compressedImages = typeof req.body.compressedImages === "string"
        ? JSON.parse(req.body.compressedImages)
        : req.body.compressedImages;
      
      if (Array.isArray(compressedImages)) {
        const imageAttachments = compressedImages.map((img) => ({
          filename: img.name || `image_${Date.now()}.jpg`,
          originalName: img.name || `image_${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          size: Math.round((img.dataUrl?.length || 0) * 0.75),
          path: img.dataUrl, // Store base64 data URL as path
          uploadedBy: req.user._id,
        }));
        updatedAttachments.push(...imageAttachments);
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
      .populate("resolvedBy", "name email");

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
