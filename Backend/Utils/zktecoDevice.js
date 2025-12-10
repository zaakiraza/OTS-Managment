import Zkteco from 'zkteco-js';
import AttendanceLog from '../Model/AttendanceLog.js';
import Employee from '../Model/Employee.js';
import Attendance from '../Model/Attendance.js';

// Device configuration
const DEVICE_IP = process.env.DEVICE_IP || '192.168.30.201';
const DEVICE_PORT = Number(process.env.DEVICE_PORT || 4370);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30000); // 30 seconds

let isPolling = false;
let firstLogShapePrinted = false;
let lastProcessedSN = 0; // Track last serial number processed
let pollingInterval = null;
let isInitialized = false; // Track if we've initialized the lastProcessedSN

/**
 * Create a fresh device instance to avoid socket reuse issues
 */
function createDeviceInstance() {
  return new Zkteco(DEVICE_IP, DEVICE_PORT, 5200, 5000);
}

/**
 * Map ZKTeco log to AttendanceLog document
 * zkteco-js returns array of log objects with fields:
 *   { sn, user_id, record_time, type, state, ip }
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

  // Use local date/time strings (not UTC) to preserve device timezone
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const seconds = String(dt.getSeconds()).padStart(2, '0');
  
  const dateStr = `${year}-${month}-${day}`;           // YYYY-MM-DD in local time
  const timeStr = `${hours}:${minutes}:${seconds}`;    // HH:MM:SS in local time
  
  // Create a new Date object with UTC time matching local time
  // This ensures MongoDB stores the correct date without timezone conversion
  const localDatetime = new Date(Date.UTC(year, dt.getMonth(), day, hours, minutes, seconds));

  return {
    datetime: localDatetime,
    date: dateStr,
    time: timeStr,
    userId,
    status: Number(log.type ?? log.status ?? 0),           // verification type
    punch: Number(log.state ?? log.punch ?? 0),            // check-in/out
    workcode: String(log.workCode ?? log.workcode ?? ''),
    deviceIp: log.ip ?? DEVICE_IP,
  };
}

/**
 * Process attendance log and create/update attendance record
 */
