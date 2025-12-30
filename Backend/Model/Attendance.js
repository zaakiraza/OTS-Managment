import mongoose from "mongoose";
import { TIME, ATTENDANCE } from "../Config/constants.js";

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee is required"],
    },
    userId: {
      type: String,
      required: [true, "Employee ID is required"],
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["present", "absent", "half-day", "late", "early-arrival", "late-early-arrival", "pending", "leave"],
      default: "pending",
    },
    workingHours: {
      type: Number,
      default: 0,
    },
    extraWorkingHours: {
      type: Number,
      default: 0,
    },
    remarks: {
      type: String,
      default: "",
    },
    deviceId: {
      type: String,
      default: "",
    },
    isManualEntry: {
      type: Boolean,
      default: false,
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      getters: true,
      transform: function(doc, ret) {
        // Always include checkIn and checkOut fields, even if null/undefined
        ret.checkIn = doc.checkIn || null;
        ret.checkOut = doc.checkOut || null;
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      getters: true,
      transform: function(doc, ret) {
        ret.checkIn = doc.checkIn || null;
        ret.checkOut = doc.checkOut || null;
        return ret;
      }
    }
  }
);

// Calculate working hours before saving
attendanceSchema.pre("save", async function () {
  // Check if status was manually modified in this save operation
  const statusWasModified = this.isModified('status');
  
  // If status was manually set to a non-pending value, don't auto-calculate
  if (statusWasModified && this.status && this.status !== 'pending' && this.isManualEntry) {
      // Keep the manually set status, skip auto-calculation entirely
      if (this.checkIn && this.checkOut) {
        // Still calculate working hours even if status is manual
        const checkInDate = this.checkIn instanceof Date ? this.checkIn : new Date(this.checkIn);
        const checkOutDate = this.checkOut instanceof Date ? this.checkOut : new Date(this.checkOut);
        const diffMs = checkOutDate - checkInDate;
        this.workingHours = diffMs / TIME.ONE_HOUR;
        
        // Calculate extra working hours if employee data is available
        try {
          const employee = await mongoose.model("Employee").findById(this.employee).populate('department');
          if (employee && employee.workSchedule) {
            const dailyHours = employee.workSchedule.workingHoursPerWeek / employee.workSchedule.workingDaysPerWeek;
            this.extraWorkingHours = Math.max(0, this.workingHours - dailyHours);
          }
        } catch (err) {
          // If employee not found, use default 8 hours
          this.extraWorkingHours = Math.max(0, this.workingHours - 8);
        }
      }
      return;
  }
  
  if (this.checkIn && this.checkOut) {
    // Ensure checkIn and checkOut are Date objects
    const checkInDate = this.checkIn instanceof Date ? this.checkIn : new Date(this.checkIn);
    const checkOutDate = this.checkOut instanceof Date ? this.checkOut : new Date(this.checkOut);
    
    const diffMs = checkOutDate - checkInDate;
    this.workingHours = diffMs / TIME.ONE_HOUR; // Convert to hours
    
    // Find the employee to get their scheduled times and daily working hours
    let employee = null;
    if (this.employee) {
      employee = await mongoose.model("Employee").findById(this.employee).populate('department');
    }
    
    if (employee) {
      // Get department leverage time settings
      const checkInLeverage = employee.department?.leverageTime?.checkInMinutes || ATTENDANCE.DEFAULT_CHECK_IN_LEVERAGE;
      const checkOutLeverage = employee.department?.leverageTime?.checkOutMinutes || ATTENDANCE.DEFAULT_CHECK_OUT_LEVERAGE;
      
      // Calculate daily working hours (weekly hours / working days per week)
      const dailyHours = employee.workSchedule.workingHoursPerWeek / employee.workSchedule.workingDaysPerWeek;
      const halfDayThreshold = dailyHours * ATTENDANCE.HALF_DAY_MULTIPLIER;
      
      // Calculate extra working hours (actual hours - scheduled hours)
      // Only count positive values (worked more than scheduled)
      this.extraWorkingHours = Math.max(0, this.workingHours - dailyHours);
      
      // Get scheduled check-in and check-out times (in PKT)
      const [scheduleInHour, scheduleInMinute] = employee.workSchedule.checkInTime.split(":").map(Number);
      const [scheduleOutHour, scheduleOutMinute] = employee.workSchedule.checkOutTime.split(":").map(Number);
      
      // Convert scheduled times (PKT) to UTC for comparison
      // Scheduled times are in PKT, so we need to subtract 5 hours to get UTC
      // Use the date from checkIn for consistency
      const checkInYear = checkInDate.getUTCFullYear();
      const checkInMonth = checkInDate.getUTCMonth();
      const checkInDay = checkInDate.getUTCDate();
      
      // Create scheduled times in UTC (PKT - 5 hours = UTC)
      const scheduledCheckInUTC = new Date(Date.UTC(
        checkInYear,
        checkInMonth,
        checkInDay,
        scheduleInHour - 5, // Convert PKT to UTC
        scheduleInMinute,
        0
      ));
      
      const scheduledCheckOutUTC = new Date(Date.UTC(
        checkInYear,
        checkInMonth,
        checkInDay,
        scheduleOutHour - 5, // Convert PKT to UTC
        scheduleOutMinute,
        0
      ));
      
      // Calculate time differences in minutes (both in UTC)
      // Positive = late, Negative = early
      const checkInDiffMinutes = (checkInDate - scheduledCheckInUTC) / TIME.ONE_MINUTE;
      const checkOutDiffMinutes = (checkOutDate - scheduledCheckOutUTC) / TIME.ONE_MINUTE;
      
      // Check if employee arrived late or left early based on leverage time
      // Arrived late: check-in is AFTER scheduled time + leverage (positive difference > leverage)
      const arrivedLate = checkInDiffMinutes > checkInLeverage;
      
      // Left early: check-out is BEFORE scheduled time - leverage (negative difference < -leverage)
      const leftEarly = checkOutDiffMinutes < -checkOutLeverage;
      
      // Determine status based on arrival/departure times
      if (arrivedLate && leftEarly) {
        // Both late arrival (beyond leverage) and early departure
        this.status = "late-early-arrival";
      } else if (arrivedLate) {
        // Arrived late beyond leverage time
        this.status = "late";
      } else if (leftEarly) {
        // Left early beyond leverage time
        this.status = "early-arrival";
      } else {
        // Within acceptable times (arrived on time or early, left on time or late)
        this.status = "present";
      }
    } else {
      // Fallback logic if employee not found (for Users)
      // Assume 8 hours as standard daily hours
      const standardDailyHours = 8;
      this.extraWorkingHours = Math.max(0, this.workingHours - standardDailyHours);
      
      if (this.workingHours >= 8) {
        this.status = "present";
      } else if (this.workingHours >= 4) {
        this.status = "half-day";
      } else if (this.workingHours > 0) {
        this.status = "late";
      }
    }
  }
});

// Indexes for better query performance
attendanceSchema.index({ userId: 1, date: 1 }); // For quick lookup by user and date
attendanceSchema.index({ employee: 1, date: 1 }); // For employee-based queries
attendanceSchema.index({ date: 1, status: 1 }); // For status-based reporting
attendanceSchema.index({ date: 1 }); // For date range queries

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
