import Attendance from "../Model/Attendance.js";
import Employee from "../Model/Employee.js";

// Receive attendance data from ZKTeco biometric device
export const receiveBiometricData = async (req, res) => {
  try {
    // console.log("=".repeat(60));
    // console.log("🔵 BIOMETRIC DATA RECEIVED");
    // console.log("Timestamp:", new Date().toISOString());
    // console.log("Method:", req.method);
    // console.log("Body:", JSON.stringify(req.body, null, 2));
    // console.log("Headers:", JSON.stringify(req.headers, null, 2));
    // console.log("Query:", JSON.stringify(req.query, null, 2));
    // console.log("Raw Body:", req.body);
    // console.log("=".repeat(60));
    
    // Just respond OK for now - no validation
    return res.status(200).json({
      success: true,
      message: "Data received and logged",
      received: {
        body: req.body,
        query: req.query,
        method: req.method
      }
    });
  } catch (error) {
    console.error("Biometric data error:", error);
    res.status(200).json({
      success: true,
      message: "OK",
    });
  }
};

// Health check endpoint for biometric device
export const biometricHealthCheck = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Biometric server is running",
    timestamp: new Date().toISOString(),
  });
};

// Get biometric device logs (for debugging)
export const getBiometricLogs = async (req, res) => {
  try {
    const { startDate, endDate, deviceId } = req.query;
    
    let filter = { isManualEntry: false };
    
    if (deviceId) {
      filter.deviceId = deviceId;
    }
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z'),
      };
    }
    
    const logs = await Attendance.find(filter)
      .populate('employee', 'name employeeId email department')
      .sort({ date: -1, createdAt: -1 })
      .limit(100);
    
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Alternative endpoint for different ZKTeco protocols
export const receiveBiometricDataAlt = async (req, res) => {
  try {
    // Log raw body for debugging
    // console.log("Alternative biometric endpoint - Raw body:", req.body);
    // console.log("Content-Type:", req.headers['content-type']);
    
    // Some ZKTeco devices send data as query parameters or different format
    const data = req.body || req.query;
    
    // Try to extract common field names
    const employeeId = data.userId || data.userCode || data.pin || data.employeeId;
    const checkTime = data.checkTime || data.time || data.timestamp || data.datetime;
    const deviceId = data.deviceId || data.sn || data.serialNumber;
    
    if (!employeeId || !checkTime) {
      // console.log("Missing data - employeeId:", employeeId, "checkTime:", checkTime);
      return res.status(200).send("OK"); // Some devices expect 200 OK
    }
    
    // Forward to main handler
    req.body = {
      userId: employeeId,
      checkTime: checkTime,
      deviceId: deviceId,
    };
    
    return receiveBiometricData(req, res);
  } catch (error) {
    console.error("Alternative biometric endpoint error:", error);
    res.status(200).send("OK"); // Return OK to prevent device errors
  }
};
