import Zkteco from 'zkteco-js';
import AttendanceLog from '../Model/AttendanceLog.js';
import Employee from '../Model/Employee.js';
import Attendance from '../Model/Attendance.js';
import Role from '../Model/Role.js';
import Settings from '../Model/Settings.js';
import logger from './logger.js';
import { DEVICE, TIME } from '../Config/constants.js';
import { parseDeviceTimestamp, getDateAtMidnightUTC } from './timezone.js';
import { splitAttendanceByDepartments, hasMultipleShifts } from './attendanceSplitter.js';

// Device configuration
const DEVICE_IP = process.env.DEVICE_IP || DEVICE.DEFAULT_IP;
const DEVICE_PORT = Number(process.env.DEVICE_PORT || DEVICE.DEFAULT_PORT);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || DEVICE.DEFAULT_POLL_INTERVAL);

let isPolling = false;
let firstLogShapePrinted = false;
let lastProcessedSN = 0; // Track last serial number processed
let pollingInterval = null;
let isInitialized = false; // Track if we've loaded lastProcessedSN from DB

/**
 * Load last processed SN from database
 */
async function loadLastProcessedSN() {
  try {
    const savedSN = await Settings.getValue('lastProcessedAttendanceSN', 0);
    lastProcessedSN = Number(savedSN) || 0;
    logger.info(`Loaded last processed attendance SN from database: ${lastProcessedSN}`);
    return lastProcessedSN;
  } catch (error) {
    logger.error(`Failed to load last processed SN: ${error.message}`);
    return 0;
  }
}

/**
 * Save last processed SN to database
 */
async function saveLastProcessedSN(sn) {
  try {
    await Settings.setValue('lastProcessedAttendanceSN', sn);
    logger.debug(`Saved last processed attendance SN to database: ${sn}`);
  } catch (error) {
    logger.error(`Failed to save last processed SN: ${error.message}`);
  }
}

/**
 * Create a fresh device instance to avoid socket reuse issues
 */
function createDeviceInstance() {
  return new Zkteco(DEVICE_IP, DEVICE_PORT, DEVICE.DEFAULT_INPORT, DEVICE.DEFAULT_TIMEOUT);
}

/**
 * Map ZKTeco log to AttendanceLog document
 * zkteco-js returns array of log objects with fields:
 *   { sn, user_id, record_time, type, state, ip }
 * 
 * Uses centralized timezone handling from Utils/timezone.js
 */
