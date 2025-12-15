import Attendance from '../Model/Attendance.js';
import Employee from '../Model/Employee.js';
import logger from './logger.js';
import { TIME, SCHEDULED_TASKS } from '../Config/constants.js';

/**
 * Mark employees as absent if they have no attendance record for the day
 * This should be run at the end of each day (e.g., midnight)
 * @param {Date} targetDate - Optional date to check (defaults to today)
 */
export const markAbsentEmployees = async (targetDate = null) => {
  try {
    logger.info('Starting daily absentee marking...');
    
    // Get the target date (default to today)
    const checkDate = targetDate ? new Date(targetDate) : new Date();
    checkDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(checkDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Get day name for weekly off check
    const dayName = checkDate.toLocaleDateString("en-US", { weekday: "long" });
    
    logger.info(`Checking for date: ${checkDate.toISOString().split('T')[0]} (${dayName})`);
    
    // Get all active employees with their work schedule
    const activeEmployees = await Employee.find({ isActive: true }).select('_id employeeId name workSchedule');
    logger.info(`Total active employees: ${activeEmployees.length}`);
    
    let markedAbsent = 0;
    let alreadyMarked = 0;
    let weeklyOffSkipped = 0;
    
    // Check each employee for attendance
    for (const employee of activeEmployees) {
      // Check if today is a weekly off for this employee
      const weeklyOffs = employee.workSchedule?.weeklyOffs || ["Saturday", "Sunday"];
      if (weeklyOffs.includes(dayName)) {
        weeklyOffSkipped++;
        continue; // Skip marking absent on weekly offs
      }
      
      // Check if attendance record exists for the target date
      const existingAttendance = await Attendance.findOne({
        $or: [{ employee: employee._id }, { userId: employee.employeeId }],
        date: {
          $gte: checkDate,
          $lt: nextDay,
        },
      });
      
      if (!existingAttendance) {
        // No attendance record - mark as absent
        await Attendance.create({
          employee: employee._id,
          userId: employee.employeeId,
          date: checkDate,
          checkIn: null,
          checkOut: null,
          status: 'absent',
          workingHours: 0,
          remarks: 'Auto-marked absent - No check-in/check-out recorded',
          isManualEntry: false,
        });
        
        logger.info(`Marked absent: ${employee.name} (${employee.employeeId})`);
        markedAbsent++;
      } else {
        alreadyMarked++;
      }
    }
    
    logger.info(`Absentee marking completed - Marked absent: ${markedAbsent}, Already had attendance: ${alreadyMarked}, Weekly off skipped: ${weeklyOffSkipped}, Total: ${activeEmployees.length}`);
    
    return { markedAbsent, alreadyMarked, weeklyOffSkipped, total: activeEmployees.length };
  } catch (error) {
    logger.error(`Error marking absentees: ${error.message}`, { stack: error.stack });
    throw error;
  }
};

/**
 * Mark absent employees for a date range (useful for backfilling)
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
export const markAbsentForDateRange = async (startDate, endDate) => {
  try {
    logger.info(`Marking absences for date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    const results = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    while (currentDate <= end) {
      const result = await markAbsentEmployees(currentDate);
      results.push({
        date: currentDate.toISOString().split('T')[0],
        ...result
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return results;
  } catch (error) {
    logger.error(`Error marking absences for date range: ${error.message}`, { stack: error.stack });
    throw error;
  }
};

/**
 * Schedule the absentee check to run daily at a specific time
 * @param {string} time - Time in HH:MM format (24-hour), e.g., "23:59"
 */
export const scheduleAbsenteeCheck = (time = SCHEDULED_TASKS.ABSENTEE_CHECK_TIME) => {
  const [hours, minutes] = time.split(':').map(Number);
  
  // Calculate milliseconds until next scheduled time
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hours, minutes, 0, 0);
  
  // If scheduled time has passed today, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }
  
  const msUntilScheduled = scheduledTime - now;
  
  logger.info(`Absentee check scheduled to run daily at ${time}. Next run: ${scheduledTime.toLocaleString()}`);
  
  // Set initial timeout
  setTimeout(() => {
    // Run the check
    markAbsentEmployees().catch(err => {
      logger.error(`Failed to mark absentees: ${err.message}`, { stack: err.stack });
    });
    
    // Schedule to run every 24 hours
    setInterval(() => {
      markAbsentEmployees().catch(err => {
        logger.error(`Failed to mark absentees: ${err.message}`, { stack: err.stack });
      });
    }, SCHEDULED_TASKS.ABSENTEE_CHECK_INTERVAL);
  }, msUntilScheduled);
};
