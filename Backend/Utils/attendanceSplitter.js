import Attendance from "../Model/Attendance.js";
import Employee from "../Model/Employee.js";
import logger from "./logger.js";

/**
 * Splits a single attendance record into multiple department-based records
 * for employees working in multiple departments with defined shifts
 * 
 * @param {Object} attendanceData - The original attendance data
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

    // Fetch employee with shifts
    const employee = await Employee.findById(employeeId)
      .populate('shifts.department');

    if (!employee) {
      logger.error(`Employee not found for splitting attendance: ${userId}`);
      return [];
    }

    // If only one shift, create single attendance record
    if (!employee.shifts || employee.shifts.length <= 1) {
      const shift = employee.shifts?.[0];
      const singleAttendance = await Attendance.create({
        employee: employeeId,
        userId: userId,
        date: date,
        department: shift?.department?._id || employee.department,
        shiftStartTime: shift?.workSchedule?.checkInTime || "09:00",
        shiftEndTime: shift?.workSchedule?.checkOutTime || "17:00",
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        deviceId: deviceId || "",
        isManualEntry: isManualEntry || false,
        remarks: remarks || "",
        modifiedBy: modifiedBy || null,
        status: status || undefined,
        workingHours: workingHours !== undefined ? workingHours : undefined,
      });
      return [singleAttendance];
    }

    // Get active shifts for the current day
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
    const activeShifts = employee.shifts.filter(shift => {
      if (!shift.isActive) return false;
      const ws = shift.workSchedule;
      // Check if this day is NOT a weekly off
      const weeklyOffs = ws?.weeklyOffs || ["Saturday", "Sunday"];
      return !weeklyOffs.includes(dayOfWeek);
    });

    if (activeShifts.length === 0) {
      logger.info(`No active shifts for ${userId} on ${dayOfWeek}, creating single attendance record`);
      const primaryShift = employee.shifts.find(s => s.isPrimary) || employee.shifts[0];
      const singleAttendance = await Attendance.create({
        employee: employeeId,
        userId: userId,
        date: date,
        department: primaryShift.department._id || employee.department,
        shiftStartTime: primaryShift.workSchedule?.checkInTime || "09:00",
        shiftEndTime: primaryShift.workSchedule?.checkOutTime || "17:00",
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        deviceId: deviceId || "",
        isManualEntry: isManualEntry || false,
        remarks: remarks || "",
        modifiedBy: modifiedBy || null,
        status: status || undefined,
        workingHours: workingHours !== undefined ? workingHours : undefined,
      });
      return [singleAttendance];
    }

    // Sort shifts by check-in time
    activeShifts.sort((a, b) => {
      const ws_a = a.workSchedule;
      const ws_b = b.workSchedule;
      // Check for day-specific schedule
      const aStart = ws_a?.daySchedules?.get?.(dayOfWeek)?.checkInTime || ws_a?.checkInTime || "09:00";
      const bStart = ws_b?.daySchedules?.get?.(dayOfWeek)?.checkInTime || ws_b?.checkInTime || "09:00";
      
      const [aHour, aMin] = aStart.split(':').map(Number);
      const [bHour, bMin] = bStart.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });

    logger.info(`Splitting attendance for ${userId} across ${activeShifts.length} departments`);

    const attendanceRecords = [];
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);

    for (const shift of activeShifts) {
      const ws = shift.workSchedule;
      let startTime = ws?.checkInTime || "09:00";
      let endTime = ws?.checkOutTime || "17:00";
      
      // Day-specific schedule override
      if (ws?.daySchedules?.get?.(dayOfWeek)) {
        const daySchedule = ws.daySchedules.get(dayOfWeek);
        if (!daySchedule.isOff) {
          startTime = daySchedule.checkInTime || startTime;
          endTime = daySchedule.checkOutTime || endTime;
        }
      }

      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      const shiftStart = new Date(todayStart);
      shiftStart.setHours(startHour, startMin, 0, 0);

      const shiftEnd = new Date(todayStart);
      shiftEnd.setHours(endHour, endMin, 0, 0);

      let shiftCheckIn = null;
      let shiftCheckOut = null;

      if (checkIn && checkIn <= shiftEnd) {
        shiftCheckIn = checkIn < shiftStart ? shiftStart : checkIn;
      }

      if (checkOut && checkOut >= shiftStart) {
        shiftCheckOut = checkOut > shiftEnd ? shiftEnd : checkOut;
      }

      const deptId = shift.department._id || shift.department;

      // Find or create attendance record for this department
      let deptAttendance = await Attendance.findOne({
        employee: employeeId,
        userId: userId,
        date: {
          $gte: todayStart,
          $lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
        },
        department: deptId,
      });

      if (!deptAttendance) {
        deptAttendance = await Attendance.create({
          employee: employeeId,
          userId: userId,
          date: date,
          checkIn: shiftCheckIn,
          checkOut: shiftCheckOut,
          department: deptId,
          shiftStartTime: startTime,
          shiftEndTime: endTime,
          deviceId: deviceId || "",
          isManualEntry: isManualEntry || false,
          remarks: remarks || "",
          modifiedBy: modifiedBy || null,
          status: status || undefined,
          workingHours: workingHours !== undefined ? workingHours : undefined,
        });

        logger.info(`Created shift attendance for ${userId} - ${shift.department.name || deptId} (${startTime}-${endTime})`);
      } else {
        if (shiftCheckIn && !deptAttendance.checkIn) {
          deptAttendance.checkIn = shiftCheckIn;
        }
        if (shiftCheckOut) {
          deptAttendance.checkOut = shiftCheckOut;
        }
        deptAttendance.shiftStartTime = startTime;
        deptAttendance.shiftEndTime = endTime;
        if (isManualEntry) deptAttendance.isManualEntry = true;
        if (remarks !== undefined) deptAttendance.remarks = remarks;
        if (modifiedBy) deptAttendance.modifiedBy = modifiedBy;
        if (status) deptAttendance.status = status;
        if (workingHours !== undefined) deptAttendance.workingHours = workingHours;
        await deptAttendance.save();

        logger.info(`Updated shift attendance for ${userId} - ${shift.department.name || deptId} (${startTime}-${endTime})`);
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
 */
export const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Check if employee has multiple shifts configured
 * @param {ObjectId} employeeId - Employee ObjectId
 * @returns {Promise<Boolean>}
 */
export const hasMultipleShifts = async (employeeId) => {
  try {
    const employee = await Employee.findById(employeeId).select('shifts');
    return employee && employee.shifts && employee.shifts.length > 1;
  } catch (error) {
    logger.error(`Error checking shifts: ${error.message}`);
    return false;
  }
};