function mapZkLogToDoc(log) {
  // Get user_id
  const userId = String(log.user_id ?? log.userId ?? log.uid ?? '');
  if (!userId) return null;

  // Parse timestamp - record_time is a string date
  let dt;
  if (log.record_time) {
    dt = new Date(log.record_time);
  } else if (log.timestamp) {
    dt = new Date(log.timestamp);
  } else {
    return null;
  }

  if (isNaN(dt.getTime())) return null; // invalid date

  // Use centralized timezone utility to parse device timestamp
  const parsed = parseDeviceTimestamp(dt);
  if (!parsed) return null;

  return {
    datetime: parsed.datetime,  // UTC datetime for storage
    date: parsed.dateStr,       // Local date string for display
    time: parsed.timeStr,       // Local time string for display
    userId,
    status: Number(log.type ?? log.status ?? 0),           // verification type
    punch: Number(log.state ?? log.punch ?? 0),            // check-in/out
    workcode: String(log.workCode ?? log.workcode ?? ''),
    deviceIp: log.ip ?? DEVICE_IP,
  };
}
async function processAttendanceLog(doc) {
  try {
    // Find employee by biometric ID (userId from device) with role populated
    const employee = await Employee.findOne({
      biometricId: doc.userId.toString().trim(),
      isActive: true
    }).populate('department', 'name leverageTime')
      .populate('role', 'name');

    if (!employee) {
      logger.debug(`Employee with biometric ID ${doc.userId} not found in system`);
      return;
    }

    // Skip attendance for superAdmin
    if (employee.role?.name === 'superAdmin') {
      logger.debug(`Skipping attendance for superAdmin: ${employee.name}`);
      return;
    }

    // Get date at midnight in UTC for consistent storage using centralized utility
    const punchTime = doc.datetime;
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
    const RAPID_PUNCH_THRESHOLD_MS = DEVICE.RAPID_PUNCH_THRESHOLD || (3 * TIME.ONE_HOUR);

    if (!attendance) {
      // First punch of the day - create new record with check-in
      // Get department from primary shift or default
      const primaryShift = employee.shifts?.find(s => s.isPrimary) || employee.shifts?.[0];
      const deptId = primaryShift?.department || employee.department;

      attendance = await Attendance.create({
        employee: employee._id,
        userId: employee.employeeId,
        date: dateOnly,
        department: deptId,
        checkIn: punchTime,
        checkOut: null,
        deviceId: doc.deviceIp,
        isManualEntry: false,
      });
      punchType = 'CHECK-IN';
      logger.debug(`${employee.name} (${employee.employeeId}) - ${punchType}`);
    } else if (!attendance.checkIn) {
      // Has record but no check-in (edge case)
      attendance.checkIn = punchTime;
      attendance.deviceId = doc.deviceIp;
      await attendance.save();
      punchType = 'CHECK-IN';
      logger.debug(`${employee.name} (${employee.employeeId}) - ${punchType}`);
    } else if (!attendance.checkOut) {
      // Already has check-in, this might be check-out
      // But first check if it's a rapid punch (within 30 minutes of check-in)
      const timeSinceCheckIn = punchTime.getTime() - attendance.checkIn.getTime();

      if (timeSinceCheckIn < RAPID_PUNCH_THRESHOLD_MS) {
        // Rapid punch detected - ignore it
        logger.debug(`${employee.name} (${employee.employeeId}) - IGNORED (rapid punch: ${Math.round(timeSinceCheckIn / 60000)} min after check-in)`);
        return; // Skip this punch
      }

      // Valid checkout - sufficient time has passed
      attendance.checkOut = punchTime;
      await attendance.save();
      punchType = 'CHECK-OUT';
      logger.debug(`${employee.name} (${employee.employeeId}) - ${punchType}`);

      // Check if employee has multiple shifts and split attendance if needed
      const hasShifts = await hasMultipleShifts(employee._id);
      if (hasShifts) {
        logger.info(`Multi-shift employee detected: ${employee.employeeId}, splitting attendance`);

        // Prepare attendance data for splitting
        const attendanceData = {
          employee: employee._id,
          userId: employee.employeeId,
          date: dateOnly,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          deviceId: doc.deviceIp,
          isManualEntry: false,
        };

        // Delete the single attendance record
        await Attendance.deleteOne({ _id: attendance._id });

        // Create split records across departments
        const splitRecords = await splitAttendanceByDepartments(attendanceData);
        logger.info(`Attendance split into ${splitRecords.length} department records for ${employee.employeeId}`);
      }
    } else {
      // Already checked in and out today - ignore additional punches
      logger.debug(`${employee.name} (${employee.employeeId}) - Skipped (already complete)`);
    }
  } catch (error) {
    logger.error(`Error processing attendance for user ${doc.userId}: ${error.message}`, { stack: error.stack });
  }
}

/**
 * Poll device once for attendance logs with retry logic
 */
