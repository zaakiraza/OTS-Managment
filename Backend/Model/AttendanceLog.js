import mongoose from "mongoose";

/**
 * AttendanceLog Model
 * Stores raw attendance data from ZKTeco biometric devices
 * This is the raw log from the device before processing into Attendance records
 */
const attendanceLogSchema = new mongoose.Schema(
  {
    datetime: {
      type: Date,
      required: true,
      index: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
      index: true,
    },
    time: {
      type: String, // "HH:MM:SS"
      required: true,
    },
    userId: {
      type: String, // Biometric ID from device
      required: true,
      index: true,
    },
    status: {
      type: Number,
      default: 0, // Verification type/status from device
    },
    punch: {
      type: Number,
      default: 0, // Check-in/out state from device
    },
    workcode: {
      type: String,
      default: "",
    },
    deviceIp: {
      type: String,
      default: "",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure uniqueness per user/time/device to avoid duplicate entries
attendanceLogSchema.index(
  { userId: 1, datetime: 1, deviceIp: 1 },
  { unique: true }
);

const AttendanceLog = mongoose.model("AttendanceLog", attendanceLogSchema);

export default AttendanceLog;
