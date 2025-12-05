import Attendance from "../Model/Attendance.js";
import Employee from "../Model/Employee.js";
import fs from "fs";
import path from "path";

// Process attendance data from USB export file
export const processAttendanceFile = async (fileContent) => {
  const lines = fileContent.split('\n').filter(line => line.trim());
  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  for (const line of lines) {
    try {
      // Parse line: BiometricID DateTime Status VerifyType InOutMode WorkCode
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) continue;

      const biometricId = parts[0];
      const date = parts[1];
      const time = parts[2];
      const dateTime = new Date(`${date} ${time}`);
      
      // Find employee by biometric ID
      const employee = await Employee.findOne({ biometricId });
      
      if (!employee) {
        results.details.push({
          biometricId,
          dateTime: `${date} ${time}`,
          status: 'skipped',
          reason: 'Employee not found'
        });
        results.skipped++;
        continue;
      }

      // Get date only (for finding/creating attendance record)
      const dateOnly = dateTime.toISOString().split('T')[0];

      // Find or create attendance record for this date
      let attendance = await Attendance.findOne({
        employee: employee._id,
        date: {
          $gte: new Date(dateOnly + 'T00:00:00.000Z'),
          $lte: new Date(dateOnly + 'T23:59:59.999Z'),
        },
      });

      if (!attendance) {
        // Create new attendance with check-in
        attendance = await Attendance.create({
          employee: employee._id,
          userId: employee.employeeId,
          date: new Date(dateOnly),
          checkIn: dateTime,
          deviceId: 'BIOMETRIC_USB',
          isManualEntry: false,
          status: 'pending',
        });
        
        results.details.push({
          biometricId,
          employeeName: employee.name,
          dateTime: `${date} ${time}`,
          status: 'check-in created',
          attendanceId: attendance._id
        });
        results.processed++;
      } else if (!attendance.checkOut) {
        // Update with check-out time
        attendance.checkOut = dateTime;
        await attendance.save(); // Triggers pre-save hook to calculate hours
        
        results.details.push({
          biometricId,
          employeeName: employee.name,
          dateTime: `${date} ${time}`,
          status: 'check-out updated',
          workingHours: attendance.workingHours,
          attendanceStatus: attendance.status
        });
        results.processed++;
      } else {
        results.details.push({
          biometricId,
          employeeName: employee.name,
          dateTime: `${date} ${time}`,
          status: 'skipped',
          reason: 'Attendance already complete'
        });
        results.skipped++;
      }
    } catch (error) {
      results.errors++;
      results.details.push({
        line,
        status: 'error',
        error: error.message
      });
    }
  }

  return results;
};

// Import attendance from uploaded file
export const importAttendance = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const results = await processAttendanceFile(fileContent);

    // Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: "Attendance data imported successfully",
      results
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Import from text content (for testing)
export const importAttendanceText = async (req, res) => {
  try {
    const { fileContent } = req.body;
    
    if (!fileContent) {
      return res.status(400).json({
        success: false,
        message: "No file content provided"
      });
    }

    const results = await processAttendanceFile(fileContent);

    res.status(200).json({
      success: true,
      message: "Attendance data imported successfully",
      results
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