async function pollDeviceOnce() {
  if (isPolling) {
    logger.debug('Poll already in progress, skipping this interval.');
    return;
  }
  isPolling = true;

  const device = createDeviceInstance();
  let retryCount = 0;
  const maxRetries = DEVICE.MAX_RETRY_ATTEMPTS || 3;

  while (retryCount < maxRetries) {
    try {
      logger.debug(`Connecting to device: ${DEVICE_IP}:${DEVICE_PORT} (attempt ${retryCount + 1}/${maxRetries})`);
      await device.createSocket();
      break; // Connection successful, exit retry loop
    } catch (connectError) {
      retryCount++;
      if (retryCount < maxRetries) {
        logger.warn(`Connection failed (attempt ${retryCount}/${maxRetries}): ${connectError.message}. Retrying in ${DEVICE.RETRY_DELAY || 2000}ms...`);
        await new Promise(resolve => setTimeout(resolve, DEVICE.RETRY_DELAY || 2000));
      } else {
        logger.error(`Failed to connect after ${maxRetries} attempts: ${connectError.message}`);
        isPolling = false;
        return;
      }
    }
  }

  try {

    // Get device info first (non-fatal: zkteco-js getInfo can throw ERR_OUT_OF_RANGE on some devices)
    let info = null;
    try {
      info = await device.getInfo();
      logger.debug(`Device info: ${JSON.stringify(info)}`);
    } catch (infoErr) {
      logger.debug(`Device info skipped (non-fatal): ${infoErr.message || infoErr}`);
    }

    // Try different methods to get attendance
    logger.debug('Getting attendance logs from device...');
    let response = await device.getAttendances();

    // Extract the actual logs array
    let logs = [];
    if (Array.isArray(response)) {
      logs = response;
    } else if (response && Array.isArray(response.data)) {
      // Response is object with data property
      logs = response.data;
      logger.debug('Extracted logs from response.data');
    } else if (response) {
      logger.warn(`Unexpected response format: ${JSON.stringify(response).substring(0, 200)}`);
    }

    logger.debug(`Total logs on device: ${logs.length}`);

    // On first poll after server restart, initialize from DB
    try {
      // Reuse device info from above (avoid second getInfo() which can throw ERR_OUT_OF_RANGE)
      if (info) logger.debug(`Device info: ${JSON.stringify(info)}`);

      // Try different methods to get attendance
      logger.debug('Getting attendance logs from device...');
      let response;
      try {
        response = await device.getAttendances();
      } catch (streamErr) {
        logger.error(`Device stream error: ${streamErr.message}`);
        // If stream is closed, disconnect and abort polling
        try { await device.disconnect(); } catch (_) { }
        isPolling = false;
        return;
      }
      let lastProcessedSN = 0;
      let pollingInterval = null;
      let isInitialized = false;

      async function loadLastProcessedSN() {
        try {
          const savedSN = await Settings.getValue('lastProcessedAttendanceSN', 0);
          lastProcessedSN = Number(savedSN) || 0;
          logger.info(`Loaded last processed attendance SN from database: ${lastProcessedSN}`);
          return lastProcessedSN;
        } catch (error) {
          logger.error(`Failed to load last processed SN: ${error.message}`);
          return 0;
        }
      }

      async function saveLastProcessedSN(sn) {
        try {
          await Settings.setValue('lastProcessedAttendanceSN', sn);
          logger.debug(`Saved last processed attendance SN to database: ${sn}`);
        } catch (error) {
          logger.error(`Failed to save last processed SN: ${error.message}`);
        }
      }

      function createDeviceInstance() {
        return new Zkteco(DEVICE_IP, DEVICE_PORT, DEVICE.DEFAULT_INPORT, DEVICE.DEFAULT_TIMEOUT);
      }

      function mapZkLogToDoc(log) {
        const userId = String(log.user_id ?? log.userId ?? log.uid ?? '');
        if (!userId) return null;
        let dt;
        if (log.record_time) {
          dt = new Date(log.record_time);
        } else if (log.timestamp) {
          dt = new Date(log.timestamp);
        } else {
          return null;
        }
        if (isNaN(dt.getTime())) return null;
        const parsed = parseDeviceTimestamp(dt);
        if (!parsed) return null;
        return {
          datetime: parsed.datetime,
          date: parsed.dateStr,
          time: parsed.timeStr,
          userId,
          status: Number(log.type ?? log.status ?? 0),
          punch: Number(log.state ?? log.punch ?? 0),
          workcode: String(log.workCode ?? log.workcode ?? ''),
          deviceIp: log.ip ?? DEVICE_IP,
        };
      }

      async function processAttendanceLog(doc) {
        try {
          const employee = await Employee.findOne({
            biometricId: doc.userId.toString().trim(),
            isActive: true
          }).populate('department', 'name leverageTime')
            .populate('role', 'name');
          if (!employee) {
            logger.debug(`Employee with biometric ID ${doc.userId} not found in system`);
            return;
          }
          if (employee.role?.name === 'superAdmin') {
            logger.debug(`Skipping attendance for superAdmin: ${employee.name}`);
            return;
          }
          const punchTime = doc.datetime;
          const dateOnly = getDateAtMidnightUTC(punchTime);
          let attendance = await Attendance.findOne({
            userId: employee.employeeId,
            date: {
              $gte: dateOnly,
              $lt: new Date(dateOnly.getTime() + TIME.ONE_DAY),
            },
          });
          let punchType = '';
          const RAPID_PUNCH_THRESHOLD_MS = DEVICE.RAPID_PUNCH_THRESHOLD || (3 * TIME.ONE_HOUR);
          if (!attendance) {
            const primaryShift = employee.shifts?.find(s => s.isPrimary) || employee.shifts?.[0];
            const deptId = primaryShift?.department || employee.department;
            attendance = await Attendance.create({
              employee: employee._id,
              userId: employee.employeeId,
              date: dateOnly,
              department: deptId,
              checkIn: punchTime,
              checkOut: null,
              deviceId: doc.deviceIp,
              isManualEntry: false,
            });
            punchType = 'CHECK-IN';
            logger.debug(`${employee.name} (${employee.employeeId}) - ${punchType}`);
          } else if (!attendance.checkIn) {
            attendance.checkIn = punchTime;
            attendance.deviceId = doc.deviceIp;
            await attendance.save();
            punchType = 'CHECK-IN';
            logger.debug(`${employee.name} (${employee.employeeId}) - ${punchType}`);
          } else if (!attendance.checkOut) {
            const timeSinceCheckIn = punchTime.getTime() - attendance.checkIn.getTime();
            if (timeSinceCheckIn < RAPID_PUNCH_THRESHOLD_MS) {
              logger.debug(`${employee.name} (${employee.employeeId}) - IGNORED (rapid punch: ${Math.round(timeSinceCheckIn / 60000)} min after check-in)`);
              return;
            }
            attendance.checkOut = punchTime;
            await attendance.save();
            punchType = 'CHECK-OUT';
            logger.debug(`${employee.name} (${employee.employeeId}) - ${punchType}`);
            const hasShifts = await hasMultipleShifts(employee._id);
            if (hasShifts) {
              logger.info(`Multi-shift employee detected: ${employee.employeeId}, splitting attendance`);
              const attendanceData = {
                employee: employee._id,
                userId: employee.employeeId,
                date: dateOnly,
                checkIn: attendance.checkIn,
                checkOut: attendance.checkOut,
                deviceId: doc.deviceIp,
                isManualEntry: false,
              };
              await Attendance.deleteOne({ _id: attendance._id });
              const splitRecords = await splitAttendanceByDepartments(attendanceData);
              logger.info(`Attendance split into ${splitRecords.length} department records for ${employee.employeeId}`);
            }
          } else {
            logger.debug(`${employee.name} (${employee.employeeId}) - Skipped (already complete)`);
          }
        } catch (error) {
          logger.error(`Error processing attendance for user ${doc.userId}: ${error.message}`, { stack: error.stack });
        }
      }

      async function pollDeviceOnce() {
        if (isPolling) {
          logger.debug('Poll already in progress, skipping this interval.');
          return;
        }
        isPolling = true;
        const device = createDeviceInstance();
        let retryCount = 0;
        const maxRetries = DEVICE.MAX_RETRY_ATTEMPTS || 3;
        while (retryCount < maxRetries) {
          try {
            logger.debug(`Connecting to device: ${DEVICE_IP}:${DEVICE_PORT} (attempt ${retryCount + 1}/${maxRetries})`);
            await device.createSocket();
            break;
          } catch (connectError) {
            retryCount++;
            if (retryCount < maxRetries) {
              logger.warn(`Connection failed (attempt ${retryCount}/${maxRetries}): ${connectError.message}. Retrying in ${DEVICE.RETRY_DELAY || 2000}ms...`);
              await new Promise(resolve => setTimeout(resolve, DEVICE.RETRY_DELAY || 2000));
            } else {
              logger.error(`Failed to connect after ${maxRetries} attempts: ${connectError.message}`);
              isPolling = false;
              return;
            }
          }
        }
        try {
          try {
            const info = await device.getInfo();
            logger.debug(`Device info: ${JSON.stringify(info)}`);
          } catch (infoErr) {
            logger.debug(`Device info skipped (non-fatal): ${infoErr.message || infoErr}`);
          }
          logger.debug('Getting attendance logs from device...');
          let response;
          try {
            response = await device.getAttendances();
          } catch (streamErr) {
            logger.error(`Device stream error: ${streamErr.message}`);
            try { await device.disconnect(); } catch (_) { }
            isPolling = false;
            return;
          }
          let logs = [];
          if (Array.isArray(response)) {
            logs = response;
          } else if (response && Array.isArray(response.data)) {
            logs = response.data;
            logger.debug('Extracted logs from response.data');
          } else if (response) {
            logger.warn(`Unexpected response format: ${JSON.stringify(response).substring(0, 200)}`);
          }
          logger.debug(`Total logs on device: ${logs.length}`);
          if (!isInitialized) {
            await loadLastProcessedSN();
            isInitialized = true;
            logger.info(lastProcessedSN > 0 ? `Resuming from last processed SN: ${lastProcessedSN}` : 'No saved SN. Will process from first log (sn>0) in chunks.');
          }
          // Process only logs with sn > lastProcessedAttendanceSN (no date filter)
          const pending = logs.filter(log => (Number(log.sn ?? log.SN ?? 0) > lastProcessedSN));
          const sortedPending = [...pending].sort((a, b) => {
            const tA = new Date(a.record_time || a.timestamp || 0).getTime();
            const tB = new Date(b.record_time || b.timestamp || 0).getTime();
            if (tA !== tB) return tA - tB;
            return (Number(a.sn ?? a.SN ?? 0) - Number(b.sn ?? b.SN ?? 0));
          });
          const logsPerPoll = Number(process.env.LOGS_PER_POLL || DEVICE.LOGS_PER_POLL || 2000);
          const allLogsToProcess = sortedPending.slice(0, logsPerPoll);
          logger.debug(`Logs on device: ${logs.length}, pending (sn>${lastProcessedSN}): ${pending.length}, processing this poll: ${allLogsToProcess.length} (max ${logsPerPoll})`);
          if (allLogsToProcess.length > 0 && !firstLogShapePrinted) {
            logger.debug(`Example log object: ${JSON.stringify(allLogsToProcess[0], null, 2)}`);
            firstLogShapePrinted = true;
          }
          let inserted = 0;
          let skipped = 0;
          let maxSN = lastProcessedSN;
          for (const rawLog of allLogsToProcess) {
            const sn = Number(rawLog.sn ?? rawLog.SN ?? 0);
            if (sn > maxSN) maxSN = sn;
            const doc = mapZkLogToDoc(rawLog);
            if (!doc) {
              skipped++;
              continue;
            }
            try {
              await AttendanceLog.updateOne(
                {
                  userId: doc.userId,
                  datetime: doc.datetime,
                  deviceIp: doc.deviceIp,
                },
                { $setOnInsert: doc },
                { upsert: true }
              );
              inserted++;
              await processAttendanceLog(doc);
            } catch (err) {
              skipped++;
            }
          }
          if (allLogsToProcess.length > 0) {
            lastProcessedSN = maxSN;
            logger.debug(`Processed logs. Inserted: ${inserted}, Skipped (existing/invalid): ${skipped}, Last SN: ${lastProcessedSN}`);
            await saveLastProcessedSN(lastProcessedSN);
          }
          try {
            await device.disconnect();
          } catch (disconnectErr) {
            logger.debug(`Disconnect error (non-critical): ${disconnectErr.message}`);
          }
        } catch (err) {
          logger.error(`Error processing device data: ${err.message || err}`, { stack: err.stack });
          try { await device.disconnect(); } catch (_) { }
        }
        isPolling = false;
      }
      // Actually run the processing (inner pollDeviceOnce was only defined above; call it now)
      isPolling = false; // allow inner pollDeviceOnce to run (it checks isPolling)
      await pollDeviceOnce();
      try { await device.disconnect(); } catch (_) { }
    } catch (innerErr) {
      logger.error(`Error processing device data: ${innerErr.message || innerErr}`, { stack: innerErr.stack });
      try { await device.disconnect(); } catch (_) { }
      isPolling = false;
    }
  } catch (err) {
    logger.error(`Error processing device data: ${err.message || err}`, { stack: err.stack });
    try { await device.disconnect(); } catch (_) { }
  }
  isPolling = false;
}

