import mongoose from "mongoose";
import Attendance from "../Model/Attendance.js";
import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import Role from "../Model/Role.js";
import Settings from "../Model/Settings.js";
import logger from "../Utils/logger.js";
import { TIME } from "../Config/constants.js";
import { logAttendanceAction } from "../Utils/auditLogger.js";
import { splitAttendanceByDepartments, hasMultipleShifts } from "../Utils/attendanceSplitter.js";
import { markOldPendingAsMissing } from "../Utils/markMissingAttendance.js";
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
      // Has record but no check-in (could be auto-marked absent)
      attendance.checkIn = punchTime;
      attendance.status = 'pending'; // Reset status so pre-save hook will recalculate
      if (deviceId) attendance.deviceId = deviceId;
      await attendance.save();
      punchType = 'CHECK-IN';
    } else if (!attendance.checkOut) {
      // Already has check-in, this is check-out
      attendance.checkOut = punchTime;
      attendance.status = 'pending'; // Reset status so pre-save hook will recalculate
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

      const now = new Date();
    
      // Check if employee has multiple department shifts configured
      const hasShifts = await hasMultipleShifts(employee._id);

      if (hasShifts) {
        // Employee works in multiple departments - split attendance by shifts
        logger.info(`Multi-department employee detected: ${userId}, splitting attendance`);
      
        // Prepare attendance data for splitting
        const attendanceData = {
          employee: employee._id,
          userId,
          date: today,
          checkIn: type === "checkIn" ? now : null,
          checkOut: type === "checkOut" ? now : null,
          deviceId: deviceId || "",
          isManualEntry: false,
        };

        // Split attendance across departments based on shifts
        const splitRecords = await splitAttendanceByDepartments(attendanceData);

        // Populate and return all created/updated records
        const populatedRecords = await Promise.all(
          splitRecords.map(record => 
            Attendance.findById(record._id)
              .populate("employee", "name employeeId email department")
              .populate("department", "name")
          )
        );

        const hasShiftRecords = splitRecords.length > 1;

        return res.status(200).json({
          success: true,
          message: hasShiftRecords
            ? `${type === "checkIn" ? "Check-in" : "Check-out"} marked successfully across ${splitRecords.length} departments`
            : `${type === "checkIn" ? "Check-in" : "Check-out"} marked successfully`,
          multiDepartment: hasShiftRecords,
          data: populatedRecords,
        });
      } else {
        // Regular single-department attendance
        let attendance = await Attendance.findOne({
          userId,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + TIME.ONE_DAY),
          },
          department: employee.department, // Find record for primary department
        });

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
            department: employee.department,
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

        return res.status(200).json({
          success: true,
          message: `${type === "checkIn" ? "Check-in" : "Check-out"} marked successfully`,
          data: populatedAttendance,
        });
      }
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
    const requestingUserRole = req.user?.role?.name || req.user?.role;

    // When status is "not-marked", return employees who have no attendance for the date (table-shaped rows)
    if (status === "not-marked") {
      const targetDate = date ? getDateAtMidnightUTC(new Date(date)) : getTodayUTC();
      const nextDay = new Date(targetDate.getTime() + TIME.ONE_DAY);

      let deptIds = null;
      if (requestingUserRole === "attendanceDepartment") {
        const departmentsCreatedByUser = await Department.find({
          createdBy: req.user._id,
          isActive: true
        }).select("_id");
        deptIds = departmentsCreatedByUser.map((d) => d._id);
        if (deptIds.length === 0) {
          return res.status(200).json({ success: true, count: 0, data: [] });
        }
      }

      const superAdminRole = await Role.findOne({ name: "superAdmin" });
      const superAdminId = superAdminRole?._id;
      let employeeFilter = { isActive: true };
      if (superAdminId) employeeFilter.role = { $ne: superAdminId };
      if (requestingUserRole === "attendanceDepartment" && deptIds?.length) {
        employeeFilter.$or = [
          { department: { $in: deptIds } },
          { "shifts.department": { $in: deptIds } },
        ];
      }
      if (userId) {
        employeeFilter.employeeId = new RegExp(userId, "i");
      }

      const employeesInScope = await Employee.find(employeeFilter)
        .select("_id name employeeId email department shifts")
        .populate("department", "name code")
        .lean();

      const markedEmployeeIds = await Attendance.distinct("employee", {
        date: { $gte: targetDate, $lt: nextDay },
        ...(deptIds?.length ? { department: { $in: deptIds } } : {}),
      });
      const markedSet = new Set(markedEmployeeIds.map((id) => String(id)));
      let notMarked = employeesInScope.filter((emp) => !markedSet.has(String(emp._id)));

      if (req.query.department) {
        const deptId = String(req.query.department);
        notMarked = notMarked.filter(
          (emp) =>
            String(emp.department?._id) === deptId ||
            (emp.shifts && emp.shifts.some((s) => String(s.department) === deptId))
        );
      }

      const tableRows = notMarked.map((emp) => ({
        _id: `not-marked-${emp._id}`,
        employee: { _id: emp._id, name: emp.name, employeeId: emp.employeeId, email: emp.email, department: emp.department },
        department: emp.department || { name: "-", code: "-" },
        date: targetDate,
        checkIn: null,
        checkOut: null,
        status: "not-marked",
        workingHours: null,
      }));

      return res.status(200).json({
        success: true,
        count: tableRows.length,
        data: tableRows,
      });
    }

    // Mark any pending attendance from before today as missing
    await markOldPendingAsMissing();

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

    // Filter by department - all attendance records now have department field
    const hasDepartmentFilter = req.query.department ? true : false;
    if (hasDepartmentFilter) {
        filter.department = req.query.department;
    }

    if (requestingUserRole === "superAdmin") {
      // SuperAdmin sees all attendance
    } else if (requestingUserRole === "attendanceDepartment") {
      // Admin (attendanceDepartment) only sees attendance of employees in departments they created.
      if (!hasDepartmentFilter) {
        const departmentsCreatedByUser = await Department.find({
          createdBy: req.user._id,
          isActive: true
        }).select('_id');
        const deptIds = departmentsCreatedByUser.map(d => d._id);
        if (deptIds.length > 0) {
          filter.department = { $in: deptIds };
        } else {
          filter.department = { $in: [] };
        }
      }
    } else {
      filter.employee = req.user._id;
    }

    const attendanceRecords = await Attendance.find(filter)
      .select('+checkIn +checkOut')
      .populate("employee", "name employeeId email phone department")
      .populate("department", "name code")
      .populate("modifiedBy", "name")
      .sort({ date: -1, createdAt: -1 });

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

    // For attendanceDepartment role: allow only if this attendance record's department was created by them
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (requestingUserRole === "attendanceDepartment") {
      const attDeptId = attendance.department?._id || attendance.department;
      if (!attDeptId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view attendance for departments you created.",
        });
      }
      const dept = await Department.findById(attDeptId).select('createdBy');
      const isOwnDept = dept && String(dept.createdBy) === String(req.user._id);
      if (!isOwnDept) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view attendance for departments you created.",
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

    // For attendanceDepartment role: only show attendance for departments they created (same as list page)
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (requestingUserRole === "attendanceDepartment") {
      const departmentsCreatedByUser = await Department.find({
        createdBy: req.user._id,
        isActive: true
      }).select('_id');
      const deptIds = departmentsCreatedByUser.map(d => d._id);
      if (deptIds.length > 0) {
        filter.department = { $in: deptIds };
      } else {
        filter.department = { $in: [] };
      }
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

/**
 * Get employees who have not marked attendance for a given date.
 * superAdmin: all active (non-superAdmin) employees with no attendance for the date.
 * attendanceDepartment: only employees in departments they created, with no attendance for the date in those departments.
 */
export const getNotMarkedAttendance = async (req, res) => {
  try {
    const dateStr = req.query.date; // YYYY-MM-DD optional
    const targetDate = dateStr ? getDateAtMidnightUTC(new Date(dateStr)) : getTodayUTC();
    const nextDay = new Date(targetDate.getTime() + TIME.ONE_DAY);

    const role = req.user?.role?.name || req.user?.role;

    let deptIds = null;
    if (role === "attendanceDepartment") {
      const departmentsCreatedByUser = await Department.find({
        createdBy: req.user._id,
        isActive: true
      }).select("_id");
      deptIds = departmentsCreatedByUser.map((d) => d._id);
      if (deptIds.length === 0) {
        return res.status(200).json({ success: true, data: [], count: 0 });
      }
    }

    const superAdminRole = await Role.findOne({ name: "superAdmin" });
    const superAdminId = superAdminRole?._id;

    let employeeFilter = { isActive: true };
    if (superAdminId) {
      employeeFilter.role = { $ne: superAdminId };
    }
    if (role === "attendanceDepartment" && deptIds?.length) {
      employeeFilter.$or = [
        { department: { $in: deptIds } },
        { "shifts.department": { $in: deptIds } },
      ];
    }

    const employeesInScope = await Employee.find(employeeFilter)
      .select("_id name employeeId email department shifts")
      .populate("department", "name code")
      .lean();

    const markedEmployeeIds = await Attendance.distinct("employee", {
      date: { $gte: targetDate, $lt: nextDay },
      ...(deptIds?.length ? { department: { $in: deptIds } } : {}),
    });

    const markedSet = new Set(markedEmployeeIds.map((id) => String(id)));
    const notMarked = employeesInScope.filter((emp) => !markedSet.has(String(emp._id)));

    res.status(200).json({
      success: true,
      count: notMarked.length,
      data: notMarked,
      date: targetDate.toISOString().split("T")[0],
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

    const hasShifts = await hasMultipleShifts(employee._id);
    if (hasShifts) {
      delete attendanceData.workingHours;
    }

    let responseData = null;
    let responseMessage = "Manual attendance created successfully";
    let responseStatus = 201;
    let multiDepartment = false;
    let referenceId = null;

    if (hasShifts) {
      logger.info(`Manual attendance split for multi-department employee: ${userId}`);
      const splitRecords = await splitAttendanceByDepartments(attendanceData);

      const populatedRecords = await Promise.all(
        splitRecords.map(record =>
          Attendance.findById(record._id)
            .populate("employee", "name employeeId")
            .populate("department", "name")
        )
      );

      // Audit log
      await logAttendanceAction(req, "CREATE", populatedRecords[0], {
        after: { userId, date: attendanceDate, checkIn: checkInDate, checkOut: checkOutDate, isManualEntry: true }
      }, `Manual attendance created for ${employee.name} (${userId}) across ${splitRecords.length} departments`);

      const hasShiftRecords = splitRecords.length > 1;

      responseData = populatedRecords;
      responseMessage = hasShiftRecords
        ? `Manual attendance created for ${splitRecords.length} department shifts`
        : "Manual attendance created successfully";
      responseStatus = 200;
      multiDepartment = hasShiftRecords;
      referenceId = populatedRecords[0]?._id;
    } else {
      const attendance = await Attendance.create(attendanceData);

      const populatedAttendance = await Attendance.findById(attendance._id)
        .populate("employee", "name employeeId");

      // Audit log
      await logAttendanceAction(req, "CREATE", populatedAttendance, {
        after: { userId, date: attendanceDate, checkIn: checkInDate, checkOut: checkOutDate, isManualEntry: true }
      }, `Manual attendance created for ${employee.name} (${userId})`);

      responseData = populatedAttendance;
      referenceId = populatedAttendance._id;
    }

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
          referenceId: referenceId,
          referenceType: "Attendance",
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating manual attendance notification:", notifError);
    }

    res.status(responseStatus).json({
      success: true,
      message: responseMessage,
      multiDepartment,
      data: responseData,
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

// Mark holiday present for all employees or a specific department
export const markHolidayPresent = async (req, res) => {
  try {
    const { date, departmentId, scope = "all", remarks } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    if (scope === "department" && !departmentId) {
      return res.status(400).json({
        success: false,
        message: "Department is required when scope is department",
      });
    }

    const targetDate = getDateAtMidnightUTC(new Date(date));
    const nextDate = new Date(targetDate.getTime() + TIME.ONE_DAY);

    const employeeFilter = { isActive: true };
    if (scope === "department") {
      employeeFilter.$or = [
        { department: departmentId },
        { "shifts.department": departmentId },
      ];
    }

    const employees = await Employee.find(employeeFilter)
      .populate("role", "name")
      .select("_id employeeId name department shifts role");

    const eligibleEmployees = employees.filter(
      (emp) => emp.role?.name !== "superAdmin"
    );

    if (eligibleEmployees.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No eligible employees found for selected criteria",
        data: {
          processed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          date: targetDate,
          scope,
          departmentId: departmentId || null,
        },
      });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const employee of eligibleEmployees) {
      const selectedDept =
        scope === "department"
          ? departmentId
          : employee.department || employee.shifts?.[0]?.department;

      if (!selectedDept) {
        skipped += 1;
        continue;
      }

      const existing = await Attendance.findOne({
        employee: employee._id,
        date: {
          $gte: targetDate,
          $lt: nextDate,
        },
        department: selectedDept,
      });

      const remarkText = remarks?.trim() || "Holiday - manually marked present";

      if (existing) {
        existing.status = "present";
        existing.isManualEntry = true;
        existing.modifiedBy = req.user._id;
        existing.remarks = existing.remarks
          ? `${existing.remarks} | ${remarkText}`
          : remarkText;
        await existing.save();
        updated += 1;
      } else {
        await Attendance.create({
          employee: employee._id,
          userId: employee.employeeId,
          department: selectedDept,
          date: targetDate,
          status: "present",
          isManualEntry: true,
          modifiedBy: req.user._id,
          remarks: remarkText,
          checkIn: null,
          checkOut: null,
        });
        created += 1;
      }
    }

    res.status(200).json({
      success: true,
      message: `Holiday present marked. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`,
      data: {
        processed: eligibleEmployees.length,
        created,
        updated,
        skipped,
        date: targetDate,
        scope,
        departmentId: departmentId || null,
      },
    });
  } catch (error) {
    logger.error(`Error in markHolidayPresent: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Submit justification for attendance issue
export const submitJustification = async (req, res) => {
  try {
    const { attendanceId, reason } = req.body;
    const employeeId = req.user._id;

    if (!attendanceId || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Attendance ID and reason are required",
      });
    }

    const attendance = await Attendance.findById(attendanceId);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Verify this attendance belongs to the requesting employee
    if (attendance.employee.toString() !== employeeId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only submit justification for your own attendance",
      });
    }

    // Check if status is eligible for justification
    const eligibleStatuses = ["late", "absent", "half-day", "early-departure", "late-early-departure", "missing"];
    if (!eligibleStatuses.includes(attendance.status)) {
      return res.status(400).json({
        success: false,
        message: "This attendance status does not require justification",
      });
    }

    // Check if already has a pending or approved justification
    if (attendance.justificationStatus === "pending") {
      return res.status(400).json({
        success: false,
        message: "A justification is already pending for this attendance",
      });
    }

    if (attendance.justificationStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "This attendance already has an approved justification",
      });
    }

    // Update attendance with justification
    attendance.justificationReason = reason.trim();
    attendance.justificationStatus = "pending";
    await attendance.save();

    // Notify team leads and admins
    const employee = await Employee.findById(employeeId)
      .select("name employeeId department createdBy")
      .populate("department");
    
    const superAdminIds = await getSuperAdminIds();
    const recipientsSet = new Set(superAdminIds.map(id => id.toString()));

    // Add team leads who are leading this employee's department
    if (employee?.department) {
      const teamLeads = await Employee.find({
        isActive: true,
        leadingDepartments: employee.department._id,
      }).select("_id");
      
      teamLeads.forEach((tl) => recipientsSet.add(tl._id.toString()));
    }

    // Add attendance department who created this employee
    if (employee?.createdBy) {
      recipientsSet.add(employee.createdBy.toString());
    }

    if (recipientsSet.size > 0) {
      await createBulkNotifications({
        recipients: Array.from(recipientsSet),
        type: "attendance_justification",
        title: "Attendance Justification Submitted",
        message: `${employee.name} (${employee.employeeId}) submitted justification for ${attendance.status} on ${new Date(attendance.date).toLocaleDateString()}`,
        referenceId: attendance._id,
        referenceType: "Attendance",
        sender: employeeId,
      });
    }

    await logAttendanceAction(
      req,
      "JUSTIFICATION_SUBMITTED",
      attendance,
      null,
      `Justification submitted for ${attendance.status} status`
    );

    res.status(200).json({
      success: true,
      message: "Justification submitted successfully",
      data: attendance,
    });
  } catch (error) {
    logger.error(`Error in submitJustification: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve or reject justification (for team leads and admins)
export const reviewJustification = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { status, remarks } = req.body; // status: "approved" or "rejected"
    const reviewerId = req.user._id;
    const userRole = req.user?.role?.name || req.user?.role;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'approved' or 'rejected'",
      });
    }

    const attendance = await Attendance.findById(attendanceId).populate("employee");
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    if (attendance.justificationStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "No pending justification found for this attendance",
      });
    }

    // Verify the reviewer has authority over this employee
    if (userRole === "teamLead") {
      const reviewer = await Employee.findById(reviewerId).select("leadingDepartments");
      const employeeDeptId = attendance.employee.department?.toString();
      
      const hasAuthority = reviewer.leadingDepartments?.some(
        deptId => deptId.toString() === employeeDeptId
      );
      
      if (!hasAuthority) {
        return res.status(403).json({
          success: false,
          message: "You can only review justifications for employees in your departments",
        });
      }
    } else if (userRole === "attendanceDepartment") {
      // Check if this attendance department user created the employee
      const employee = await Employee.findById(attendance.employee._id).select("createdBy");
      if (employee.createdBy?.toString() !== reviewerId.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only review justifications for employees you created",
        });
      }
    }
    // superAdmin can review any justification

    // Update justification status
    attendance.justificationStatus = status;
    attendance.justifiedBy = reviewerId;
    attendance.justifiedAt = new Date();

    // If approved, mark attendance as present to avoid salary deduction
    if (status === "approved") {
      attendance.status = "present";
      attendance.isManualEntry = true;
    }
    
    if (remarks) {
      attendance.remarks = (attendance.remarks ? attendance.remarks + " | " : "") + remarks;
    }

    await attendance.save();

    // Notify the employee
    await createNotification({
      recipient: attendance.employee._id,
      type: "justification_reviewed",
      title: `Attendance Justification ${status === "approved" ? "Approved" : "Rejected"}`,
      message: `Your justification for ${attendance.status} on ${new Date(attendance.date).toLocaleDateString()} has been ${status}`,
      referenceId: attendance._id,
      referenceType: "Attendance",
      sender: reviewerId,
    });

    await logAttendanceAction(
      req,
      status === "approved" ? "JUSTIFICATION_APPROVED" : "JUSTIFICATION_REJECTED",
      attendance,
      null,
      `Justification ${status} by ${req.user.name}`
    );

    res.status(200).json({
      success: true,
      message: `Justification ${status} successfully`,
      data: attendance,
    });
  } catch (error) {
    logger.error(`Error in reviewJustification: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get pending justifications (for team leads and admins)
export const getPendingJustifications = async (req, res) => {
  try {
    const reviewerId = req.user._id;
    const userRole = req.user?.role?.name || req.user?.role;

    let filter = { justificationStatus: "pending" };

    // For team leads, only show justifications from their departments
    if (userRole === "teamLead") {
      const reviewer = await Employee.findById(reviewerId).select("leadingDepartments");
      
      if (reviewer?.leadingDepartments && reviewer.leadingDepartments.length > 0) {
        const employeesInDepartments = await Employee.find({
          department: { $in: reviewer.leadingDepartments },
          isActive: true,
        }).select("_id");

        const employeeIds = employeesInDepartments.map((emp) => emp._id);
        filter.employee = { $in: employeeIds };
      } else {
        filter.employee = { $in: [] };
      }
    }

    // For attendance department, only show justifications from employees they created
    if (userRole === "attendanceDepartment") {
      const employeesCreatedByUser = await Employee.find({
        createdBy: reviewerId,
        isActive: true,
      }).select("_id");

      const employeeIds = employeesCreatedByUser.map((emp) => emp._id);
      filter.employee = { $in: employeeIds };
    }

    const justifications = await Attendance.find(filter)
      .populate({
        path: "employee",
        select: "name employeeId email department",
        populate: {
          path: "department",
          select: "name code"
        }
      })
      .sort({ date: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      data: justifications,
    });
  } catch (error) {
    logger.error(`Error in getPendingJustifications: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

