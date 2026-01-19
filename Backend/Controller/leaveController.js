import Leave from "../Model/Leave.js";
import Employee from "../Model/Employee.js";
import Attendance from "../Model/Attendance.js";
import Role from "../Model/Role.js";
import { logAttendanceAction } from "../Utils/auditLogger.js";
import { getFileInfo } from "../Middleware/fileUpload.js";
import { uploadBase64ToS3 } from "../Config/s3.js";
import { createNotification, createBulkNotifications } from "./notificationController.js";

// Helper to get role IDs by name
const getRoleIdsByName = async (names) => {
  const roles = await Role.find({ name: { $in: names } }).select("_id");
  return roles.map((r) => r._id);
};

// Apply for leave
export const applyLeave = async (req, res) => {
  try {
    const { startDate, endDate, leaveType, reason } = req.body;
    const employeeId = req.user._id;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
      });
    }

    // Check for overlapping leave requests
    const overlapping = await Leave.findOne({
      employee: employeeId,
      status: { $in: ["pending", "approved"] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } },
      ],
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: "You already have a leave request for this period",
      });
    }

    // Handle attachments
    const attachments = [];

    // Handle file attachments if uploaded (multipart/form-data)
    if (req.files && req.files.length > 0) {
      const fileAttachments = req.files.map((file) => {
        const fileInfo = getFileInfo(file);
        return {
          url: fileInfo.path,
          originalName: fileInfo.originalName,
          uploadedAt: new Date(),
        };
      });
      attachments.push(...fileAttachments);
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
              "leaves",
              img.name || `image_${Date.now()}.jpg`
            );
            attachments.push({
              url: s3Result.path,
              originalName: s3Result.originalName,
              uploadedAt: new Date(),
            });
          } catch (uploadError) {
            console.error("Error uploading compressed image to S3:", uploadError);
            // Continue with other images if one fails
          }
        }
      }
    }

    const leave = await Leave.create({
      employee: employeeId,
      startDate: start,
      endDate: end,
      leaveType,
      reason,
      status: "pending",
      attachments,
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate("employee", "name employeeId email");

    await logAttendanceAction(
      req,
      "LEAVE_APPLIED",
      populatedLeave,
      null,
      `Leave applied from ${start.toDateString()} to ${end.toDateString()}`
    );

    // Notify superAdmins and the specific person who created this employee's ID
    const superAdmins = await Employee.find({
      isActive: true,
      role: { $in: await getRoleIdsByName(["superAdmin"]) },
    }).select("_id");

    // Get the employee's createdBy (who created the employee ID)
    const employee = await Employee.findById(employeeId).select("createdBy");
    const recipientsSet = new Set(superAdmins.map((a) => a._id.toString()));
    
    // Add createdBy to recipients (the attendance dept person who created this employee)
    if (employee?.createdBy) {
      recipientsSet.add(employee.createdBy.toString());
    }

    if (recipientsSet.size > 0) {
      await createBulkNotifications({
        recipients: Array.from(recipientsSet),
        type: "leave_applied",
        title: "New Leave Request",
        message: `${populatedLeave.employee.name} has applied for ${leaveType} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
        referenceId: leave._id,
        referenceType: "Leave",
        sender: employeeId,
      });
    }

    res.status(201).json({
      success: true,
      message: "Leave application submitted successfully",
      data: populatedLeave,
    });
  } catch (error) {
    console.error("Error applying leave:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get my leave requests
export const getMyLeaves = async (req, res) => {
  try {
    const employeeId = req.user._id;
    const { status, year } = req.query;

    const filter = { employee: employeeId };
    
    if (status) {
      filter.status = status;
    }
    
    if (year) {
      filter.startDate = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      };
    }

    const leaves = await Leave.find(filter)
      .populate("approvedBy", "name employeeId")
      .sort({ appliedDate: -1 });

    res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    console.error("Error fetching leaves:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all leave requests (for attendance department)
export const getAllLeaves = async (req, res) => {
  try {
    const { status, employee, startDate, endDate } = req.query;
    const userRole = req.user?.role?.name || req.user?.role;

    const filter = {};

    // For attendanceDepartment, only show leaves from employees they created
    if (userRole === "attendanceDepartment") {
      const employeesCreatedByUser = await Employee.find({
        createdBy: req.user._id,
        isActive: true,
      }).select("_id");

      const employeeIds = employeesCreatedByUser.map((emp) => emp._id);
      filter.employee = { $in: employeeIds };
    }

    if (status) {
      filter.status = status;
    }

    if (employee) {
      filter.employee = employee;
    }

    if (startDate && endDate) {
      filter.startDate = { $gte: new Date(startDate) };
      filter.endDate = { $lte: new Date(endDate) };
    }

    const leaves = await Leave.find(filter)
      .populate({
        path: "employee",
        select: "name employeeId email department",
        populate: {
          path: "department",
          select: "name code"
        }
      })
      .populate("approvedBy", "name employeeId")
      .sort({ appliedDate: -1 });

    res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    console.error("Error fetching all leaves:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve/Reject leave
export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const approverId = req.user._id;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const leave = await Leave.findById(id).populate("employee", "name employeeId");

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Leave request has already been processed",
      });
    }

    leave.status = status;
    leave.approvedBy = approverId;
    leave.approvedDate = new Date();

    if (status === "rejected" && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }

    await leave.save();

    // If approved, mark attendance as leave for those dates (only on working days)
    if (status === "approved") {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      // Get employee's weekly off days
      const employeeDetails = await Employee.findById(leave.employee._id).select("workSchedule");
      const weeklyOffs = employeeDetails?.workSchedule?.weeklyOffs || ["Saturday", "Sunday"];
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateOnly = new Date(d);
        dateOnly.setHours(0, 0, 0, 0);

        // Check if this day is a weekly off for the employee
        const dayName = dayNames[dateOnly.getDay()];
        if (weeklyOffs.includes(dayName)) {
          // Skip marking attendance for weekly off days
          continue;
        }

        await Attendance.findOneAndUpdate(
          {
            employee: leave.employee._id,
            date: {
              $gte: dateOnly,
              $lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          {
            status: "leave",
            remarks: `Approved leave: ${leave.leaveType}`,
          },
          {
            upsert: true,
            new: true,
          }
        );
      }
    }

    await logAttendanceAction(
      req,
      status === "approved" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      leave,
      null,
      `Leave ${status} for ${leave.employee.name} (${leave.employee.employeeId})`
    );

    // Send notification to the employee
    try {
      await createNotification({
        recipient: leave.employee._id,
        type: status === "approved" ? "leave_approved" : "leave_rejected",
        title: `Leave ${status === "approved" ? "Approved" : "Rejected"}`,
        message:
          status === "approved"
            ? `Your ${leave.leaveType} leave from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved`
            : `Your ${leave.leaveType} leave request was rejected${rejectionReason ? ": " + rejectionReason : ""}`,
        data: {
          referenceId: leave._id,
          referenceType: "Leave",
        },
        sender: approverId,
      });
    } catch (notifError) {
      console.error("Error creating notification:", notifError);
    }

    const updatedLeave = await Leave.findById(id)
      .populate({
        path: "employee",
        select: "name employeeId email department",
        populate: {
          path: "department",
          select: "name code"
        }
      })
      .populate("approvedBy", "name employeeId");

    res.status(200).json({
      success: true,
      message: `Leave ${status} successfully`,
      data: updatedLeave,
    });
  } catch (error) {
    console.error("Error updating leave status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cancel leave (only for pending leaves)
export const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user._id;

    const leave = await Leave.findOne({ _id: id, employee: employeeId });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending leave requests can be cancelled",
      });
    }

    await Leave.findByIdAndDelete(id);

    await logAttendanceAction(
      req,
      "LEAVE_CANCELLED",
      leave,
      null,
      "Leave application cancelled by employee"
    );

    res.status(200).json({
      success: true,
      message: "Leave request cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling leave:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update leave (only for pending leaves)
export const updateLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user._id;
    const { startDate, endDate, leaveType, reason } = req.body;

    const leave = await Leave.findOne({ _id: id, employee: employeeId });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending leave requests can be edited",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
      });
    }

    // Check for overlapping leave requests (excluding current leave)
    const overlapping = await Leave.findOne({
      _id: { $ne: id },
      employee: employeeId,
      status: { $in: ["pending", "approved"] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } },
      ],
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: "You already have a leave request for this period",
      });
    }

    // Handle attachments
    let attachments = leave.attachments || [];

    // Handle existing attachments
    if (req.body.existingAttachments) {
      const existingAttachments = typeof req.body.existingAttachments === "string"
        ? JSON.parse(req.body.existingAttachments)
        : req.body.existingAttachments;
      attachments = existingAttachments;
    }

    // Handle file attachments if uploaded (multipart/form-data)
    if (req.files && req.files.length > 0) {
      const fileAttachments = req.files.map((file) => {
        const fileInfo = getFileInfo(file);
        return {
          url: fileInfo.path,
          originalName: fileInfo.originalName,
          uploadedAt: new Date(),
        };
      });
      attachments.push(...fileAttachments);
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
              "leaves",
              img.name || `image_${Date.now()}.jpg`
            );
            attachments.push({
              url: s3Result.path,
              originalName: s3Result.originalName,
              uploadedAt: new Date(),
            });
          } catch (uploadError) {
            console.error("Error uploading compressed image to S3:", uploadError);
            // Continue with other images if one fails
          }
        }
      }
    }

    // Update leave fields
    leave.startDate = start;
    leave.endDate = end;
    leave.leaveType = leaveType;
    leave.reason = reason;
    leave.attachments = attachments;

    await leave.save();

    const updatedLeave = await Leave.findById(id)
      .populate("employee", "name employeeId email");

    await logAttendanceAction(
      req,
      "LEAVE_UPDATED",
      updatedLeave,
      null,
      `Leave updated from ${start.toDateString()} to ${end.toDateString()}`
    );

    res.status(200).json({
      success: true,
      message: "Leave request updated successfully",
      data: updatedLeave,
    });
  } catch (error) {
    console.error("Error updating leave:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
