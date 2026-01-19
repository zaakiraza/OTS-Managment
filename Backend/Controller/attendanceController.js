import Attendance from "../Model/Attendance.js";
import Employee from "../Model/Employee.js";
import Role from "../Model/Role.js";
import Settings from "../Model/Settings.js";
import logger from "../Utils/logger.js";
import { TIME } from "../Config/constants.js";
import { logAttendanceAction } from "../Utils/auditLogger.js";
import { 
  getDateAtMidnightUTC, 
  parseLocalTimeToUTC, 
  getTodayUTC,
  getDayRangeUTC,
  TIMEZONE 
} from "../Utils/timezone.js";
import { createNotification, createBulkNotifications } from "./notificationController.js";

// Helper to get superAdmin IDs
const getSuperAdminIds = async () => {
  const superAdminRole = await Role.findOne({ name: "superAdmin" });
  if (!superAdminRole) return [];
  const admins = await Employee.find({ role: superAdminRole._id, isActive: true }).select("_id");
  return admins.map((a) => a._id);
};

// Biometric Device Check-in (ZKTeco SDK Integration)
export const deviceCheckIn = async (req, res) => {
  try {
    const { biometricId, timestamp, deviceId } = req.body;

    if (!biometricId) {
      return res.status(400).json({
        success: false,
        message: "Biometric ID is required",
      });
    }

    // Find employee by biometric ID
    const employee = await Employee.findOne({ 
      biometricId: biometricId.toString().trim(),
      isActive: true 
    }).populate('department', 'name leverageTime')
      .populate('workSchedule')
      .populate('role', 'name');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with biometric ID ${biometricId} not found`,
      });
    }

    // Skip attendance for superAdmin
    if (employee.role?.name === 'superAdmin') {
      return res.status(200).json({
        success: true,
        message: "Attendance not required for superAdmin",
        skipped: true,
      });
    }

    // Use provided timestamp or current time
    const punchTime = timestamp ? new Date(timestamp) : new Date();
    
    // Use centralized timezone utility for date at midnight
    const dateOnly = getDateAtMidnightUTC(punchTime);

    // Find today's attendance record
    let attendance = await Attendance.findOne({
      userId: employee.employeeId,
      date: {
        $gte: dateOnly,
        $lt: new Date(dateOnly.getTime() + TIME.ONE_DAY),
      },
    });

    let punchType = '';
    
    if (!attendance) {
      // First punch of the day - create new record with check-in
      attendance = await Attendance.create({
        employee: employee._id,
        userId: employee.employeeId,
        date: dateOnly,
        checkIn: punchTime,
        checkOut: null,
        deviceId: deviceId || '',
        isManualEntry: false,
      });
      punchType = 'CHECK-IN';
    } else if (!attendance.checkIn) {
      // Has record but no check-in (edge case)
      attendance.checkIn = punchTime;
      if (deviceId) attendance.deviceId = deviceId;
      await attendance.save();
      punchType = 'CHECK-IN';
    } else if (!attendance.checkOut) {
      // Already has check-in, this is check-out
      attendance.checkOut = punchTime;
      await attendance.save();
      punchType = 'CHECK-OUT';
    } else {
      // Already checked in and out today
      return res.status(400).json({
        success: false,
        message: "Already checked in and checked out for today",
        data: {
          employeeName: employee.name,
          employeeId: employee.employeeId,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
        },
      });
    }

    // Populate the response
    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("employee", "name employeeId email department position");

    res.status(200).json({
      success: true,
      message: `${punchType} recorded successfully`,
      punchType,
      data: {
        employee: {
          name: employee.name,
          employeeId: employee.employeeId,
          department: employee.department?.name,
        },
        attendance: populatedAttendance,
        timestamp: punchTime,
      },
    });
  } catch (error) {
    logger.error(`Device check-in error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark attendance (from biometric device or manual)
export const markAttendance = async (req, res) => {
  try {
    const { userId, type, deviceId } = req.body; // type: 'checkIn' or 'checkOut'

    // Find employee by employeeId with role populated
    const employee = await Employee.findOne({ employeeId: userId, isActive: true })
      .populate('role', 'name');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Skip attendance for superAdmin
    if (employee.role?.name === 'superAdmin') {
      return res.status(200).json({
        success: true,
        message: "Attendance not required for superAdmin",
        skipped: true,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create today's attendance record
    let attendance = await Attendance.findOne({
      userId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + TIME.ONE_DAY),
      },
    });

    const now = new Date();

    if (!attendance) {
      // Create new attendance record
      attendance = await Attendance.create({
        employee: employee._id,
        userId,
        date: new Date(),
        checkIn: type === "checkIn" ? now : null,
        checkOut: type === "checkOut" ? now : null,
        deviceId: deviceId || "",
        isManualEntry: false,
      });
    } else {
      // Update existing record
      if (type === "checkIn" && !attendance.checkIn) {
        attendance.checkIn = now;
      } else if (type === "checkOut") {
        attendance.checkOut = now;
      }
      await attendance.save();
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("employee", "name employeeId email department");

    res.status(200).json({
      success: true,
      message: `${type === "checkIn" ? "Check-in" : "Check-out"} marked successfully`,
      data: populatedAttendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all attendance records with filters
export const getAllAttendance = async (req, res) => {
  try {
    const { date, userId, employee, status, startDate, endDate, month, year } = req.query;
    
    // console.log("📋 Fetching attendance with params:", { date, userId, employee, status, startDate, endDate, month, year });
    
    let filter = {};

    // Filter by employee ObjectId
    if (employee) {
      filter.employee = employee;
    }

    // Filter by userId (employeeId string)
    if (userId) {
      filter.userId = userId;
    }

    // Filter by month and year
    if (month && year) {
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      
      filter.date = {
        $gte: startOfMonth,
        $lte: endOfMonth
      };
    }
    // Filter by specific date
    else if (date) {
      const targetDate = new Date(date);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      filter.date = {
        $gte: targetDate,
        $lt: nextDate
      };
      // console.log("📅 Date filter:", filter.date);
    }
    // Filter by date range
    else if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by department
    if (req.query.department) {
      // Find all employees in the selected department
      const employeesInDept = await Employee.find({
        primaryDepartment: req.query.department,
        isActive: true
      }).select('_id');
      
      const deptEmployeeIds = employeesInDept.map(emp => emp._id);
      filter.employee = { $in: deptEmployeeIds };
    }

    // For attendanceDepartment role, only show attendance of employees they created + their own attendance
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (requestingUserRole === "attendanceDepartment") {
      // Get all employees created by this user
      const employeesCreatedByUser = await Employee.find({
        createdBy: req.user._id,
        isActive: true
      }).select('_id');
      
      const employeeIds = employeesCreatedByUser.map(emp => emp._id);
      
      // Also add the logged-in user's own ID to see their own attendance
      employeeIds.push(req.user._id);
      
      // Add to filter - only show attendance for these employees
      if (filter.employee) {
        // If employee filter already exists, ensure it's in the allowed list
        filter.employee = { $in: [filter.employee, ...employeeIds] };
      } else {
        filter.employee = { $in: employeeIds };
      }
    }
    // For regular users (not superAdmin or attendanceDepartment), only show their own attendance
    else if (requestingUserRole !== "superAdmin") {
      // Override any employee filter to ensure users can only see their own data
      filter.employee = req.user._id;
    }

    const attendanceRecords = await Attendance.find(filter)
      .select('+checkIn +checkOut') // Explicitly include these fields
      .populate("employee", "name employeeId email phone department")
      .populate("modifiedBy", "name")
      .sort({ date: -1, createdAt: -1 });

    // console.log(`✅ Found ${attendanceRecords.length} attendance records`);
    // console.log("Sample record:", attendanceRecords[0]);

    res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      data: attendanceRecords,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get attendance by ID
export const getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate("employee", "name employeeId email phone department createdBy")
      .populate("modifiedBy", "name");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // For attendanceDepartment role, only allow viewing attendance of employees they created or their own
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (requestingUserRole === "attendanceDepartment") {
      const attendanceEmployeeId = attendance.employee?._id || attendance.employee;
      const employeeCreatedBy = attendance.employee?.createdBy?._id || attendance.employee?.createdBy;
      
      // Allow if it's their own attendance OR if they created the employee
      const isOwnAttendance = String(attendanceEmployeeId) === String(req.user._id);
      const isCreatedByUser = String(employeeCreatedBy) === String(req.user._id);
      
      if (!isOwnAttendance && !isCreatedByUser) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view attendance of employees you created.",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get today's attendance
export const getTodayAttendance = async (req, res) => {
  try {
    // Use centralized timezone utility
    const today = getTodayUTC();
    const tomorrow = new Date(today.getTime() + TIME.ONE_DAY);

    const filter = { 
      date: {
        $gte: today,
        $lt: tomorrow
      }
    };

    // For attendanceDepartment role, only show attendance of employees they created + their own attendance
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (requestingUserRole === "attendanceDepartment") {
      // Get all employees created by this user
      const employeesCreatedByUser = await Employee.find({
        createdBy: req.user._id,
        isActive: true
      }).select('_id');
      
      const employeeIds = employeesCreatedByUser.map(emp => emp._id);
      
      // Also add the logged-in user's own ID to see their own attendance
      employeeIds.push(req.user._id);
      
      filter.employee = { $in: employeeIds };
    }

    const attendanceRecords = await Attendance.find(filter)
      .select('+checkIn +checkOut') // Explicitly include these fields
      .populate("employee", "name employeeId email phone department")
      .populate("modifiedBy", "name")
      .sort({ checkIn: -1 });

    res.status(200).json({
      success: true,
      count: attendanceRecords.length,
      data: attendanceRecords,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update attendance (manual correction)
export const updateAttendance = async (req, res) => {
  try {
    // Check if manual attendance is enabled (skip check for superAdmin)
    const isSuperAdmin = req.user.role?.name === "superAdmin";
    if (!isSuperAdmin) {
      const manualEnabled = await Settings.getValue("manualAttendanceEnabled", true);
      if (!manualEnabled) {
        return res.status(403).json({
          success: false,
          message: "Manual attendance editing has been disabled by administrator",
        });
      }
    }

    const { checkIn, checkOut, status, remarks, workingHours } = req.body;

    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Update fields - Convert time strings to Date objects using centralized timezone utility
    if (checkIn) {
      // If checkIn is a time string (HH:MM:SS or HH:MM), combine with date
      if (typeof checkIn === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(checkIn)) {
        attendance.checkIn = parseLocalTimeToUTC(attendance.date, checkIn);
      } else if (typeof checkIn === 'string' && checkIn.includes('T')) {
        // It's a full ISO datetime string (YYYY-MM-DDTHH:MM:SS)
        // Extract time part and treat as local time (PKT)
        const timeMatch = checkIn.match(/T(\d{1,2}:\d{2}(:\d{2})?)/);
        if (timeMatch) {
          attendance.checkIn = parseLocalTimeToUTC(attendance.date, timeMatch[1]);
        } else {
          attendance.checkIn = new Date(checkIn);
        }
      } else {
        // It's already a Date object or other format
        attendance.checkIn = new Date(checkIn);
      }
    }
    
    if (checkOut) {
      // If checkOut is a time string (HH:MM:SS or HH:MM), combine with date
      if (typeof checkOut === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(checkOut)) {
        attendance.checkOut = parseLocalTimeToUTC(attendance.date, checkOut);
      } else if (typeof checkOut === 'string' && checkOut.includes('T')) {
        // It's a full ISO datetime string (YYYY-MM-DDTHH:MM:SS)
        // Extract time part and treat as local time (PKT)
        const timeMatch = checkOut.match(/T(\d{1,2}:\d{2}(:\d{2})?)/);
        if (timeMatch) {
          attendance.checkOut = parseLocalTimeToUTC(attendance.date, timeMatch[1]);
        } else {
          attendance.checkOut = new Date(checkOut);
        }
      } else {
        // It's already a Date object or other format
        attendance.checkOut = new Date(checkOut);
      }
    }
    
    if (status) attendance.status = status;
    if (remarks !== undefined) attendance.remarks = remarks;
    if (workingHours !== undefined) attendance.workingHours = workingHours;
    
    attendance.isManualEntry = true;
    attendance.modifiedBy = req.user._id;

    await attendance.save(); // This triggers the pre-save hook

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("employee", "name employeeId email phone department");

    // Audit log
    await logAttendanceAction(req, "UPDATE", populatedAttendance, {
      before: { checkIn: attendance.checkIn, checkOut: attendance.checkOut, status: attendance.status },
      after: { checkIn: populatedAttendance.checkIn, checkOut: populatedAttendance.checkOut, status: populatedAttendance.status }
    }, `Attendance updated for ${populatedAttendance.employee?.name} (${populatedAttendance.userId})`);

    // Notify the employee and superAdmin about attendance update
    try {
      const recipients = [];
      const employeeId = populatedAttendance.employee?._id;
      
      // Notify the employee
      if (employeeId && employeeId.toString() !== req.user._id.toString()) {
        recipients.push(employeeId);
      }
      
      // Notify superAdmin if requester is not superAdmin
      if (req.user.role?.name !== "superAdmin") {
        const superAdminIds = await getSuperAdminIds();
        recipients.push(...superAdminIds);
      }
      
      if (recipients.length > 0) {
        const dateStr = new Date(populatedAttendance.date).toLocaleDateString();
        await createBulkNotifications({
          recipients,
          type: "attendance_updated",
          title: "Attendance Updated",
          message: `${req.user.name} updated attendance for ${populatedAttendance.employee?.name} on ${dateStr}`,
          referenceId: populatedAttendance._id,
          referenceType: "Attendance",
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating attendance update notification:", notifError);
    }

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: populatedAttendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete attendance record
export const deleteAttendance = async (req, res) => {
  try {
    // First get the attendance for audit log
    const attendanceToDelete = await Attendance.findById(req.params.id).populate("employee", "name employeeId");
    
    if (!attendanceToDelete) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    await Attendance.findByIdAndDelete(req.params.id);

    // Audit log
    await logAttendanceAction(req, "DELETE", attendanceToDelete, {
      before: { userId: attendanceToDelete.userId, date: attendanceToDelete.date, checkIn: attendanceToDelete.checkIn }
    }, `Attendance deleted for ${attendanceToDelete.employee?.name} (${attendanceToDelete.userId})`);

    res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create manual attendance entry
export const createManualAttendance = async (req, res) => {
  try {
    // Check if manual attendance is enabled (skip check for superAdmin)
    const isSuperAdmin = req.user.role?.name === "superAdmin";
    if (!isSuperAdmin) {
      const manualEnabled = await Settings.getValue("manualAttendanceEnabled", true);
      if (!manualEnabled) {
        return res.status(403).json({
          success: false,
          message: "Manual attendance marking has been disabled by administrator",
        });
      }
    }

    const { userId, date, checkIn, checkOut, remarks, workingHours, status } = req.body;

    // Check if employee exists
    const employee = await Employee.findOne({ employeeId: userId });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Use centralized timezone utility for date parsing
    const attendanceDate = getDateAtMidnightUTC(date);
    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }
    
    // Get day range for checking existing attendance
    const dayRange = getDayRangeUTC(date);
    
    const existingAttendance = await Attendance.findOne({
      userId,
      date: {
        $gte: dayRange.start,
        $lt: new Date(dayRange.end.getTime() + 1),
      },
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already exists for this date",
      });
    }

    // Convert checkIn and checkOut to proper Date objects using centralized timezone utility
    let checkInDate = null;
    let checkOutDate = null;
    
    if (checkIn) {
      // If checkIn is a time string (HH:MM:SS or HH:MM), combine with attendance date
      if (typeof checkIn === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(checkIn)) {
        checkInDate = parseLocalTimeToUTC(attendanceDate, checkIn);
      } else {
        // It's already a full datetime string or Date object
        checkInDate = new Date(checkIn);
      }
    }
    
    if (checkOut) {
      // If checkOut is a time string (HH:MM:SS or HH:MM), combine with attendance date
      if (typeof checkOut === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(checkOut)) {
        checkOutDate = parseLocalTimeToUTC(attendanceDate, checkOut);
      } else {
        // It's already a full datetime string or Date object
        checkOutDate = new Date(checkOut);
      }
    }

    const attendanceData = {
      employee: employee._id,
      userId,
      date: attendanceDate,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      remarks,
      isManualEntry: true,
      modifiedBy: req.user._id,
    };

    // Add manual status if provided (overrides auto-calculation)
    if (status) {
      attendanceData.status = status;
    }

    // Add workingHours if provided
    if (workingHours !== undefined) {
      attendanceData.workingHours = workingHours;
    }

    const attendance = await Attendance.create(attendanceData);

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("employee", "name employeeId");

    // Audit log
    await logAttendanceAction(req, "CREATE", populatedAttendance, {
      after: { userId, date: attendanceDate, checkIn: checkInDate, checkOut: checkOutDate, isManualEntry: true }
    }, `Manual attendance created for ${employee.name} (${userId})`);

    // Notify the employee and superAdmin about manual attendance
    try {
      const recipients = [];
      
      // Notify the employee
      if (employee._id.toString() !== req.user._id.toString()) {
        recipients.push(employee._id);
      }
      
      // Notify superAdmin if requester is not superAdmin
      if (req.user.role?.name !== "superAdmin") {
        const superAdminIds = await getSuperAdminIds();
        recipients.push(...superAdminIds);
      }
      
      if (recipients.length > 0) {
        const dateStr = attendanceDate.toLocaleDateString();
        await createBulkNotifications({
          recipients,
          type: "attendance_marked",
          title: "Attendance Marked",
          message: `${req.user.name} manually marked attendance for ${employee.name} on ${dateStr}`,
          referenceId: populatedAttendance._id,
          referenceType: "Attendance",
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating manual attendance notification:", notifError);
    }

    res.status(201).json({
      success: true,
      message: "Manual attendance created successfully",
      data: populatedAttendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get attendance statistics
export const getAttendanceStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = {};
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // For attendanceDepartment role, only show stats for employees they created
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    let employeeFilter = { isActive: true };
    
    if (requestingUserRole === "attendanceDepartment") {
      // Get all employees created by this user
      const employeesCreatedByUser = await Employee.find({
        createdBy: req.user._id,
        isActive: true
      }).select('_id');
      
      const employeeIds = employeesCreatedByUser.map(emp => emp._id);
      filter.employee = { $in: employeeIds };
      employeeFilter.createdBy = req.user._id;
    }

    const stats = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalEmployees = await Employee.countDocuments(employeeFilter);

    res.status(200).json({
      success: true,
      data: {
        stats,
        totalUsers: totalEmployees, // Keep as totalUsers for backward compatibility
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark absent employees for a specific date or date range
export const markAbsent = async (req, res) => {
  try {
    const { date, startDate, endDate } = req.body;
    
    // Import the markAbsentEmployees function
    const { markAbsentEmployees, markAbsentForDateRange } = await import("../Utils/markAbsentees.js");
    
    let result;
    
    if (startDate && endDate) {
      // Mark for date range
      result = await markAbsentForDateRange(new Date(startDate), new Date(endDate));
      
      // Calculate totals
      const totals = result.reduce((acc, day) => ({
        markedAbsent: acc.markedAbsent + day.markedAbsent,
        alreadyMarked: acc.alreadyMarked + day.alreadyMarked,
        weeklyOffSkipped: acc.weeklyOffSkipped + day.weeklyOffSkipped
      }), { markedAbsent: 0, alreadyMarked: 0, weeklyOffSkipped: 0 });
      
      res.status(200).json({
        success: true,
        message: `Processed ${result.length} days. Marked ${totals.markedAbsent} employees as absent.`,
        data: {
          days: result.length,
          ...totals,
          details: result
        }
      });
    } else {
      // Mark for single date (default to today)
      const targetDate = date ? new Date(date) : new Date();
      result = await markAbsentEmployees(targetDate);
      
      res.status(200).json({
        success: true,
        message: `Marked ${result.markedAbsent} employees as absent for ${targetDate.toISOString().split('T')[0]}`,
        data: result
      });
    }
  } catch (error) {
    logger.error(`Error in markAbsent: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
