import Feedback from "../Model/Feedback.js";
import { logSystemAction } from "../Utils/auditLogger.js";

// Submit feedback (all authenticated users)
export const submitFeedback = async (req, res) => {
  try {
    const { category, subject, message, priority } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    // req.user is already the employee from auth middleware
    // Use req.user directly, no need to fetch again
    const employeeEmail = req.user.email || `${req.user.employeeId}@company.local`;

    const feedback = await Feedback.create({
      submittedBy: req.user._id,
      submittedByName: req.user.name,
      submittedByEmail: employeeEmail,
      category: category || "other",
      subject,
      message,
      priority: priority || "medium",
      status: "new",
    });

    // Audit log
    await logSystemAction(req, "CREATE", feedback, {
      after: { category, subject, status: "new" }
    }, `Feedback submitted: ${subject}`);

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get my feedback (user's own feedback)
export const getMyFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ submittedBy: req.user._id })
      .populate("reviewedBy", "name employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all feedback (superAdmin only)
export const getAllFeedback = async (req, res) => {
  try {
    const { status, category, priority } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const feedbacks = await Feedback.find(filter)
      .populate("submittedBy", "name employeeId email department")
      .populate("reviewedBy", "name employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get feedback by ID
export const getFeedbackById = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate("submittedBy", "name employeeId email department")
      .populate("reviewedBy", "name employeeId");

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    // Check if user is the submitter or superAdmin
    const isOwner = feedback.submittedBy._id.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role?.name === "superAdmin";

    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update feedback status/notes (superAdmin only)
export const updateFeedback = async (req, res) => {
  try {
    const { status, priority, adminNotes } = req.body;

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    const oldStatus = feedback.status;
    const oldPriority = feedback.priority;

    if (status) {
      feedback.status = status;
      if (status !== "new" && !feedback.reviewedBy) {
        feedback.reviewedBy = req.user._id;
        feedback.reviewedAt = new Date();
      }
    }
    if (priority) feedback.priority = priority;
    if (adminNotes !== undefined) feedback.adminNotes = adminNotes;

    await feedback.save();

    const updatedFeedback = await Feedback.findById(feedback._id)
      .populate("submittedBy", "name employeeId email")
      .populate("reviewedBy", "name employeeId");

    // Audit log
    await logSystemAction(req, "UPDATE", updatedFeedback, {
      before: { status: oldStatus, priority: oldPriority },
      after: { status: feedback.status, priority: feedback.priority, adminNotes: feedback.adminNotes }
    }, `Feedback updated: ${feedback.subject}`);

    res.status(200).json({
      success: true,
      message: "Feedback updated successfully",
      data: updatedFeedback,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete feedback (only by submitter or superAdmin)
export const deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    const isOwner = feedback.submittedBy.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role?.name === "superAdmin";

    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await Feedback.findByIdAndDelete(req.params.id);

    // Audit log
    await logSystemAction(req, "DELETE", feedback, {
      before: { subject: feedback.subject, status: feedback.status }
    }, `Feedback deleted: ${feedback.subject}`);

    res.status(200).json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

