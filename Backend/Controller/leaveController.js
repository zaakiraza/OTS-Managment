import Leave from "../Model/Leave.js";
import Employee from "../Model/Employee.js";
import Attendance from "../Model/Attendance.js";
import { logAttendanceAction } from "../Utils/auditLogger.js";

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

    const leave = await Leave.create({
      employee: employeeId,
      startDate: start,
      endDate: end,
      leaveType,
      reason,
      status: "pending",
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
      .populate("employee", "name employeeId email department")
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

    // If approved, mark attendance as leave for those dates
    if (status === "approved") {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateOnly = new Date(d);
        dateOnly.setHours(0, 0, 0, 0);

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

    const updatedLeave = await Leave.findById(id)
      .populate("employee", "name employeeId email")
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
