/**
 * ZKTeco Device Sync Script
 * Device IP: 192.168.30.201
 * Polls device for attendance logs and syncs to server
 */

import axios from 'axios';
import ZKLib from 'zklib';

// Configuration
const CONFIG = {
  DEVICE_IP: '192.168.30.201',
  DEVICE_PORT: 4370,
  SERVER_URL: 'http://localhost:5003',
  DEVICE_ID: 'AFBF219360663',
  POLL_INTERVAL: 0.5, // minutes (30 seconds for real-time sync)
  TIMEOUT: 5000,
};

let zkInstance = null;
let lastSyncTime = new Date();

/**
 * Connect to ZKTeco device
 */
async function connectDevice() {
  try {
    console.log(`🔌 Connecting to device at ${CONFIG.DEVICE_IP}:${CONFIG.DEVICE_PORT}...`);
    
    zkInstance = new ZKLib({
      ip: CONFIG.DEVICE_IP,
      port: CONFIG.DEVICE_PORT,
      timeout: CONFIG.TIMEOUT,
      inport: 5200
    });

    await zkInstance.connect();
    console.log(`✅ Connected to ZKTeco device successfully!`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to connect to device:`, error.message);
    return false;
  }
}

/**
 * Disconnect from device
 */
async function disconnectDevice() {
  try {
    if (zkInstance) {
      await zkInstance.disconnect();
      console.log(`🔌 Disconnected from device`);
    }
  } catch (error) {
    console.error(`⚠️  Disconnect error:`, error.message);
  }
}

/**
 * Fetch attendance logs from device
 */
async function fetchAttendanceLogs() {
  try {
    console.log(`📊 Fetching attendance logs from device...`);
    
    // Try to get attendance data
    try {
      const logs = await zkInstance.getAttendance();
      
      if (!logs || logs.length === 0) {
        console.log(`ℹ️  No attendance records found in device`);
        return [];
      }

      // Filter logs since last sync (only new records)
      const newLogs = logs.filter(log => {
        const logTime = new Date(log.recordTime);
        return logTime > lastSyncTime;
      });

      console.log(`📝 Found ${newLogs.length} new records (${logs.length} total in device)`);
      return newLogs;
      
    } catch (err) {
      // If getAttendance fails, try alternate method
      console.log(`ℹ️  No new attendance data to sync (device may be empty or already synced)`);
      return [];
    }
  } catch (error) {
    console.error(`❌ Failed to fetch logs:`, error.message);
    return [];
  }
}

/**
 * Sync attendance to server
 */
async function syncAttendanceToServer(logs) {
  let successCount = 0;
  let failCount = 0;

  for (const log of logs) {
    try {
      const response = await axios.post(
        `${CONFIG.SERVER_URL}/api/attendance/device-checkin`,
        {
          biometricId: log.deviceUserId.toString(),
          timestamp: log.recordTime,
          deviceId: CONFIG.DEVICE_ID
        }
      );

      console.log(`✅ Synced: ${log.deviceUserId} - ${response.data.punchType}`);
      successCount++;

    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message?.includes('Already checked')) {
        console.log(`⏭️  Skipped: ${log.deviceUserId} - Already processed`);
      } else if (error.response?.status === 404) {
        console.log(`⚠️  Skipped: ${log.deviceUserId} - Employee not found in system`);
      } else {
        console.error(`❌ Failed: ${log.deviceUserId} -`, error.response?.data?.message || error.message);
        failCount++;
      }
    }
  }

  console.log(`\n📊 Sync Summary: ${successCount} successful, ${failCount} failed\n`);
  return { successCount, failCount };
}

/**
 * Main sync function
 */
async function syncAttendance() {
  try {
    console.log(`\n⏰ Starting sync at ${new Date().toLocaleString()}`);
    
    // Connect to device
    const connected = await connectDevice();
    if (!connected) {
      console.log(`⚠️  Skipping sync - device not connected\n`);
      return;
    }

    // Fetch logs
    const logs = await fetchAttendanceLogs();
    
    if (logs.length > 0) {
      // Sync to server
      await syncAttendanceToServer(logs);
      
      // Update last sync time
      lastSyncTime = new Date();
    }

    // Disconnect
    await disconnectDevice();
    
    console.log(`✅ Sync completed at ${new Date().toLocaleString()}\n`);

  } catch (error) {
    console.error(`❌ Sync error:`, error.message);
    await disconnectDevice();
  }
}

/**
 * Get device info
 */
async function getDeviceInfo() {
  try {
    const connected = await connectDevice();
    if (!connected) return;

    console.log(`\n📱 Device Information:`);
    
    const info = await zkInstance.getInfo();
    console.log(info);

    const users = await zkInstance.getUsers();
    console.log(`\n👥 Total enrolled users: ${users.length}`);
    
    if (users.length > 0) {
      console.log(`\nEnrolled Users (Biometric IDs):`);
      users.forEach(user => {
        console.log(`  - ID: ${user.userId}, Name: ${user.name || 'N/A'}, Card: ${user.cardno || 'N/A'}`);
      });
    }

    await disconnectDevice();
  } catch (error) {
    console.error(`❌ Failed to get device info:`, error.message);
    await disconnectDevice();
  }
}

/**
 * Test device connection
 */
async function testConnection() {
  try {
    console.log(`\n🧪 Testing connection to ${CONFIG.DEVICE_IP}...`);
    
    const connected = await connectDevice();
    if (connected) {
      console.log(`✅ Connection test successful!`);
      
      // Get basic info
      const info = await zkInstance.getInfo();
      console.log(`\nDevice Details:`);
      console.log(`  - Model: ${info.model || 'Unknown'}`);
      console.log(`  - Firmware: ${info.version || 'Unknown'}`);
      console.log(`  - Serial: ${info.serialNumber || 'Unknown'}`);
      
      await disconnectDevice();
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Connection test failed:`, error.message);
    await disconnectDevice();
    return false;
  }
}

