import Attendance from "../Model/Attendance.js";
import { getDateAtMidnightUTC } from "./timezone.js";
import logger from "./logger.js";

/**
 * Mark all pending attendance records from before today as "missing"
 * This handles cases where employees checked in but forgot to checkout
 */
export const markOldPendingAsMissing = async () => {
  try {
    // Get today's date at midnight UTC
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);

    // Find all pending records from before today and update them
    const result = await Attendance.updateMany(
      {
        status: "pending",
        date: { $lt: todayMidnight },
      },
      {
        $set: {
          status: "missing",
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Marked ${result.modifiedCount} pending attendance records as missing`);
    }

    return result;
  } catch (error) {
    logger.error(`Error in markOldPendingAsMissing: ${error.message}`, { stack: error.stack });
    throw error;
  }
};

/**
 * Schedule the missing attendance marking to run daily at midnight
 * Can be called once when the server starts
 */
export const scheduleMarkMissingAttendance = () => {
  try {
    // Calculate milliseconds until next midnight UTC
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Run immediately first time
    markOldPendingAsMissing();

    // Then schedule to run daily at midnight UTC
    setTimeout(() => {
      markOldPendingAsMissing();
      // Schedule again every 24 hours
      setInterval(markOldPendingAsMissing, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    logger.info(`Scheduled daily missing attendance marking (next run in ${msUntilMidnight / 1000 / 60} minutes)`);
  } catch (error) {
    logger.error(`Error scheduling missing attendance marking: ${error.message}`);
  }
};
