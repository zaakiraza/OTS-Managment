import Attendance from '../Model/Attendance.js';
import Employee from '../Model/Employee.js';
import logger from './logger.js';
import { TIME, SCHEDULED_TASKS } from '../Config/constants.js';

/**
 * Mark employees as absent if they have no attendance record for the day
 * This should be run at the end of each day (e.g., midnight)
 */
export const markAbsentEmployees = async () => {
  try {
    logger.info('Starting daily absentee marking...');
    
    // Get today's date range (from midnight to midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    logger.info(`Checking for date: ${today.toISOString().split('T')[0]}`);
    
    // Get all active employees
    const activeEmployees = await Employee.find({ isActive: true }).select('_id employeeId name');
    logger.info(`Total active employees: ${activeEmployees.length}`);
    
    let markedAbsent = 0;
    let alreadyMarked = 0;
    
    // Check each employee for attendance
    for (const employee of activeEmployees) {
      // Check if attendance record exists for today
      const existingAttendance = await Attendance.findOne({
        employee: employee._id,
        date: {
          $gte: today,
          $lt: tomorrow,
        },
      });
      
      if (!existingAttendance) {
        // No attendance record - mark as absent
        await Attendance.create({
          employee: employee._id,
          userId: employee.employeeId,
          date: today,
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
    
    logger.info(`Absentee marking completed - Marked absent: ${markedAbsent}, Already had attendance: ${alreadyMarked}, Total: ${activeEmployees.length}`);
    
    return { markedAbsent, alreadyMarked, total: activeEmployees.length };
  } catch (error) {
    logger.error(`Error marking absentees: ${error.message}`, { stack: error.stack });
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