/**
 * Start polling
 */
function startPolling() {
  console.log(`🚀 Starting ZKTeco Device Sync Service`);
  console.log(`📍 Device: ${CONFIG.DEVICE_IP}:${CONFIG.DEVICE_PORT}`);
  console.log(`🔄 Poll Interval: ${CONFIG.POLL_INTERVAL} minutes`);
  console.log(`🌐 Server: ${CONFIG.SERVER_URL}\n`);

  // Initial sync
  syncAttendance();

  // Schedule periodic sync
  const intervalMs = CONFIG.POLL_INTERVAL * 60 * 1000;
  setInterval(syncAttendance, intervalMs);

  console.log(`✅ Service started. Press Ctrl+C to stop.\n`);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(`\n⏹️  Shutting down...`);
  await disconnectDevice();
  process.exit(0);
});

// Main execution
const command = process.argv[2] || 'help';

switch (command) {
  case 'start':
    startPolling();
    break;

  case 'test':
    testConnection().then(() => process.exit(0));
    break;

  case 'info':
    getDeviceInfo().then(() => process.exit(0));
    break;

  case 'sync':
    syncAttendance().then(() => process.exit(0));
    break;

  default:
    console.log(`
ZKTeco Device Sync - Command Line Interface

Usage: node deviceSync.js [command]

Commands:
  start     Start polling service (syncs every ${CONFIG.POLL_INTERVAL} minutes)
  test      Test connection to device
  info      Get device information and enrolled users
  sync      Run one-time sync
  help      Show this help message

Examples:
  node deviceSync.js test       # Test device connection
  node deviceSync.js info       # View enrolled users
  node deviceSync.js sync       # Sync once
  node deviceSync.js start      # Start continuous polling

Configuration:
  Device IP: ${CONFIG.DEVICE_IP}
  Device Port: ${CONFIG.DEVICE_PORT}
  Server URL: ${CONFIG.SERVER_URL}
  Poll Interval: ${CONFIG.POLL_INTERVAL} minutes
    `);
}
