import Ticket from "../Model/Ticket.js";
import Employee from "../Model/Employee.js";

// Get all tickets
export const getAllTickets = async (req, res) => {
  try {
    const { status, category, priority, reportedBy } = req.query;
    const filter = { isActive: true };

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

    const ticket = await Ticket.create(ticketData);

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department");

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
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // If status is being changed to Resolved or Closed, update resolved fields
    if ((req.body.status === "Resolved" || req.body.status === "Closed") && ticket.status !== req.body.status) {
      req.body.resolvedAt = new Date();
      req.body.resolvedBy = req.user._id;
    }

    const updatedTicket = await Ticket.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("reportedBy", "name email role")
      .populate("reportedAgainst", "name employeeId department")
      .populate("assignedTo", "name email")
      .populate("resolvedBy", "name email");

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
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
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