/**
 * Sync device time with server time (with retry logic)
 */
export const syncDeviceTime = async () => {
  const device = createDeviceInstance();
  let retryCount = 0;
  const maxRetries = DEVICE.MAX_RETRY_ATTEMPTS || 3;

  while (retryCount < maxRetries) {
    try {
      logger.info(`Syncing device time with server... (attempt ${retryCount + 1}/${maxRetries})`);
      await device.createSocket();

      // Set device time to current server time
      const result = await device.setTime(new Date());

      logger.info('Device time synced successfully');
      await device.disconnect();
      return true;
    } catch (error) {
      retryCount++;
      if (retryCount < maxRetries) {
        logger.warn(`Time sync failed (attempt ${retryCount}/${maxRetries}): ${error.message}. Retrying in ${DEVICE.RETRY_DELAY || 2000}ms...`);
        try { await device.disconnect(); } catch (_) { }
        await new Promise(resolve => setTimeout(resolve, DEVICE.RETRY_DELAY || 2000));
      } else {
        logger.error(`Failed to sync device time after ${maxRetries} attempts: ${error.message}`);
        try { await device.disconnect(); } catch (_) { }
        return false;
      }
    }
  }
}

/**
 * Connect to device and start polling
 */
export const connectToDevice = async () => {
  try {
    logger.info(`Initializing ZKTeco device connection - Device IP: ${DEVICE_IP}:${DEVICE_PORT}, Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
    // Try to sync device time with server on connection (optional - don't fail if it doesn't work)
    const timeSynced = await syncDeviceTime();
    if (!timeSynced) {
      logger.warn('Device time sync failed, but will continue with attendance polling');
    }
    return true;
  } catch (error) {
    logger.error(`Failed to initialize device: ${error.message}`, { stack: error.stack });
    return false;
  }
}

/**
 * Start polling for attendance data
 */
export const startPolling = async () => {
  try {
    logger.info(`Starting attendance polling - Polling interval: ${POLL_INTERVAL_MS / 1000}s`);

    // Do an initial poll immediately to initialize lastProcessedSN
    await pollDeviceOnce();

    // Then schedule recurring polls
    pollingInterval = setInterval(pollDeviceOnce, POLL_INTERVAL_MS);

    logger.info('ZKTeco biometric integration active - monitoring for new punches');
  } catch (error) {
    logger.error(`Failed to start polling: ${error.message}`, { stack: error.stack });
  }
};

/**
 * Disconnect from device and stop polling
 */
export const disconnectFromDevice = async () => {
  try {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    logger.info('Device polling stopped');
  } catch (error) {
    logger.error(`Disconnect error: ${error.message}`, { stack: error.stack });
  }
};