async function processAttendanceLog(doc) {
  try {
    // Find employee by biometric ID (userId from device)
    const employee = await Employee.findOne({ 
      biometricId: doc.userId.toString().trim(),
      isActive: true 
    }).populate('department', 'name leverageTime');

    if (!employee) {
      // console.log(`⚠️  Employee with biometric ID ${doc.userId} not found in system`);
      return;
    }

    // Get date at midnight in UTC for consistent storage
    const punchTime = doc.datetime;
    const localYear = punchTime.getFullYear();
    const localMonth = punchTime.getMonth();
    const localDay = punchTime.getDate();
    const dateOnly = new Date(Date.UTC(localYear, localMonth, localDay, 0, 0, 0, 0));

    // Find today's attendance record
    let attendance = await Attendance.findOne({
      userId: employee.employeeId,
      date: {
        $gte: dateOnly,
        $lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    let punchType = '';
    const RAPID_PUNCH_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    
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
      // console.log(`   → ${employee.name} (${employee.employeeId}) - ${punchType}`);
    } else if (!attendance.checkIn) {
      // Has record but no check-in (edge case)
      attendance.checkIn = punchTime;
      attendance.deviceId = doc.deviceIp;
      await attendance.save();
      punchType = 'CHECK-IN';
      // console.log(`   → ${employee.name} (${employee.employeeId}) - ${punchType}`);
    } else if (!attendance.checkOut) {
      // Already has check-in, this might be check-out
      // But first check if it's a rapid punch (within 30 minutes of check-in)
      const timeSinceCheckIn = punchTime.getTime() - attendance.checkIn.getTime();
      
      if (timeSinceCheckIn < RAPID_PUNCH_THRESHOLD_MS) {
        // Rapid punch detected - ignore it
        // console.log(`   ⚠️  ${employee.name} (${employee.employeeId}) - IGNORED (rapid punch: ${Math.round(timeSinceCheckIn / 60000)} min after check-in)`);
        return; // Skip this punch
      }
      
      // Valid checkout - sufficient time has passed
      attendance.checkOut = punchTime;
      await attendance.save();
      punchType = 'CHECK-OUT';
      // console.log(`   → ${employee.name} (${employee.employeeId}) - ${punchType}`);
    } else {
      // Already checked in and out today - ignore additional punches
      // console.log(`   → ${employee.name} (${employee.employeeId}) - Skipped (already complete)`);
    }
  } catch (error) {
    console.error(`❌ Error processing attendance for user ${doc.userId}:`, error.message);
  }
}

/**
 * Poll device once for attendance logs
 */
async function pollDeviceOnce() {
  if (isPolling) {
    // console.log('Poll already in progress, skipping this interval.');
    return;
  }
  isPolling = true;
  
  const device = createDeviceInstance();

  try {
    // console.log('\n[Poll] Connecting to device:', DEVICE_IP, 'port', DEVICE_PORT);
    await device.createSocket();

    // Get device info first
    const info = await device.getInfo();
    // console.log('[Poll] Device info:', JSON.stringify(info, null, 2));

    // Try different methods to get attendance
    // console.log('\n[Poll] Trying device.getAttendances()...');
    let response = await device.getAttendances();
    // console.log('[Poll] Type of response:', typeof response);
    // console.log('[Poll] Is array?:', Array.isArray(response));
    
    // Extract the actual logs array
    let logs = [];
    if (Array.isArray(response)) {
      logs = response;
    } else if (response && Array.isArray(response.data)) {
      // Response is object with data property
      logs = response.data;
      // console.log('[Poll] Extracted logs from response.data');
    } else if (response) {
      // console.log('[Poll] Unexpected response format:', JSON.stringify(response).substring(0, 200));
    }
    
    // console.log('[Poll] ✅ Total logs on device:', logs.length);

    // On first poll, process ALL existing logs (one-time fetch)
    if (!isInitialized && logs.length > 0) {
      isInitialized = true;
      // console.log(`[Init] 🔄 Processing ${logs.length} existing logs from device (one-time fetch)...`);
      
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
      
      // console.log(`[Init] ✅ Initial fetch complete. Processed: ${inserted}, Skipped: ${skipped}`);
      // console.log(`[Init] Starting from SN: ${lastProcessedSN} - monitoring for new punches`);
      await device.disconnect();
      isPolling = false;
      return;
    }

    // Filter to only NEW logs (sn > lastProcessedSN)
    const newLogs = logs.filter(log => log.sn > lastProcessedSN);
    // console.log(`[Poll] 🆕 New logs since last poll: ${newLogs.length} (last SN was ${lastProcessedSN})`);

    if (newLogs.length > 0 && !firstLogShapePrinted) {
      // console.log('[Poll] Example log object (for field names):');
      console.dir(newLogs[newLogs.length - 1], { depth: null });
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
        // console.log(`✅ NEW PUNCH: User ${doc.userId} at ${doc.date} ${doc.time}`);
        
        // Process into Attendance record
        await processAttendanceLog(doc);
      } catch (err) {
        // likely duplicate key if already exists
        skipped++;
      }
    }

    if (newLogs.length > 0) {
      // console.log(
      //   `[Poll] Processed logs. Inserted: ${inserted}, Skipped (existing/invalid): ${skipped}`
      // );
      // console.log(`[Poll] Last processed SN: ${lastProcessedSN}`);
    }

    await device.disconnect();
  } catch (err) {
    console.error('[Poll] Error talking to device:', err.message || err);
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
    console.log('🕐 Syncing device time with server...');
    await device.createSocket();
    
    // Set device time to current server time
    const result = await device.setTime(new Date());
    
    console.log('✅ Device time synced successfully');
    await device.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Failed to sync device time:', error.message);
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
    // console.log('📡 Initializing ZKTeco device connection...');
    // console.log(`   Device IP: ${DEVICE_IP}:${DEVICE_PORT}`);
    // console.log(`   Poll Interval: ${POLL_INTERVAL_MS / 1000} seconds`);
    
    // Sync device time with server on connection
    await syncDeviceTime();
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize device:', error.message);
    return false;
  }
};

/**
 * Start polling for attendance data
 */
export const startPolling = async () => {
  try {
    // console.log('✅ Starting attendance polling...');
    // console.log(`   Polling interval: ${POLL_INTERVAL_MS / 1000} seconds`);
    
    // Do an initial poll immediately to initialize lastProcessedSN
    await pollDeviceOnce();

    // Then schedule recurring polls
    pollingInterval = setInterval(pollDeviceOnce, POLL_INTERVAL_MS);
    
    // console.log('✅ ZKTeco biometric integration active - monitoring for new punches\n');
  } catch (error) {
    console.error('❌ Failed to start polling:', error.message);
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
    // console.log('🔌 Device polling stopped');
  } catch (error) {
    console.error('⚠️  Disconnect error:', error.message);
  }
};
