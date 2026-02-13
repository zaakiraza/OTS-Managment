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
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      description: "Department this attendance record belongs to",
    },
    departmentAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DepartmentAssignment",
      default: null,
      description: "Links to the specific DepartmentAssignment (shift) for this record",
    },
    shiftStartTime: {
      type: String,
      required: false,
      description: "Expected shift start time (HH:MM) for this department",
    },
    shiftEndTime: {
      type: String,
      required: false,
      description: "Expected shift end time (HH:MM) for this department",
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
      enum: ["present", "absent", "half-day", "late", "early-departure", "late-early-departure", "pending", "leave", "missing"],
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
    justificationReason: {
      type: String,
      default: "",
    },
    justificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    justifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    justifiedAt: {
      type: Date,
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
      if (this.checkIn && this.checkOut) {
        const checkInDate = this.checkIn instanceof Date ? this.checkIn : new Date(this.checkIn);
        const checkOutDate = this.checkOut instanceof Date ? this.checkOut : new Date(this.checkOut);
        const diffMs = checkOutDate - checkInDate;
        this.workingHours = diffMs / TIME.ONE_HOUR;
        
        try {
          const employee = await mongoose.model("Employee").findById(this.employee);
          if (employee) {
            // Find the shift matching this attendance's department
            const shift = employee.shifts?.find(s => 
              String(s.department) === String(this.department)
            ) || employee.shifts?.[0];
            
            if (shift?.workSchedule) {
              const ws = shift.workSchedule;
              const dailyHours = (ws.workingHoursPerWeek || 40) / (ws.workingDaysPerWeek || 5);
              let expectedDailyHours = dailyHours;

              if (this.shiftStartTime && this.shiftEndTime) {
                const [schedInHr, schedInMin] = this.shiftStartTime.split(":").map(Number);
                const [schedOutHr, schedOutMin] = this.shiftEndTime.split(":").map(Number);
                expectedDailyHours = (schedOutHr * 60 + schedOutMin - (schedInHr * 60 + schedInMin)) / 60;
              }

              this.extraWorkingHours = Math.max(0, this.workingHours - expectedDailyHours);
            } else {
              this.extraWorkingHours = Math.max(0, this.workingHours - 8);
            }
          }
        } catch (err) {
          this.extraWorkingHours = Math.max(0, this.workingHours - 8);
        }
      }
      return;
  }
  
  if (this.checkIn && this.checkOut) {
    const checkInDate = this.checkIn instanceof Date ? this.checkIn : new Date(this.checkIn);
    const checkOutDate = this.checkOut instanceof Date ? this.checkOut : new Date(this.checkOut);
    
    const diffMs = checkOutDate - checkInDate;
    this.workingHours = diffMs / TIME.ONE_HOUR;
    
    // Find the employee and their shift for this department
    let employee = null;
    if (this.employee) {
      employee = await mongoose.model("Employee").findById(this.employee).populate('department');
    }
    
    if (employee) {
      // Find the shift matching this attendance's department
      const shift = employee.shifts?.find(s => 
        String(s.department) === String(this.department)
      ) || employee.shifts?.[0];
      
      const ws = shift?.workSchedule;
      if (!ws) {
        // Fallback if no shift/workSchedule found
        const standardDailyHours = 8;
        this.extraWorkingHours = Math.max(0, this.workingHours - standardDailyHours);
        if (this.workingHours >= 8) this.status = "present";
        else if (this.workingHours >= 4) this.status = "half-day";
        else if (this.workingHours > 0) this.status = "late";
        return;
      }

      // Get department leverage time settings
      let attDept = this.department ? await mongoose.model("Department").findById(this.department) : employee.department;
      let checkInLeverage = attDept?.leverageTime?.checkInMinutes || ATTENDANCE.DEFAULT_CHECK_IN_LEVERAGE;
      let checkOutLeverage = attDept?.leverageTime?.checkOutMinutes || ATTENDANCE.DEFAULT_CHECK_OUT_LEVERAGE;
      
      // Get day of week for this attendance record
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][checkInDate.getUTCDay()];
      
      // Determine check-in/check-out times from shift schedule
      let checkInTime = ws.checkInTime || "09:00";
      let checkOutTime = ws.checkOutTime || "17:00";
      let isDaySpecificSchedule = false;

      // Use shiftStartTime/shiftEndTime if stored on the attendance record
      if (this.shiftStartTime && this.shiftEndTime) {
        checkInTime = this.shiftStartTime;
        checkOutTime = this.shiftEndTime;
        isDaySpecificSchedule = true;
      }
      
      // Check for day-specific schedule override
      if (!isDaySpecificSchedule && ws.daySchedules && ws.daySchedules.get && ws.daySchedules.get(dayOfWeek)) {
        const daySchedule = ws.daySchedules.get(dayOfWeek);
        if (!daySchedule.isOff) {
          checkInTime = daySchedule.checkInTime || checkInTime;
          checkOutTime = daySchedule.checkOutTime || checkOutTime;
          isDaySpecificSchedule = true;
        }
      }
      
      // Calculate daily working hours
      const dailyHours = (ws.workingHoursPerWeek || 40) / (ws.workingDaysPerWeek || 5);
      
      let expectedDailyHours = dailyHours;
      if (isDaySpecificSchedule) {
        const [schedInHr, schedInMin] = checkInTime.split(":").map(Number);
        const [schedOutHr, schedOutMin] = checkOutTime.split(":").map(Number);
        expectedDailyHours = (schedOutHr * 60 + schedOutMin - (schedInHr * 60 + schedInMin)) / 60;
      }
      
      const halfDayThreshold = expectedDailyHours * ATTENDANCE.HALF_DAY_MULTIPLIER;
      
      this.extraWorkingHours = Math.max(0, this.workingHours - expectedDailyHours);
      
      // Get scheduled check-in and check-out times (in PKT)
      const [scheduleInHour, scheduleInMinute] = checkInTime.split(":").map(Number);
      const [scheduleOutHour, scheduleOutMinute] = checkOutTime.split(":").map(Number);
      
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
      
      // Check if working hours indicate half-day (less than half of daily hours)
      // Half-day threshold: working hours < (daily hours * 0.5)
      const isHalfDay = this.workingHours > 0 && this.workingHours < halfDayThreshold;
      
      // Determine status based on arrival/departure times and working hours
      if (isHalfDay) {
        // Working hours less than half of daily hours = half-day
        this.status = "half-day";
      } else if (arrivedLate && leftEarly) {
        // Both late arrival (beyond leverage) and early departure
        this.status = "late-early-departure";
      } else if (arrivedLate) {
        // Arrived late beyond leverage time
        this.status = "late";
      } else if (leftEarly) {
        // Left early beyond leverage time
        this.status = "early-departure";
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
attendanceSchema.index({ employee: 1, date: 1, department: 1 }); // For department-specific shift queries
attendanceSchema.index({ department: 1, date: 1 }); // For department-based attendance reports

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
