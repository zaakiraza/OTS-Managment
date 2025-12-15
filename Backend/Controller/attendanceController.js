import Attendance from "../Model/Attendance.js";
import Employee from "../Model/Employee.js";
import logger from "../Utils/logger.js";
import { TIME } from "../Config/constants.js";
import { 
  getDateAtMidnightUTC, 
  parseLocalTimeToUTC, 
  getTodayUTC,
  getDayRangeUTC,
  TIMEZONE 
} from "../Utils/timezone.js";

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
      .populate('workSchedule');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee with biometric ID ${biometricId} not found`,
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

    // Find employee by employeeId
    const employee = await Employee.findOne({ employeeId: userId, isActive: true });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
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
      .populate("employee", "name employeeId email phone department")
      .populate("modifiedBy", "name");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
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

    const attendanceRecords = await Attendance.find({ 
      date: {
        $gte: today,
        $lt: tomorrow
      }
    })
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
      } else {
        // It's already a full datetime string or Date object
        attendance.checkIn = new Date(checkIn);
      }
    }
    
    if (checkOut) {
      // If checkOut is a time string (HH:MM:SS or HH:MM), combine with date
      if (typeof checkOut === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(checkOut)) {
        attendance.checkOut = parseLocalTimeToUTC(attendance.date, checkOut);
      } else {
        // It's already a full datetime string or Date object
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
    const attendance = await Attendance.findByIdAndDelete(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

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

    const stats = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalEmployees = await Employee.countDocuments({ isActive: true });

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
