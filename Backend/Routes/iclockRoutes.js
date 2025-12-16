import express from 'express';
import Attendance from '../Model/Attendance.js';
import Employee from '../Model/Employee.js';
import Role from '../Model/Role.js';
import logger from '../Utils/logger.js';
import { DEVICE, TIME, SALARY } from '../Config/constants.js';

const router = express.Router();

/**
 * iClock Protocol Handler for ZKTeco Devices
 * Handles device registration and attendance data push
 */

// Track devices that have already fetched logs
const deviceLogsFetched = new Set();

// Device registration/polling endpoint
router.get('/cdata', async (req, res) => {
  const { SN, options, Stamp } = req.query;
  logger.debug(`Device cdata: SN=${SN}, options=${options}`);
  
  // Check if attendance data is in query params (some devices send via GET)
  if (Stamp) {
    logger.debug(`Attendance via GET - Stamp: ${Stamp}, Full query: ${JSON.stringify(req.query)}`);
  }
  
  res.send('OK');
});

// Device getrequest endpoint
router.get('/getrequest', async (req, res) => {
  const { SN, INFO } = req.query;
  logger.debug(`Device getrequest: SN=${SN}${INFO ? `, INFO: ${INFO}` : ''}`);
  
  // Check if we've already fetched logs from this device
  if (!deviceLogsFetched.has(SN)) {
    logger.info(`Requesting all attendance logs from device ${SN}`);
    deviceLogsFetched.add(SN);
    // Request all attendance logs from device
    return res.send('C:1:ATTLOG');
  }
  
  // Already fetched, just acknowledge
  res.send('OK');
});

// Device sending attendance data (POST)
router.post('/cdata', async (req, res) => {
  try {
    logger.debug(`Attendance data received - Body type: ${typeof req.body}`);
    logger.debug(`Raw data: ${req.body ? req.body.toString().substring(0, 200) : 'empty'}`);
    
    // Respond OK to device
    res.send('OK');
    
    // Process attendance in background
    if (req.body) {
      processAttendanceData(req.body.toString());
    }
    
  } catch (error) {
    logger.error(`Error processing attendance: ${error.message}`, { stack: error.stack });
    res.send('OK'); // Still respond OK to device
  }
});

// Handle device commands
router.post('/devicecmd', async (req, res) => {
  logger.debug(`Device command received - Body type: ${typeof req.body}, Raw: ${req.body ? req.body.toString().substring(0, 200) : 'empty'}`);
  res.send('OK');
});

// Process attendance data
async function processAttendanceData(data) {
  try {
    logger.info('Processing iClock attendance data...');
    
    // Parse the attendance data
    // iClock format: PIN\tDateTime\tStatus\tVerify\tDeviceID
    // Example: 1\t2024-12-10 09:30:00\t0\t1\tDEV001
    const lines = data.split('\n').filter(line => line.trim());
    
    let processed = 0;
    let saved = 0;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      
      const [biometricId, dateTime, status, verify, deviceId] = parts;
      processed++;
      
      try {
        // Find employee by biometricId with role populated
        const employee = await Employee.findOne({ biometricId: biometricId.trim() })
          .populate('role', 'name');
        
        if (!employee) {
          logger.debug(`Employee not found for biometricId: ${biometricId}`);
          continue;
        }
        
        // Skip attendance for superAdmin
        if (employee.role?.name === 'superAdmin') {
          logger.debug(`Skipping attendance for superAdmin: ${employee.name}`);
          continue;
        }
        
        // Parse date and time
        const checkTime = new Date(dateTime);
        if (isNaN(checkTime.getTime())) {
          logger.warn(`Invalid date format: ${dateTime}`);
          continue;
        }
        
        const dateOnly = new Date(checkTime);
        dateOnly.setHours(0, 0, 0, 0);
        
        // Find or create attendance record for this date
        let attendance = await Attendance.findOne({
          employee: employee._id,
          date: dateOnly
        });
        
        if (!attendance) {
          // Create new attendance record
          attendance = new Attendance({
            employee: employee._id,
            userId: employee.employeeId,
            date: dateOnly,
            checkIn: checkTime,
            deviceId: deviceId || 'unknown',
            status: 'present',
            isManualEntry: false
          });
          await attendance.save();
          saved++;
          logger.info(`New attendance created for ${employee.name} at ${checkTime}`);
        } else {
          // Update existing record
          let updated = false;
          
          // Set checkIn if not set or this time is earlier
          if (!attendance.checkIn || checkTime < attendance.checkIn) {
            attendance.checkIn = checkTime;
            updated = true;
          }
          
          // Set checkOut if this time is later than checkIn
          if (attendance.checkIn && checkTime > attendance.checkIn) {
            if (!attendance.checkOut || checkTime > attendance.checkOut) {
              attendance.checkOut = checkTime;
              updated = true;
            }
          }
          
          // Calculate working hours if both checkIn and checkOut exist
          if (attendance.checkIn && attendance.checkOut) {
            const hours = (attendance.checkOut - attendance.checkIn) / TIME.ONE_HOUR;
            attendance.workingHours = Math.round(hours * SALARY.HOURS_DECIMAL_PRECISION) / SALARY.HOURS_DECIMAL_PRECISION;
          }
          
          if (updated) {
            await attendance.save();
            saved++;
            logger.info(`Updated attendance for ${employee.name} at ${checkTime}`);
          }
        }
      } catch (err) {
        logger.error(`Error processing line: ${line} - ${err.message}`);
      }
    }
    
    logger.info(`Processed ${processed} iClock records, saved/updated ${saved} attendance entries`);
    
  } catch (error) {
    logger.error(`Error processing iClock attendance: ${error.message}`, { stack: error.stack });
  }
}

export default router;
