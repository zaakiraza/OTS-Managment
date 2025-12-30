/**
 * Centralized Timezone Handling Utility
 * 
 * This utility provides consistent timezone handling across the application.
 * The system stores all dates in UTC but displays them in local timezone (PKT - Pakistan Standard Time).
 * 
 * Key Concepts:
 * - All dates in MongoDB are stored as UTC
 * - Device times (ZKTeco) are received in local time (PKT) and converted to UTC for storage
 * - API responses can include formatted local times for display
 * - All comparisons and calculations use UTC internally
 */

import { TIME } from "../Config/constants.js";

// Timezone Configuration
export const TIMEZONE = {
  // Pakistan Standard Time offset from UTC (in hours)
  PKT_OFFSET_HOURS: 5,
  PKT_OFFSET_MS: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
  
  // Timezone identifiers
  LOCAL_TZ: "Asia/Karachi",
  UTC_TZ: "UTC",
};

/**
 * Convert a local time (PKT) to UTC
 * Use this when receiving times from biometric devices or manual entry
 * 
 * @param {Date|string} localTime - Local time (PKT)
 * @returns {Date} - UTC time
 */
export const localToUTC = (localTime) => {
  if (!localTime) return null;
  
  const date = localTime instanceof Date ? localTime : new Date(localTime);
  if (isNaN(date.getTime())) return null;
  
  // Subtract PKT offset to convert to UTC
  return new Date(date.getTime() - TIMEZONE.PKT_OFFSET_MS);
};

/**
 * Convert UTC time to local time (PKT)
 * Use this when displaying times to users
 * 
 * @param {Date|string} utcTime - UTC time
 * @returns {Date} - Local time (PKT)
 */
export const utcToLocal = (utcTime) => {
  if (!utcTime) return null;
  
  const date = utcTime instanceof Date ? utcTime : new Date(utcTime);
  if (isNaN(date.getTime())) return null;
  
  // Add PKT offset to convert to local
  return new Date(date.getTime() + TIMEZONE.PKT_OFFSET_MS);
};

/**
 * Parse a time string (HH:MM or HH:MM:SS) and combine with a date to create UTC datetime
 * This handles the common case of manual attendance entry
 * 
 * @param {Date|string} date - The date to combine with
 * @param {string} timeStr - Time string in HH:MM or HH:MM:SS format
 * @returns {Date} - UTC datetime
 */
export const parseLocalTimeToUTC = (date, timeStr) => {
  if (!date || !timeStr) return null;
  
  // Validate time string format
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    return null;
  }
  
  const baseDate = date instanceof Date ? date : new Date(date);
  if (isNaN(baseDate.getTime())) return null;
  
  const [hours, minutes, seconds = 0] = timeStr.split(":").map(Number);
  
  // Validate time values
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }
  
  // Create UTC date at midnight of the base date
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const day = baseDate.getUTCDate();
  
  // Create a Date representing the local time (PKT) at midnight UTC of the base date
  // Then add the time components and subtract PKT offset to get UTC
  // This ensures we're treating the input time as PKT, not server local time
  const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  
  // Subtract PKT offset (5 hours) to convert from PKT to UTC
  // If user enters 10:00 AM PKT, we want 05:00 AM UTC
  return new Date(utcDate.getTime() - TIMEZONE.PKT_OFFSET_MS);
};

/**
 * Format a UTC date to local time string (HH:MM)
 * 
 * @param {Date|string} utcTime - UTC time
 * @returns {string} - Formatted time string (HH:MM)
 */
export const formatLocalTime = (utcTime) => {
  if (!utcTime) return "-";
  
  const localTime = utcToLocal(utcTime);
  if (!localTime) return "-";
  
  const hours = String(localTime.getHours()).padStart(2, "0");
  const minutes = String(localTime.getMinutes()).padStart(2, "0");
  
  return `${hours}:${minutes}`;
};

/**
 * Format a UTC date to local time string with seconds (HH:MM:SS)
 * 
 * @param {Date|string} utcTime - UTC time
 * @returns {string} - Formatted time string (HH:MM:SS)
 */
