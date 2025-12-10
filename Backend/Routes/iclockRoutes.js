import express from 'express';
import Attendance from '../Model/Attendance.js';
import Employee from '../Model/Employee.js';

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
  console.log(`📱 Device cdata: SN=${SN}, options=${options}`);
  
  // Check if attendance data is in query params (some devices send via GET)
  if (Stamp) {
    console.log(`📥 Attendance via GET - Stamp: ${Stamp}`);
    console.log(`   Full query:`, req.query);
  }
  
  res.send('OK');
});

// Device getrequest endpoint
router.get('/getrequest', async (req, res) => {
  const { SN, INFO } = req.query;
  console.log(`📱 Device getrequest: SN=${SN}`);
  if (INFO) {
    console.log(`   Device INFO: ${INFO}`);
  }
  
  // Check if we've already fetched logs from this device
  if (!deviceLogsFetched.has(SN)) {
    console.log(`🔄 Requesting all attendance logs from device ${SN}`);
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
    console.log('📥 ========== ATTENDANCE DATA RECEIVED ==========');
    console.log('   Body type:', typeof req.body);
    console.log('   Body:', req.body);
    console.log('   Raw:', req.body ? req.body.toString() : 'empty');
    console.log('================================================');
    
    // Respond OK to device
    res.send('OK');
    
    // Process attendance in background
    if (req.body) {
      processAttendanceData(req.body.toString());
    }
    
  } catch (error) {
    console.error('❌ Error processing attendance:', error);
    res.send('OK'); // Still respond OK to device
  }
});

// Handle device commands
router.post('/devicecmd', async (req, res) => {
  console.log('📨 Device command received');
  console.log('   Body type:', typeof req.body);
  console.log('   Body:', req.body);
  console.log('   Raw body:', req.body ? req.body.toString() : 'empty');
  res.send('OK');
});

// Process attendance data
async function processAttendanceData(data) {
  try {
    console.log('🔍 Processing attendance data...');
    
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
        // Find employee by biometricId
        const employee = await Employee.findOne({ biometricId: biometricId.trim() });
        
        if (!employee) {
          console.log(`⚠️  Employee not found for biometricId: ${biometricId}`);
          continue;
        }
        
        // Parse date and time
        const checkTime = new Date(dateTime);
        if (isNaN(checkTime.getTime())) {
          console.log(`⚠️  Invalid date format: ${dateTime}`);
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
          console.log(`✅ New attendance created for ${employee.name} at ${checkTime}`);
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
            const hours = (attendance.checkOut - attendance.checkIn) / (1000 * 60 * 60);
            attendance.workingHours = Math.round(hours * 100) / 100;
          }
          
          if (updated) {
            await attendance.save();
            saved++;
            console.log(`✅ Updated attendance for ${employee.name} at ${checkTime}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing line: ${line}`, err.message);
      }
    }
    
    console.log(`📊 Processed ${processed} records, saved/updated ${saved} attendance entries`);
    
  } catch (error) {
    console.error('❌ Error processing attendance:', error);
  }
}

export default router;
