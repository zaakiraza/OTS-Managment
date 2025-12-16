import Zkteco from 'zkteco-js';
import AttendanceLog from '../Model/AttendanceLog.js';
import Employee from '../Model/Employee.js';
import Attendance from '../Model/Attendance.js';
import Role from '../Model/Role.js';
import logger from './logger.js';
import { DEVICE, TIME } from '../Config/constants.js';
import { parseDeviceTimestamp, getDateAtMidnightUTC } from './timezone.js';

// Device configuration
const DEVICE_IP = process.env.DEVICE_IP || DEVICE.DEFAULT_IP;
const DEVICE_PORT = Number(process.env.DEVICE_PORT || DEVICE.DEFAULT_PORT);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || DEVICE.DEFAULT_POLL_INTERVAL);

let isPolling = false;
let firstLogShapePrinted = false;
let lastProcessedSN = 0; // Track last serial number processed
let pollingInterval = null;
let isInitialized = false; // Track if we've initialized the lastProcessedSN

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
      attendance = await Attendance.create({
        employee: employee._id,
        userId: employee.employeeId,
        date: dateOnly,
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
    } else {
      // Already checked in and out today - ignore additional punches
      logger.debug(`${employee.name} (${employee.employeeId}) - Skipped (already complete)`);
    }
  } catch (error) {
    logger.error(`Error processing attendance for user ${doc.userId}: ${error.message}`, { stack: error.stack });
  }
}

/**
 * Poll device once for attendance logs
 */
async function pollDeviceOnce() {
  if (isPolling) {
    logger.debug('Poll already in progress, skipping this interval.');
    return;
  }
  isPolling = true;
  
  const device = createDeviceInstance();

  try {
    logger.debug(`Connecting to device: ${DEVICE_IP}:${DEVICE_PORT}`);
    await device.createSocket();

    // Get device info first
    const info = await device.getInfo();
    logger.debug(`Device info: ${JSON.stringify(info)}`);

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

    // On first poll, process ALL existing logs (one-time fetch)
    if (!isInitialized && logs.length > 0) {
      isInitialized = true;
      logger.info(`Processing ${logs.length} existing logs from device (one-time fetch)...`);
      
      let inserted = 0;
      let skipped = 0;
      
      for (const rawLog of logs) {
        const doc = mapZkLogToDoc(rawLog);
        if (!doc) {
          skipped++;
          continue;
        }

        try {
          // Save to AttendanceLog (raw device data)
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
          
          // Update last processed SN
          if (rawLog.sn > lastProcessedSN) {
            lastProcessedSN = rawLog.sn;
          }
          
          // Process into Attendance record (only if employee exists)
          await processAttendanceLog(doc);
        } catch (err) {
          skipped++;
        }
      }
      
      logger.info(`Initial fetch complete. Processed: ${inserted}, Skipped: ${skipped}`);
      logger.info(`Starting from SN: ${lastProcessedSN} - monitoring for new punches`);
      await device.disconnect();
      isPolling = false;
      return;
    }

    // Filter to only NEW logs (sn > lastProcessedSN)
    const newLogs = logs.filter(log => log.sn > lastProcessedSN);
    logger.debug(`New logs since last poll: ${newLogs.length} (last SN was ${lastProcessedSN})`);

    if (newLogs.length > 0 && !firstLogShapePrinted) {
      logger.debug(`Example log object: ${JSON.stringify(newLogs[newLogs.length - 1], null, 2)}`);
      firstLogShapePrinted = true;
    }

    let inserted = 0;
    let skipped = 0;

    for (const rawLog of newLogs) {
      const doc = mapZkLogToDoc(rawLog);
      if (!doc) {
        skipped++;
        continue;
      }

      try {
        // Save to AttendanceLog (raw device data)
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
        
        // Update last processed SN
        if (rawLog.sn > lastProcessedSN) {
          lastProcessedSN = rawLog.sn;
        }
        
        // Log each new attendance in real-time
        logger.info(`NEW PUNCH: User ${doc.userId} at ${doc.date} ${doc.time}`);
        
        // Process into Attendance record
        await processAttendanceLog(doc);
      } catch (err) {
        // likely duplicate key if already exists
        skipped++;
      }
    }

    if (newLogs.length > 0) {
      logger.debug(`Processed logs. Inserted: ${inserted}, Skipped (existing/invalid): ${skipped}, Last SN: ${lastProcessedSN}`);
    }

    await device.disconnect();
  } catch (err) {
    logger.error(`Error talking to device: ${err.message || err}`, { stack: err.stack });
    // try to safely disconnect in case of error
    try {
      await device.disconnect();
    } catch (_) {}
  } finally {
    isPolling = false;
  }
}

/**
 * Sync device time with server time
 */
export const syncDeviceTime = async () => {
  const device = createDeviceInstance();
  try {
    logger.info('Syncing device time with server...');
    await device.createSocket();
    
    // Set device time to current server time
    const result = await device.setTime(new Date());
    
    logger.info('Device time synced successfully');
    await device.disconnect();
    return true;
  } catch (error) {
    logger.error(`Failed to sync device time: ${error.message}`, { stack: error.stack });
    try {
      await device.disconnect();
    } catch (_) {}
    return false;
  }
};

/**
 * Connect to device and start polling
 */
export const connectToDevice = async () => {
  try {
    logger.info(`Initializing ZKTeco device connection - Device IP: ${DEVICE_IP}:${DEVICE_PORT}, Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
    
    // Sync device time with server on connection
    await syncDeviceTime();
    
    return true;
  } catch (error) {
    logger.error(`Failed to initialize device: ${error.message}`, { stack: error.stack });
    return false;
  }
};

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
