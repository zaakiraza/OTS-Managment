import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    userId: {
      type: String,
      required: [true, "User/Employee ID is required"],
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
      enum: ["present", "absent", "half-day", "late", "early-arrival", "late-early-arrival", "pending"],
      default: "pending",
    },
    workingHours: {
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
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate working hours before saving
attendanceSchema.pre("save", async function () {
  if (this.checkIn && this.checkOut) {
    const diffMs = this.checkOut - this.checkIn;
    this.workingHours = diffMs / (1000 * 60 * 60); // Convert to hours
    
    // Find the employee to get their scheduled times and daily working hours
    let employee = null;
    if (this.employee) {
      employee = await mongoose.model("Employee").findById(this.employee).populate('department');
    }
    
    if (employee) {
      // Get department leverage time settings
      const checkInLeverage = employee.department?.leverageTime?.checkInMinutes || 15;
      const checkOutLeverage = employee.department?.leverageTime?.checkOutMinutes || 10;
      
      // Calculate daily working hours (weekly hours / working days per week)
      const dailyHours = employee.workSchedule.workingHoursPerWeek / employee.workSchedule.workingDaysPerWeek;
      const halfDayThreshold = dailyHours / 2;
      
      // Get scheduled check-in and check-out times
      const [scheduleInHour, scheduleInMinute] = employee.workSchedule.checkInTime.split(":").map(Number);
      const [scheduleOutHour, scheduleOutMinute] = employee.workSchedule.checkOutTime.split(":").map(Number);
      
      const scheduledCheckIn = new Date(this.checkIn);
      scheduledCheckIn.setHours(scheduleInHour, scheduleInMinute, 0, 0);
      
      const scheduledCheckOut = new Date(this.checkOut);
      scheduledCheckOut.setHours(scheduleOutHour, scheduleOutMinute, 0, 0);
      
      // Calculate time differences in minutes
      const checkInDiffMinutes = (this.checkIn - scheduledCheckIn) / (1000 * 60);
      const checkOutDiffMinutes = (scheduledCheckOut - this.checkOut) / (1000 * 60);
      
      // Check if employee arrived late or left early based on leverage time
      const arrivedLate = checkInDiffMinutes > checkInLeverage;
      const leftEarly = checkOutDiffMinutes > checkOutLeverage;
      
      // Calculate acceptable minimum hours considering leverage time
      // If employee uses leverage time on both ends, they might work slightly less than daily hours
      const leverageTotalMinutes = checkInLeverage + checkOutLeverage;
      const leverageHours = leverageTotalMinutes / 60;
      const minimumAcceptableHours = dailyHours - leverageHours;
      
      // Determine status based on working hours and arrival/departure times
      if (this.workingHours >= minimumAcceptableHours) {
        // Completed acceptable working hours (considering leverage time)
        if (arrivedLate && leftEarly) {
          this.status = "late-early-arrival";
        } else if (leftEarly) {
          this.status = "early-arrival";
        } else if (arrivedLate) {
          this.status = "late";
        } else {
          this.status = "present";
        }
      } else if (this.workingHours >= halfDayThreshold) {
        // Completed half day hours
        this.status = "half-day";
      } else if (this.workingHours > 0) {
        // Less than half day
        this.status = "late";
      }
    } else {
      // Fallback logic if employee not found (for Users)
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

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
