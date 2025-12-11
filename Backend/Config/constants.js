/**
 * Application Constants
 * Centralized configuration for magic numbers and hard-coded values
 */

// Time Constants (milliseconds)
export const TIME = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
};

// Attendance Constants
export const ATTENDANCE = {
  // Default leverage times (minutes)
  DEFAULT_CHECK_IN_LEVERAGE: 15,
  DEFAULT_CHECK_OUT_LEVERAGE: 10,
  
  // Rapid punch threshold (prevent duplicate punches)
  RAPID_PUNCH_THRESHOLD: 3 * TIME.ONE_HOUR, // 3 hours
  
  // Half day calculation
  HALF_DAY_MULTIPLIER: 0.5,
  
  // Working hours calculation
  STANDARD_WEEKLY_HOURS: 40,
  WEEKS_PER_MONTH: 4,
  
  // Status values
  STATUS: {
    PRESENT: 'present',
    ABSENT: 'absent',
    HALF_DAY: 'half-day',
    LATE: 'late',
    EARLY_ARRIVAL: 'early-arrival',
    LATE_EARLY_ARRIVAL: 'late-early-arrival',
    PENDING: 'pending',
    LEAVE: 'leave',
  },
};

// Salary Calculation Constants
export const SALARY = {
  // Default thresholds
  DEFAULT_LATE_THRESHOLD: 3, // 3 late days = 1 absent
  DEFAULT_PERFECT_ATTENDANCE_THRESHOLD: 100, // 100% attendance
  
  // Percentage calculations
  PERCENTAGE_MULTIPLIER: 100,
  
  // Precision for calculations
  DECIMAL_PRECISION: 2,
  HOURS_DECIMAL_PRECISION: 100, // For rounding to 2 decimal places
};

// Security Constants
export const SECURITY = {
  // Bcrypt salt rounds
  BCRYPT_SALT_ROUNDS: 10,
  
  // JWT (if needed in future)
  JWT_EXPIRY: '7d',
};

// Pagination & Limits
export const PAGINATION = {
  DEFAULT_LIMIT: 100,
  MAX_LIMIT: 1000,
  DEFAULT_PAGE: 1,
};

// Device Configuration
export const DEVICE = {
  // ZKTeco defaults
  DEFAULT_IP: '192.168.30.201',
  DEFAULT_PORT: 4370,
  DEFAULT_TIMEOUT: 5000,
  DEFAULT_INPORT: 5200,
  
  // Polling interval (30 seconds)
  DEFAULT_POLL_INTERVAL: 30000,
  
  // Rapid punch threshold (3 hours)
  RAPID_PUNCH_THRESHOLD: 3 * 60 * 60 * 1000,
  
  // iClock protocol
  ICLOCK_MIN_PARTS: 2,
};

// String Formatting
export const FORMAT = {
  // Padding lengths
  ASSET_ID_PADDING: 5,
  DEPARTMENT_CODE_LENGTH: 3,
  
  // Date/Time formats
  DATE_TIME_PAD: 2,
  DATE_TIME_PAD_CHAR: '0',
  
  // CNIC format regex
  CNIC_REGEX: /^\d{5}-\d{7}-\d{1}$/,
};

// Department Defaults
export const DEPARTMENT = {
  DEFAULT_LEVERAGE_CHECKOUT: 10, // minutes
  DEFAULT_WORKING_DAYS: 5,
  MAX_WORKING_DAYS: 7,
  RANDOM_CODE_MAX: 1000,
};

// Scheduled Tasks
export const SCHEDULED_TASKS = {
  // Absentee check time (23:59)
  ABSENTEE_CHECK_TIME: '23:59',
  
  // Intervals
  ABSENTEE_CHECK_INTERVAL: TIME.ONE_DAY,
};

// Export default object with all constants
export default {
  TIME,
  ATTENDANCE,
  SALARY,
  SECURITY,
  PAGINATION,
  DEVICE,
  FORMAT,
  DEPARTMENT,
  SCHEDULED_TASKS,
};
