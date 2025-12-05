import express from 'express';
import Attendance from '../Model/Attendance.js';
import Employee from '../Model/Employee.js';

const router = express.Router();

/**
 * iClock Protocol Handler for ZKTeco Devices
 * Handles device registration and attendance data push
 */

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
  // Just acknowledge - let device push data automatically
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
    // Data format from iClock protocol might be in req.body or parsed differently
    console.log('Processing attendance data:', data);
    
    // TODO: Parse and save to database
    // The data format will be visible in console logs
    
  } catch (error) {
    console.error('Error processing:', error);
  }
}

export default router;
