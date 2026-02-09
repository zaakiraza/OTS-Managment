import Attendance from "../Model/Attendance.js";
import Employee from "../Model/Employee.js";
import logger from "./logger.js";

/**
 * Splits a single attendance record into multiple department-based records
 * for employees working in multiple departments with defined shifts
 * 
 * @param {Object} attendanceData - The original attendance data
 * @param {String} attendanceData.userId - Employee ID
 * @param {ObjectId} attendanceData.employee - Employee ObjectId
 * @param {Date} attendanceData.date - Attendance date
 * @param {Date} attendanceData.checkIn - Check-in timestamp
 * @param {Date} attendanceData.checkOut - Check-out timestamp
 * @param {String} attendanceData.deviceId - Device ID (optional)
 * @param {Boolean} attendanceData.isManualEntry - Manual entry flag
 * @returns {Promise<Array>} Array of created/updated attendance records
 */
export const splitAttendanceByDepartments = async (attendanceData) => {
  try {
    const {
      userId,
      employee: employeeId,
      date,
      checkIn,
      checkOut,
      deviceId,
      isManualEntry,
      remarks,
      status,
      workingHours,
      modifiedBy,
    } = attendanceData;

    // Fetch employee with department shifts
    const employee = await Employee.findById(employeeId)
      .populate('department')
      .populate('departmentShifts.department');

    if (!employee) {
      logger.error(`Employee not found for splitting attendance: ${userId}`);
      return [];
    }

    // If no department shifts configured, return single attendance record
    if (!employee.departmentShifts || employee.departmentShifts.length === 0) {
      logger.info(`No department shifts configured for ${userId}, creating single attendance record`);
      return [attendanceData];
    }

    // Get active shifts for the current day
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
    const activeShifts = employee.departmentShifts.filter(
      shift => shift.isActive && shift.daysOfWeek.includes(dayOfWeek)
    );

    if (activeShifts.length === 0) {
      logger.info(`No active shifts for ${userId} on ${dayOfWeek}, creating single attendance record`);
      const singleAttendance = await Attendance.create({
        employee: employeeId,
        userId: userId,
        date: date,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        isShiftBased: false,
        deviceId: deviceId || "",
        isManualEntry: isManualEntry || false,
        remarks: remarks || "",
        modifiedBy: modifiedBy || null,
        status: status || undefined,
        workingHours: workingHours !== undefined ? workingHours : undefined,
      });
      return [singleAttendance];
    }

    // Sort shifts by start time to process them in order
    activeShifts.sort((a, b) => {
      // Get effective start time (day-specific or default)
      const aStartTime = (a.daySchedules && a.daySchedules.get(dayOfWeek))?.startTime || a.startTime;
      const bStartTime = (b.daySchedules && b.daySchedules.get(dayOfWeek))?.startTime || b.startTime;
      
      const [aHour, aMin] = aStartTime.split(':').map(Number);
      const [bHour, bMin] = bStartTime.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });

    logger.info(`Splitting attendance for ${userId} across ${activeShifts.length} departments`);

    const attendanceRecords = [];
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);

    // Create attendance records for each department shift
    for (const shift of activeShifts) {
      // Check if there's a day-specific schedule for this day
      let startTime = shift.startTime;
      let endTime = shift.endTime;
      
      if (shift.daySchedules && shift.daySchedules.get(dayOfWeek)) {
        const daySchedule = shift.daySchedules.get(dayOfWeek);
        startTime = daySchedule.startTime || startTime;
        endTime = daySchedule.endTime || endTime;
        logger.info(`Using day-specific schedule for ${userId} on ${dayOfWeek}: ${startTime}-${endTime}`);
      }

      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      // Create shift time boundaries for today
      const shiftStart = new Date(todayStart);
      shiftStart.setHours(startHour, startMin, 0, 0);

      const shiftEnd = new Date(todayStart);
      shiftEnd.setHours(endHour, endMin, 0, 0);

      // Determine check-in and check-out times for this shift
      let shiftCheckIn = null;
      let shiftCheckOut = null;

      // If employee checked in before or during this shift
      if (checkIn && checkIn <= shiftEnd) {
        // Use actual check-in if it's before shift end, otherwise use shift start
        shiftCheckIn = checkIn < shiftStart ? shiftStart : checkIn;
      }

      // If employee checked out during or after this shift
      if (checkOut && checkOut >= shiftStart) {
        // Use actual check-out if it's after shift start, otherwise use shift end
        shiftCheckOut = checkOut > shiftEnd ? shiftEnd : checkOut;
      }

      // Find or create attendance record for this department
      let deptAttendance = await Attendance.findOne({
        employee: employeeId,
        userId: userId,
        date: {
          $gte: todayStart,
          $lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
        },
        department: shift.department._id,
        isShiftBased: true,
      });

      if (!deptAttendance) {
        // Create new department-specific attendance record
        deptAttendance = await Attendance.create({
          employee: employeeId,
          userId: userId,
          date: date,
          checkIn: shiftCheckIn,
          checkOut: shiftCheckOut,
          department: shift.department._id,
          shiftStartTime: startTime,
          shiftEndTime: endTime,
          isShiftBased: true,
          deviceId: deviceId || "",
          isManualEntry: isManualEntry || false,
          remarks: remarks || "",
          modifiedBy: modifiedBy || null,
          status: status || undefined,
          workingHours: workingHours !== undefined ? workingHours : undefined,
        });

        logger.info(`Created shift attendance for ${userId} - ${shift.department.name} (${startTime}-${endTime})`);
      } else {
        // Update existing record
        if (shiftCheckIn && !deptAttendance.checkIn) {
          deptAttendance.checkIn = shiftCheckIn;
        }
        if (shiftCheckOut) {
          deptAttendance.checkOut = shiftCheckOut;
        }
        // Update shift times (in case day-specific schedule changed)
        deptAttendance.shiftStartTime = startTime;
        deptAttendance.shiftEndTime = endTime;
        if (isManualEntry) {
          deptAttendance.isManualEntry = true;
        }
        if (remarks !== undefined) {
          deptAttendance.remarks = remarks;
        }
        if (modifiedBy) {
          deptAttendance.modifiedBy = modifiedBy;
        }
        if (status) {
          deptAttendance.status = status;
        }
        if (workingHours !== undefined) {
          deptAttendance.workingHours = workingHours;
        }
        await deptAttendance.save();

        logger.info(`Updated shift attendance for ${userId} - ${shift.department.name} (${startTime}-${endTime})`);
      }

      attendanceRecords.push(deptAttendance);
    }

    return attendanceRecords;
  } catch (error) {
    logger.error(`Error splitting attendance: ${error.message}`, { stack: error.stack });
    throw error;
  }
};

/**
 * Helper function to convert time string (HH:MM) to minutes since midnight
 * @param {String} timeStr - Time in HH:MM format
 * @returns {Number} Minutes since midnight
 */
export const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Check if employee has department shifts configured
 * @param {ObjectId} employeeId - Employee ObjectId
 * @returns {Promise<Boolean>}
 */
export const hasMultiDepartmentShifts = async (employeeId) => {
  try {
    const employee = await Employee.findById(employeeId).select('departmentShifts');
    return employee && employee.departmentShifts && employee.departmentShifts.length > 0;
  } catch (error) {
    logger.error(`Error checking department shifts: ${error.message}`);
    return false;
  }
};