export const formatLocalTimeWithSeconds = (utcTime) => {
  if (!utcTime) return "-";
  
  const localTime = utcToLocal(utcTime);
  if (!localTime) return "-";
  
  const hours = String(localTime.getHours()).padStart(2, "0");
  const minutes = String(localTime.getMinutes()).padStart(2, "0");
  const seconds = String(localTime.getSeconds()).padStart(2, "0");
  
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Format a UTC date to local date string (YYYY-MM-DD)
 * 
 * @param {Date|string} utcTime - UTC time
 * @returns {string} - Formatted date string
 */
export const formatLocalDate = (utcTime) => {
  if (!utcTime) return "-";
  
  const localTime = utcToLocal(utcTime);
  if (!localTime) return "-";
  
  const year = localTime.getFullYear();
  const month = String(localTime.getMonth() + 1).padStart(2, "0");
  const day = String(localTime.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
};

/**
 * Get today's date at midnight in UTC (for date comparisons)
 * 
 * @returns {Date} - Today at midnight UTC
 */
export const getTodayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
};

/**
 * Get a date at midnight UTC from a local date
 * 
 * @param {Date|string} localDate - Local date
 * @returns {Date} - Date at midnight UTC
 */
export const getDateAtMidnightUTC = (localDate) => {
  if (!localDate) return null;
  
  const date = localDate instanceof Date ? localDate : new Date(localDate);
  if (isNaN(date.getTime())) return null;
  
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
};

/**
 * Get the start and end of a day in UTC for date range queries
 * 
 * @param {Date|string} date - The date
 * @returns {{ start: Date, end: Date }} - Start and end of day in UTC
 */
export const getDayRangeUTC = (date) => {
  const startOfDay = getDateAtMidnightUTC(date);
  if (!startOfDay) return null;
  
  const endOfDay = new Date(startOfDay.getTime() + TIME.ONE_DAY - 1);
  
  return { start: startOfDay, end: endOfDay };
};

/**
 * Get the start and end of a month in UTC for date range queries
 * 
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {{ start: Date, end: Date }} - Start and end of month in UTC
 */
export const getMonthRangeUTC = (month, year) => {
  if (month < 1 || month > 12) return null;
  
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  
  return { start: startOfMonth, end: endOfMonth };
};

/**
 * Parse device timestamp (from ZKTeco)
 * Device sends local time, we need to store as UTC
 * 
 * @param {string|Date} deviceTime - Time from biometric device (in local timezone)
 * @returns {{ datetime: Date, dateStr: string, timeStr: string }} - Parsed and converted times
 */
export const parseDeviceTimestamp = (deviceTime) => {
  if (!deviceTime) return null;
  
  const dt = deviceTime instanceof Date ? deviceTime : new Date(deviceTime);
  if (isNaN(dt.getTime())) return null;
  
  // Extract local time components
  const year = dt.getFullYear();
  const month = dt.getMonth();
  const day = dt.getDate();
  const hours = dt.getHours();
  const minutes = dt.getMinutes();
  const seconds = dt.getSeconds();
  
  // Format strings (in local time for logging/display)
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  
  // Convert to UTC for storage
  const utcHours = hours - TIMEZONE.PKT_OFFSET_HOURS;
  const datetime = new Date(Date.UTC(year, month, day, utcHours, minutes, seconds));
  
  return { datetime, dateStr, timeStr };
};

/**
 * Check if a time is within a schedule window (with leverage)
 * 
 * @param {Date} actualTime - The actual check-in/out time (UTC)
 * @param {string} scheduledTime - Scheduled time in HH:MM format
 * @param {number} leverageMinutes - Grace period in minutes
 * @param {string} type - "checkIn" or "checkOut"
 * @returns {{ isOnTime: boolean, diffMinutes: number }}
 */
export const checkTimeWithLeverage = (actualTime, scheduledTime, leverageMinutes, type = "checkIn") => {
  if (!actualTime || !scheduledTime) {
    return { isOnTime: false, diffMinutes: 0 };
  }
  
  const [schedHour, schedMinute] = scheduledTime.split(":").map(Number);
  
  // Convert actual UTC time to local for comparison
  const localActual = utcToLocal(actualTime);
  
  // Create scheduled time on same day
  const scheduledDate = new Date(localActual);
  scheduledDate.setHours(schedHour, schedMinute, 0, 0);
  
  // Calculate difference in minutes
  const diffMs = localActual.getTime() - scheduledDate.getTime();
  const diffMinutes = diffMs / TIME.ONE_MINUTE;
  
  // For check-in: positive diff means late
  // For check-out: negative diff means left early
  let isOnTime;
  if (type === "checkIn") {
    isOnTime = diffMinutes <= leverageMinutes;
  } else {
    isOnTime = diffMinutes >= -leverageMinutes;
  }
  
  return { isOnTime, diffMinutes };
};

// Export default object with all utilities
export default {
  TIMEZONE,
  localToUTC,
  utcToLocal,
  parseLocalTimeToUTC,
  formatLocalTime,
  formatLocalTimeWithSeconds,
  formatLocalDate,
  getTodayUTC,
  getDateAtMidnightUTC,
  getDayRangeUTC,
  getMonthRangeUTC,
  parseDeviceTimestamp,
  checkTimeWithLeverage,
};

