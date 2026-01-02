import Salary from "../Model/Salary.js";
import Employee from "../Model/Employee.js";
import Attendance from "../Model/Attendance.js";
import Role from "../Model/Role.js";
import logger from "../Utils/logger.js";
import { SALARY, ATTENDANCE } from "../Config/constants.js";
import { logSalaryAction } from "../Utils/auditLogger.js";

// Calculate salary for a specific month
export const calculateSalary = async (req, res) => {
  try {
    const { employeeId, month, year, criteria } = req.body;

    // Find employee with role populated
    const employee = await Employee.findOne({ employeeId, isActive: true }).populate('role', 'name');
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Skip salary calculation for superAdmin
    if (employee.role?.name === 'superAdmin') {
      return res.status(400).json({
        success: false,
        message: "Salary calculation is not applicable for superAdmin",
      });
    }

    // Check if employee has salary information
    if (!employee.salary || !employee.salary.monthlySalary || employee.salary.monthlySalary <= 0) {
      return res.status(400).json({
        success: false,
        message: `Employee ${employeeId} has no salary set (${employee.salary?.monthlySalary || 0}). Please update employee salary first.`,
      });
    }

    // Calculate total working days in the month
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const weeklyOffs = employee.workSchedule.weeklyOffs;
    
    let totalWorkingDays = 0;
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      if (!weeklyOffs.includes(dayName)) {
        totalWorkingDays++;
      }
    }

    // Get attendance records for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const attendanceRecords = await Attendance.find({
      $or: [{ employee: employee._id }, { userId: employee.employeeId }],
      date: { $gte: startDate, $lte: endDate },
    });

    logger.info(`Salary calculation for ${employeeId} - Month: ${month}/${year}, Found ${attendanceRecords.length} attendance records`);
    logger.debug(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    if (attendanceRecords.length > 0) {
      logger.debug(`Sample records: ${JSON.stringify(attendanceRecords.slice(0, 3).map(r => ({
        date: r.date,
        status: r.status,
        userId: r.userId
      })))}`);
    }

    // Helper function to normalize date to YYYY-MM-DD format consistently (local time, not UTC)
    const normalizeDateStr = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Calculate attendance statistics
    let presentDays = 0;
    let recordedAbsentDays = 0;
    let halfDays = 0;
    let lateDays = 0;
    let earlyArrivals = 0;
    let leaveDays = 0;

    // Create maps to track the status for each date (to avoid double-counting)
    const dateStatusMap = new Map(); // dateStr -> status
    const datesWithRecords = new Set();

    // Process attendance records - use the latest record for each date if multiple exist
    attendanceRecords.forEach((record) => {
      const dateStr = normalizeDateStr(record.date);
      datesWithRecords.add(dateStr);
      
      // If multiple records exist for the same date, keep the latest one
      if (!dateStatusMap.has(dateStr) || new Date(record.date) > new Date(dateStatusMap.get(dateStr).date)) {
        dateStatusMap.set(dateStr, record);
      }
    });

    // Count attendance statistics from unique dates only
    dateStatusMap.forEach((record) => {
      const status = record.status;
      
      if (status === "present" || status === "early-departure") {
        presentDays++;
        if (status === "early-departure") earlyArrivals++;
      }
      else if (status === "absent") {
        recordedAbsentDays++;
      }
      else if (status === "half-day") {
        halfDays++;
      }
      else if (status === "leave") {
        leaveDays++;
      }
      else if (status === "late") {
        lateDays++;
        presentDays++; // Late is still considered present
      }
      else if (status === "late-early-departure") {
        lateDays++;
        presentDays++; // Late-early-departure is still considered present
        earlyArrivals++; // Also count for early arrival bonus
      }
      else if (status === "pending" && record.checkIn) {
        // Pending with check-in counts as present
        presentDays++;
      }
    });

    // Subtract leave days from total working days
    // Leave days should not be counted in the denominator for salary calculation
    totalWorkingDays = Math.max(0, totalWorkingDays - leaveDays);

    // Calculate missing days (working days without any attendance record, excluding leave days)
    // First, create a set of dates that have leave records
    const leaveDates = new Set();
    dateStatusMap.forEach((record, dateStr) => {
      if (record.status === "leave") {
        leaveDates.add(dateStr);
      }
    });

    let missingDays = 0;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      const dateStr = normalizeDateStr(date);
      
      // Skip weekly offs
      if (weeklyOffs.includes(dayName)) continue;
      
      // Skip future dates
      if (date > today) continue;
      
      // If no record exists for this working day, count as missing (absent)
      // But exclude days that are leaves (leaves are already accounted for)
      if (!datesWithRecords.has(dateStr) && !leaveDates.has(dateStr)) {
        missingDays++;
      }
    }

    // Total absent = explicitly marked absent + missing days
    const absentDays = recordedAbsentDays + missingDays;

    logger.debug(`Attendance stats: Present=${presentDays}, Recorded Absent=${recordedAbsentDays}, Missing Days=${missingDays}, Total Absent=${absentDays}, Late=${lateDays}, HalfDays=${halfDays}, Leaves=${leaveDays}, EarlyArrivals=${earlyArrivals}`);

    let totalDeductions = 0;
    let bonus = 0;
    const baseSalary = employee.salary.monthlySalary;

    // Calculate based on attendance marking method
    if (criteria.attendanceMarkingMethod === 'weeklyHours') {
      // Weekly hours method - deduct per missing hour
      // This would require tracking actual hours worked
      // For now, using a simplified calculation
      const expectedWeeklyHours = 40; // Standard work week
      const expectedMonthlyHours = expectedWeeklyHours * 4; // Approximate
      // You'd need to calculate actual hours from attendance records
      // For now, assume 8 hours per present day
      const actualHours = presentDays * 8 + halfDays * 4;
      const missingHours = Math.max(0, expectedMonthlyHours - actualHours);
      totalDeductions = missingHours * (criteria.hourlyDeductionRate || 0);
    } else {
      // Check-in/checkout method
      // Apply leave threshold logic
      const leaveThreshold = employee.salary.leaveThreshold || 0;
      const excessLeaves = Math.max(0, leaveDays - leaveThreshold);
      
      // Apply late penalty
      const lateAsAbsent = Math.floor(lateDays / (criteria.lateThreshold || SALARY.DEFAULT_LATE_THRESHOLD));
      
      // Apply half-day penalty
      const halfDayAsAbsent = criteria.halfDayThreshold > 0 
        ? Math.floor(halfDays / criteria.halfDayThreshold) 
        : 0;
      
      // Apply early-departure penalty
      const earlyDepartureAsAbsent = criteria.earlyDepartureThreshold > 0 
        ? Math.floor(earlyArrivals / criteria.earlyDepartureThreshold) 
        : 0;
      
      // Apply late-early-departure penalty
      // Count late-early-departure days (from status "late-early-departure")
      let lateEarlyDepartureDays = 0;
      dateStatusMap.forEach((record) => {
        if (record.status === "late-early-departure") {
          lateEarlyDepartureDays++;
        }
      });
      const lateEarlyDepartureAsAbsent = criteria.lateEarlyDepartureThreshold > 0 
        ? Math.floor(lateEarlyDepartureDays / criteria.lateEarlyDepartureThreshold) 
        : 0;
      
      const totalAbsents = absentDays + lateAsAbsent + halfDayAsAbsent + earlyDepartureAsAbsent + lateEarlyDepartureAsAbsent + excessLeaves;
      
      // Calculate deductions
      // Auto-calculate per day salary (rounded down, no decimals)
      const perDaySalary = Math.floor(baseSalary / totalWorkingDays);
      const absentDeduction = totalAbsents * perDaySalary;
      totalDeductions = absentDeduction;
      
      logger.debug(`Leave calculation: Total=${leaveDays}, Threshold=${leaveThreshold}, Excess=${excessLeaves}, Total Absents=${totalAbsents}`);
    }

    // Perfect attendance bonus
    if (criteria.perfectAttendanceBonusEnabled) {
      const attendancePercentage = (presentDays / totalWorkingDays) * SALARY.PERCENTAGE_MULTIPLIER;
      if (attendancePercentage >= (criteria.perfectAttendanceThreshold || SALARY.DEFAULT_PERFECT_ATTENDANCE_THRESHOLD)) {
        bonus = criteria.perfectAttendanceBonusAmount || 0;
      }
    }

    // Calculate total worked days
    const totalWorkedDays = presentDays + halfDays * ATTENDANCE.HALF_DAY_MULTIPLIER;
    // Auto-calculate per day salary (rounded down, no decimals)
    const perDaySalary = Math.floor(baseSalary / totalWorkingDays);

    // Calculate net salary
    const netSalary = baseSalary - totalDeductions + bonus;

    const salaryData = {
      employee: employee._id,
      employeeId: employee.employeeId,
      month,
      year,
      baseSalary: baseSalary,
      calculations: {
        totalWorkingDays,
        presentDays,
        absentDays,
        halfDays,
        lateDays,
        leaveDays,
        totalWorkedDays,
        perDaySalary,
      },
      deductions: {
        absentDeduction: totalDeductions,
        lateDeduction: 0,
        otherDeductions: 0,
        totalDeductions,
      },
      additions: {
        overtime: criteria.includeExtraWorkingHours ? totalExtraWorkingHours * perHourSalary : 0,
        bonus: bonus,
        weeklyOffDaysWorked: criteria.includeWeeklyOffDaysWorked ? weeklyOffDaysWorked * perDaySalary : 0,
        allowances: 0,
        totalAdditions: bonus + extraWorkAdditions,
      },
      extraWork: {
        totalExtraWorkingHours: totalExtraWorkingHours,
        weeklyOffDaysWorked: weeklyOffDaysWorked,
        perHourSalary: perHourSalary,
      },
      netSalary,
      status: "paid",
      calculatedBy: req.user._id,
    };

    // Use findOneAndUpdate with upsert to prevent race conditions
    // This atomically checks if salary exists and creates/updates in one operation
    const salary = await Salary.findOneAndUpdate(
      {
        employee: employee._id,
        month,
        year,
      },
      {
        $set: salaryData,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).populate("employee", "employeeId name email department position");

    res.status(201).json({
      success: true,
      message: "Salary calculated successfully",
      data: salary,
    });
  } catch (error) {
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Salary already calculated for this employee and month",
      });
    }
    logger.error(`Salary calculation error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Calculate salary for all employees
export const calculateAllSalaries = async (req, res) => {
  try {
    const { month, year, departmentId, criteria } = req.body;

    // Get superAdmin role to exclude from salary calculation
    const superAdminRole = await Role.findOne({ name: 'superAdmin' });

    let query = { isActive: true };
    if (departmentId) {
      query.department = departmentId;
    }
    // Exclude superAdmin from salary calculation
    if (superAdminRole) {
      query.role = { $ne: superAdminRole._id };
    }

    const employees = await Employee.find(query);
    const results = [];
    const errors = [];
    
    logger.info(`Calculating salaries for ${employees.length} employees (excluding superAdmin)`);

    for (const employee of employees) {
      try {
        // Check if employee has salary information
        if (!employee.salary || !employee.salary.monthlySalary || employee.salary.monthlySalary <= 0) {
          errors.push({
            employeeId: employee.employeeId,
            message: `No salary set (${employee.salary?.monthlySalary || 0}). Update employee record first.`,
          });
          continue;
        }

        // Calculate total working days in the month
        const totalDaysInMonth = new Date(year, month, 0).getDate();
        const weeklyOffs = employee.workSchedule.weeklyOffs;
        
        let totalWorkingDays = 0;
        for (let day = 1; day <= totalDaysInMonth; day++) {
          const date = new Date(year, month - 1, day);
          const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
          if (!weeklyOffs.includes(dayName)) {
            totalWorkingDays++;
          }
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const attendanceRecords = await Attendance.find({
          $or: [{ employee: employee._id }, { userId: employee.employeeId }],
          date: { $gte: startDate, $lte: endDate },
        });

        logger.debug(`${employee.employeeId}: Found ${attendanceRecords.length} records`);

        // Helper function to normalize date to YYYY-MM-DD format consistently (local time, not UTC)
        const normalizeDateStr = (date) => {
          const d = new Date(date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        let presentDays = 0;
        let recordedAbsentDays = 0; // Days explicitly marked as absent
        let halfDays = 0;
        let lateDays = 0;
        let earlyArrivals = 0;
        let leaveDays = 0;

        // Create maps to track the status for each date (to avoid double-counting)
        const dateStatusMap = new Map(); // dateStr -> status
        const datesWithRecords = new Set();

        // Process attendance records - use the latest record for each date if multiple exist
        attendanceRecords.forEach((record) => {
          const dateStr = normalizeDateStr(record.date);
          datesWithRecords.add(dateStr);
          
          // If multiple records exist for the same date, keep the latest one
          if (!dateStatusMap.has(dateStr) || new Date(record.date) > new Date(dateStatusMap.get(dateStr).date)) {
            dateStatusMap.set(dateStr, record);
          }
        });

        // Count attendance statistics from unique dates only
        dateStatusMap.forEach((record) => {
          const status = record.status;
          
          if (status === "present" || status === "early-departure") {
            presentDays++;
            if (status === "early-departure") earlyArrivals++;
          }
          else if (status === "absent") {
            recordedAbsentDays++;
          }
          else if (status === "half-day") {
            halfDays++;
          }
          else if (status === "leave") {
            leaveDays++;
          }
          else if (status === "late" || status === "late-early-departure") {
            lateDays++;
            presentDays++; // Late is still considered present
            if (status === "late-early-departure") earlyArrivals++;
          }
          else if (status === "pending" && record.checkIn) {
            // Pending with check-in counts as present
            presentDays++;
          }
        });

        // Subtract leave days from total working days
        // Leave days should not be counted in the denominator for salary calculation
        totalWorkingDays = Math.max(0, totalWorkingDays - leaveDays);

        // Calculate missing days (working days without any attendance record, excluding leave days)
        // First, create a set of dates that have leave records
        const leaveDates = new Set();
        dateStatusMap.forEach((record, dateStr) => {
          if (record.status === "leave") {
            leaveDates.add(dateStr);
          }
        });

        let missingDays = 0;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        for (let day = 1; day <= totalDaysInMonth; day++) {
          const date = new Date(year, month - 1, day);
          const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
          const dateStr = normalizeDateStr(date);
          
          // Skip weekly offs
          if (weeklyOffs.includes(dayName)) continue;
          
          // Skip future dates
          if (date > today) continue;
          
          // If no record exists for this working day, count as missing (absent)
          // But exclude days that are leaves (leaves are already accounted for)
          if (!datesWithRecords.has(dateStr) && !leaveDates.has(dateStr)) {
            missingDays++;
          }
        }

        // Total absent = explicitly marked absent + missing days
        const absentDays = recordedAbsentDays + missingDays;

        logger.debug(`${employee.employeeId}: Present=${presentDays}, Recorded Absent=${recordedAbsentDays}, Missing Days=${missingDays}, Total Absent=${absentDays}, Late=${lateDays}`);

        let totalDeductions = 0;
        let bonus = 0;
        const baseSalary = employee.salary.monthlySalary;

        // Calculate based on attendance marking method
        if (criteria.attendanceMarkingMethod === 'weeklyHours') {
          // Weekly hours method
          const expectedWeeklyHours = 40;
          const expectedMonthlyHours = expectedWeeklyHours * 4;
          const actualHours = presentDays * 8 + halfDays * 4;
          const missingHours = Math.max(0, expectedMonthlyHours - actualHours);
          totalDeductions = missingHours * (criteria.hourlyDeductionRate || 0);
        } else {
          // Check-in/checkout method
          const lateAsAbsent = Math.floor(lateDays / (criteria.lateThreshold || SALARY.DEFAULT_LATE_THRESHOLD));
          
          // Apply half-day penalty
          const halfDayAsAbsent = criteria.halfDayThreshold > 0 
            ? Math.floor(halfDays / criteria.halfDayThreshold) 
            : 0;
          
          // Apply early-departure penalty (only count "early-departure" status, not "late-early-departure")
          let earlyDepartureDays = 0;
          dateStatusMap.forEach((record) => {
            if (record.status === "early-departure") {
              earlyDepartureDays++;
            }
          });
          const earlyDepartureAsAbsent = criteria.earlyDepartureThreshold > 0 
            ? Math.floor(earlyDepartureDays / criteria.earlyDepartureThreshold) 
            : 0;
          
          // Apply late-early-departure penalty
          let lateEarlyDepartureDays = 0;
          dateStatusMap.forEach((record) => {
            if (record.status === "late-early-departure") {
              lateEarlyDepartureDays++;
            }
          });
          const lateEarlyDepartureAsAbsent = criteria.lateEarlyDepartureThreshold > 0 
            ? Math.floor(lateEarlyDepartureDays / criteria.lateEarlyDepartureThreshold) 
            : 0;
          
          const totalAbsents = absentDays + lateAsAbsent + halfDayAsAbsent + earlyDepartureAsAbsent + lateEarlyDepartureAsAbsent;
          
          // Auto-calculate per day salary (rounded down, no decimals)
          const perDaySalary = Math.floor(baseSalary / totalWorkingDays);
          const absentDeduction = totalAbsents * perDaySalary;
          totalDeductions = absentDeduction;
        }

        // Perfect attendance bonus
        if (criteria.perfectAttendanceBonusEnabled) {
          const attendancePercentage = (presentDays / totalWorkingDays) * SALARY.PERCENTAGE_MULTIPLIER;
          if (attendancePercentage >= (criteria.perfectAttendanceThreshold || SALARY.DEFAULT_PERFECT_ATTENDANCE_THRESHOLD)) {
            bonus = criteria.perfectAttendanceBonusAmount || 0;
          }
        }

        const totalWorkedDays = presentDays + halfDays * ATTENDANCE.HALF_DAY_MULTIPLIER;
        // Auto-calculate per day salary (rounded down, no decimals)
        const perDaySalary = Math.floor(baseSalary / totalWorkingDays);
        
        // Calculate per-hour salary (daily hours from work schedule)
        const dailyHours = employee.workSchedule.workingHoursPerWeek / employee.workSchedule.workingDaysPerWeek;
        const perHourSalary = Math.floor(perDaySalary / dailyHours);

        // Calculate extra working hours and weekly off days worked
        let totalExtraWorkingHours = 0;
        let weeklyOffDaysWorked = 0;
        
        if (criteria.includeExtraWorkingHours || criteria.includeWeeklyOffDaysWorked) {
          attendanceRecords.forEach((record) => {
            const recordDate = new Date(record.date);
            const dayName = recordDate.toLocaleDateString("en-US", { weekday: "long" });
            const isWeeklyOff = employee.workSchedule.weeklyOffs.includes(dayName);
            
            // Check if this is a weekly off day and employee worked
            if (criteria.includeWeeklyOffDaysWorked && isWeeklyOff && record.checkIn && record.checkOut) {
              // Only count if status is present, late, or late-early-departure (not absent/leave)
              if (record.status === "present" || record.status === "late" || 
                  record.status === "early-departure" || record.status === "late-early-departure" ||
                  (record.status === "pending" && record.checkIn)) {
                weeklyOffDaysWorked++;
              }
            }
            
            // Calculate extra working hours (only for working days, not weekly offs)
            if (criteria.includeExtraWorkingHours && !isWeeklyOff && record.extraWorkingHours) {
              totalExtraWorkingHours += record.extraWorkingHours;
            }
          });
        }

        // Calculate additions for extra work
        let extraWorkAdditions = 0;
        if (criteria.includeExtraWorkingHours && totalExtraWorkingHours > 0) {
          extraWorkAdditions += totalExtraWorkingHours * perHourSalary;
        }
        if (criteria.includeWeeklyOffDaysWorked && weeklyOffDaysWorked > 0) {
          extraWorkAdditions += weeklyOffDaysWorked * perDaySalary;
        }
        
        const netSalary = baseSalary - totalDeductions + bonus + extraWorkAdditions;

        const salaryData = {
          employee: employee._id,
          employeeId: employee.employeeId,
          month,
          year,
          baseSalary: baseSalary,
          calculations: {
            totalWorkingDays,
            presentDays,
            absentDays,
            halfDays,
            lateDays,
            totalWorkedDays,
            perDaySalary,
          },
          deductions: {
            absentDeduction: totalDeductions,
            lateDeduction: 0,
            otherDeductions: 0,
            totalDeductions,
          },
          additions: {
            overtime: criteria.includeExtraWorkingHours ? totalExtraWorkingHours * perHourSalary : 0,
            bonus: bonus,
            weeklyOffDaysWorked: criteria.includeWeeklyOffDaysWorked ? weeklyOffDaysWorked * perDaySalary : 0,
            allowances: 0,
            totalAdditions: bonus + extraWorkAdditions,
          },
          extraWork: {
            totalExtraWorkingHours: totalExtraWorkingHours,
            weeklyOffDaysWorked: weeklyOffDaysWorked,
            perHourSalary: perHourSalary,
          },
          netSalary,
          status: "paid",
          calculatedBy: req.user._id,
        };

        // Use findOneAndUpdate with upsert to prevent race conditions
        const salary = await Salary.findOneAndUpdate(
          {
            employee: employee._id,
            month,
            year,
          },
          {
            $set: salaryData,
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
          }
        );

        results.push({
          employeeId: employee.employeeId,
          name: employee.name,
          netSalary,
        });
      } catch (err) {
        // Skip duplicate key errors (salary already exists)
        if (err.code === 11000) {
          errors.push({
            employeeId: employee.employeeId,
            message: "Already calculated",
          });
        } else {
          errors.push({
            employeeId: employee.employeeId,
            message: err.message,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Salary calculation completed",
      data: {
        calculated: results.length,
        errors: errors.length,
        errorDetails: errors, // Include error details
        results,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Preview salary calculation without saving
export const previewSalary = async (req, res) => {
  try {
    const { employeeId, month, year, criteria } = req.body;

    // Find employee with role populated
    const employee = await Employee.findOne({ employeeId, isActive: true }).populate('role', 'name');
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Skip salary calculation for superAdmin
    if (employee.role?.name === 'superAdmin') {
      return res.status(400).json({
        success: false,
        message: "Salary calculation is not applicable for superAdmin",
      });
    }

    // Check if employee has salary information
    if (!employee.salary || !employee.salary.monthlySalary || employee.salary.monthlySalary <= 0) {
      return res.status(400).json({
        success: false,
        message: `Employee ${employeeId} has no salary set (${employee.salary?.monthlySalary || 0}). Please update employee salary first.`,
      });
    }

    // Calculate total working days in the month
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const weeklyOffs = employee.workSchedule.weeklyOffs;
    
    let totalWorkingDays = 0;
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      if (!weeklyOffs.includes(dayName)) {
        totalWorkingDays++;
      }
    }

    // Get attendance records for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const attendanceRecords = await Attendance.find({
      $or: [{ employee: employee._id }, { userId: employee.employeeId }],
      date: { $gte: startDate, $lte: endDate },
    });

    // Helper function to normalize date to YYYY-MM-DD format consistently (local time, not UTC)
    const normalizeDateStr = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Calculate attendance statistics
    let presentDays = 0;
    let recordedAbsentDays = 0;
    let halfDays = 0;
    let lateDays = 0;
    let earlyArrivals = 0;
    let leaveDays = 0;

    // Create maps to track the status for each date (to avoid double-counting)
    const dateStatusMap = new Map(); // dateStr -> status
    const datesWithRecords = new Set();

    // Process attendance records - use the latest record for each date if multiple exist
    attendanceRecords.forEach((record) => {
      const dateStr = normalizeDateStr(record.date);
      datesWithRecords.add(dateStr);
      
      // If multiple records exist for the same date, keep the latest one
      if (!dateStatusMap.has(dateStr) || new Date(record.date) > new Date(dateStatusMap.get(dateStr).date)) {
        dateStatusMap.set(dateStr, record);
      }
    });

    // Count attendance statistics from unique dates only
    dateStatusMap.forEach((record) => {
      const status = record.status;
      
      if (status === "present" || status === "early-departure") {
        presentDays++;
        if (status === "early-departure") earlyArrivals++;
      }
      else if (status === "absent") {
        recordedAbsentDays++;
      }
      else if (status === "half-day") {
        halfDays++;
      }
      else if (status === "leave") {
        leaveDays++;
      }
      else if (status === "late") {
        lateDays++;
        presentDays++; // Late is still considered present
      }
      else if (status === "late-early-departure") {
        lateDays++;
        presentDays++; // Late-early-departure is still considered present
        earlyArrivals++; // Also count for early arrival bonus
      }
      else if (status === "pending" && record.checkIn) {
        presentDays++;
      }
    });

    // Subtract leave days from total working days
    totalWorkingDays = Math.max(0, totalWorkingDays - leaveDays);

    // Calculate missing days (working days without any attendance record, excluding leave days)
    // First, create a set of dates that have leave records
    const leaveDates = new Set();
    dateStatusMap.forEach((record, dateStr) => {
      if (record.status === "leave") {
        leaveDates.add(dateStr);
      }
    });

    let missingDays = 0;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      const dateStr = normalizeDateStr(date);
      
      // Skip weekly offs
      if (weeklyOffs.includes(dayName)) continue;
      
      // Skip future dates
      if (date > today) continue;
      
      // If no record exists for this working day, count as missing (absent)
      // But exclude days that are leaves (leaves are already accounted for)
      if (!datesWithRecords.has(dateStr) && !leaveDates.has(dateStr)) {
        missingDays++;
      }
    }

    // Total absent = explicitly marked absent + missing days
    const absentDays = recordedAbsentDays + missingDays;

    let totalDeductions = 0;
    let bonus = 0;
    const baseSalary = employee.salary.monthlySalary;
    
    // Initialize variables that may be used in response
    let earlyDepartureDays = 0;
    let lateEarlyDepartureDays = 0;
    
    let deductionBreakdown = {
      absentDeduction: 0,
      lateDeduction: 0,
      lateAsAbsent: 0,
      halfDayAsAbsent: 0,
      earlyDepartureAsAbsent: 0,
      lateEarlyDepartureAsAbsent: 0,
      excessLeaves: 0,
      otherDeductions: 0,
    };
    let bonusBreakdown = {
      perfectAttendanceBonus: 0,
    };

    // Calculate based on attendance marking method
    if (criteria.attendanceMarkingMethod === 'weeklyHours') {
      // Weekly hours method
      const expectedWeeklyHours = 40;
      const expectedMonthlyHours = expectedWeeklyHours * 4;
      const actualHours = presentDays * 8 + halfDays * 4;
      const missingHours = Math.max(0, expectedMonthlyHours - actualHours);
      totalDeductions = missingHours * (criteria.hourlyDeductionRate || 0);
      deductionBreakdown.otherDeductions = totalDeductions;
    } else {
      // Check-in/checkout method
      // Apply leave threshold logic
      const leaveThreshold = employee.salary.leaveThreshold || 0;
      const excessLeaves = Math.max(0, leaveDays - leaveThreshold);
      deductionBreakdown.excessLeaves = excessLeaves;
      
      // Apply late penalty
      const lateAsAbsent = Math.floor(lateDays / (criteria.lateThreshold || SALARY.DEFAULT_LATE_THRESHOLD));
      deductionBreakdown.lateAsAbsent = lateAsAbsent;
      
      // Apply half-day penalty
      const halfDayAsAbsent = criteria.halfDayThreshold > 0 
        ? Math.floor(halfDays / criteria.halfDayThreshold) 
        : 0;
      deductionBreakdown.halfDayAsAbsent = halfDayAsAbsent;
      
      // Apply early-departure penalty (only count "early-departure" status, not "late-early-departure")
      earlyDepartureDays = 0;
      dateStatusMap.forEach((record) => {
        if (record.status === "early-departure") {
          earlyDepartureDays++;
        }
      });
      const earlyDepartureAsAbsent = criteria.earlyDepartureThreshold > 0 
        ? Math.floor(earlyDepartureDays / criteria.earlyDepartureThreshold) 
        : 0;
      deductionBreakdown.earlyDepartureAsAbsent = earlyDepartureAsAbsent;
      
      // Apply late-early-departure penalty
      // Count late-early-departure days (from status "late-early-departure")
      lateEarlyDepartureDays = 0;
      dateStatusMap.forEach((record) => {
        if (record.status === "late-early-departure") {
          lateEarlyDepartureDays++;
        }
      });
      const lateEarlyDepartureAsAbsent = criteria.lateEarlyDepartureThreshold > 0 
        ? Math.floor(lateEarlyDepartureDays / criteria.lateEarlyDepartureThreshold) 
        : 0;
      deductionBreakdown.lateEarlyDepartureAsAbsent = lateEarlyDepartureAsAbsent;
      
      const totalAbsents = absentDays + lateAsAbsent + halfDayAsAbsent + earlyDepartureAsAbsent + lateEarlyDepartureAsAbsent + excessLeaves;
      
      // Calculate deductions
      // Auto-calculate per day salary (rounded down, no decimals)
      const perDaySalary = Math.floor(baseSalary / totalWorkingDays);
      const absentDeduction = totalAbsents * perDaySalary;
      deductionBreakdown.absentDeduction = absentDeduction;
      totalDeductions = absentDeduction;
    }

    // Perfect attendance bonus
    if (criteria.perfectAttendanceBonusEnabled) {
      const attendancePercentage = (presentDays / totalWorkingDays) * SALARY.PERCENTAGE_MULTIPLIER;
      if (attendancePercentage >= (criteria.perfectAttendanceThreshold || SALARY.DEFAULT_PERFECT_ATTENDANCE_THRESHOLD)) {
        bonus = criteria.perfectAttendanceBonusAmount || 0;
        bonusBreakdown.perfectAttendanceBonus = bonus;
      }
    }

    // Calculate total worked days
    const totalWorkedDays = presentDays + halfDays * ATTENDANCE.HALF_DAY_MULTIPLIER;
    // Auto-calculate per day salary (rounded down, no decimals)
    const perDaySalary = Math.floor(baseSalary / totalWorkingDays);
    
    // Calculate per-hour salary (daily hours from work schedule)
    const dailyHours = employee.workSchedule.workingHoursPerWeek / employee.workSchedule.workingDaysPerWeek;
    const perHourSalary = Math.floor(perDaySalary / dailyHours);

    // Calculate extra working hours and weekly off days worked
    let totalExtraWorkingHours = 0;
    let weeklyOffDaysWorked = 0;
    
    if (criteria.includeExtraWorkingHours || criteria.includeWeeklyOffDaysWorked) {
      attendanceRecords.forEach((record) => {
        const recordDate = new Date(record.date);
        const dayName = recordDate.toLocaleDateString("en-US", { weekday: "long" });
        const isWeeklyOff = employee.workSchedule.weeklyOffs.includes(dayName);
        
        // Check if this is a weekly off day and employee worked
        if (criteria.includeWeeklyOffDaysWorked && isWeeklyOff && record.checkIn && record.checkOut) {
          // Only count if status is present, late, or late-early-departure (not absent/leave)
          if (record.status === "present" || record.status === "late" || 
              record.status === "early-departure" || record.status === "late-early-departure" ||
              (record.status === "pending" && record.checkIn)) {
            weeklyOffDaysWorked++;
          }
        }
        
        // Calculate extra working hours (only for working days, not weekly offs)
        if (criteria.includeExtraWorkingHours && !isWeeklyOff && record.extraWorkingHours) {
          totalExtraWorkingHours += record.extraWorkingHours;
        }
      });
    }

    // Calculate additions for extra work
    let extraWorkAdditions = 0;
    if (criteria.includeExtraWorkingHours && totalExtraWorkingHours > 0) {
      extraWorkAdditions += totalExtraWorkingHours * perHourSalary;
    }
    if (criteria.includeWeeklyOffDaysWorked && weeklyOffDaysWorked > 0) {
      extraWorkAdditions += weeklyOffDaysWorked * perDaySalary;
    }

    // Calculate net salary
    const netSalary = baseSalary - totalDeductions + bonus + extraWorkAdditions;

    res.status(200).json({
      success: true,
      data: {
        employee: {
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department?.name || "N/A",
        },
        baseSalary,
        calculations: {
          totalWorkingDays,
          presentDays,
          absentDays,
          halfDays,
          lateDays,
          leaveDays,
          earlyArrivals,
          earlyDepartureDays: earlyDepartureDays || 0,
          lateEarlyDepartureDays: lateEarlyDepartureDays || 0,
          totalWorkedDays,
          perDaySalary,
          recordedAbsentDays,
          missingDays,
        },
        deductions: {
          ...deductionBreakdown,
          totalDeductions,
        },
        additions: {
          overtime: criteria.includeExtraWorkingHours ? totalExtraWorkingHours * perHourSalary : 0,
          bonus,
          weeklyOffDaysWorked: criteria.includeWeeklyOffDaysWorked ? weeklyOffDaysWorked * perDaySalary : 0,
          totalAdditions: bonus + extraWorkAdditions,
        },
        bonusBreakdown,
        extraWork: {
          totalExtraWorkingHours: totalExtraWorkingHours,
          weeklyOffDaysWorked: weeklyOffDaysWorked,
          perHourSalary: perHourSalary,
        },
        netSalary,
      },
    });
  } catch (error) {
    logger.error(`Salary preview error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Preview salary calculation for all employees
export const previewAllSalaries = async (req, res) => {
  try {
    const { month, year, departmentId, criteria } = req.body;

    // Get superAdmin role to exclude from salary calculation
    const superAdminRole = await Role.findOne({ name: 'superAdmin' });

    let query = { isActive: true };
    if (departmentId) {
      query.department = departmentId;
    }
    // Exclude superAdmin from salary calculation
    if (superAdminRole) {
      query.role = { $ne: superAdminRole._id };
    }

    const employees = await Employee.find(query).populate('department', 'name');
    const previews = [];
    const errors = [];

    for (const employee of employees) {
      try {
        // Check if employee has salary information
        if (!employee.salary || !employee.salary.monthlySalary || employee.salary.monthlySalary <= 0) {
          errors.push({
            employeeId: employee.employeeId,
            name: employee.name,
            message: `No salary set (${employee.salary?.monthlySalary || 0})`,
          });
          continue;
        }

        // Calculate total working days in the month
        const totalDaysInMonth = new Date(year, month, 0).getDate();
        const weeklyOffs = employee.workSchedule.weeklyOffs;
        
        let totalWorkingDays = 0;
        for (let day = 1; day <= totalDaysInMonth; day++) {
          const date = new Date(year, month - 1, day);
          const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
          if (!weeklyOffs.includes(dayName)) {
            totalWorkingDays++;
          }
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const attendanceRecords = await Attendance.find({
          $or: [{ employee: employee._id }, { userId: employee.employeeId }],
          date: { $gte: startDate, $lte: endDate },
        });

        // Helper function to normalize date to YYYY-MM-DD format consistently (local time, not UTC)
        const normalizeDateStr = (date) => {
          const d = new Date(date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        let presentDays = 0;
        let recordedAbsentDays = 0;
        let halfDays = 0;
        let lateDays = 0;
        let earlyArrivals = 0;
        let leaveDays = 0;

        // Create maps to track the status for each date (to avoid double-counting)
        const dateStatusMap = new Map(); // dateStr -> status
        const datesWithRecords = new Set();

        // Process attendance records - use the latest record for each date if multiple exist
        attendanceRecords.forEach((record) => {
          const dateStr = normalizeDateStr(record.date);
          datesWithRecords.add(dateStr);
          
          // If multiple records exist for the same date, keep the latest one
          if (!dateStatusMap.has(dateStr) || new Date(record.date) > new Date(dateStatusMap.get(dateStr).date)) {
            dateStatusMap.set(dateStr, record);
          }
        });

        // Count attendance statistics from unique dates only
        dateStatusMap.forEach((record) => {
          const status = record.status;
          
          if (status === "present" || status === "early-departure") {
            presentDays++;
            if (status === "early-departure") earlyArrivals++;
          }
          else if (status === "absent") {
            recordedAbsentDays++;
          }
          else if (status === "half-day") {
            halfDays++;
          }
          else if (status === "leave") {
            leaveDays++;
          }
          else if (status === "late" || status === "late-early-departure") {
            lateDays++;
            presentDays++; // Late is still considered present
            if (status === "late-early-departure") earlyArrivals++;
          }
          else if (status === "pending" && record.checkIn) {
            presentDays++;
          }
        });

        totalWorkingDays = Math.max(0, totalWorkingDays - leaveDays);

        // Calculate missing days (working days without any attendance record, excluding leave days)
        // First, create a set of dates that have leave records
        const leaveDates = new Set();
        dateStatusMap.forEach((record, dateStr) => {
          if (record.status === "leave") {
            leaveDates.add(dateStr);
          }
        });

        let missingDays = 0;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        for (let day = 1; day <= totalDaysInMonth; day++) {
          const date = new Date(year, month - 1, day);
          const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
          const dateStr = normalizeDateStr(date);
          
          if (weeklyOffs.includes(dayName)) continue;
          if (date > today) continue;
          
          // If no record exists for this working day, count as missing (absent)
          // But exclude days that are leaves (leaves are already accounted for)
          if (!datesWithRecords.has(dateStr) && !leaveDates.has(dateStr)) {
            missingDays++;
          }
        }

        const absentDays = recordedAbsentDays + missingDays;

        let totalDeductions = 0;
        let bonus = 0;
        const baseSalary = employee.salary.monthlySalary;

        if (criteria.attendanceMarkingMethod === 'weeklyHours') {
          const expectedWeeklyHours = 40;
          const expectedMonthlyHours = expectedWeeklyHours * 4;
          const actualHours = presentDays * 8 + halfDays * 4;
          const missingHours = Math.max(0, expectedMonthlyHours - actualHours);
          totalDeductions = missingHours * (criteria.hourlyDeductionRate || 0);
        } else {
          const lateAsAbsent = Math.floor(lateDays / (criteria.lateThreshold || SALARY.DEFAULT_LATE_THRESHOLD));
          
          // Apply half-day penalty
          const halfDayAsAbsent = criteria.halfDayThreshold > 0 
            ? Math.floor(halfDays / criteria.halfDayThreshold) 
            : 0;
          
          // Apply early-departure penalty (only count "early-departure" status, not "late-early-departure")
          let earlyDepartureDays = 0;
          dateStatusMap.forEach((record) => {
            if (record.status === "early-departure") {
              earlyDepartureDays++;
            }
          });
          const earlyDepartureAsAbsent = criteria.earlyDepartureThreshold > 0 
            ? Math.floor(earlyDepartureDays / criteria.earlyDepartureThreshold) 
            : 0;
          
          // Apply late-early-departure penalty
          let lateEarlyDepartureDays = 0;
          dateStatusMap.forEach((record) => {
            if (record.status === "late-early-departure") {
              lateEarlyDepartureDays++;
            }
          });
          const lateEarlyDepartureAsAbsent = criteria.lateEarlyDepartureThreshold > 0 
            ? Math.floor(lateEarlyDepartureDays / criteria.lateEarlyDepartureThreshold) 
            : 0;
          
          const totalAbsents = absentDays + lateAsAbsent + halfDayAsAbsent + earlyDepartureAsAbsent + lateEarlyDepartureAsAbsent;
          
          // Auto-calculate per day salary (rounded down, no decimals)
          const perDaySalary = Math.floor(baseSalary / totalWorkingDays);
          const absentDeduction = totalAbsents * perDaySalary;
          totalDeductions = absentDeduction;
        }

        if (criteria.perfectAttendanceBonusEnabled) {
          const attendancePercentage = (presentDays / totalWorkingDays) * SALARY.PERCENTAGE_MULTIPLIER;
          if (attendancePercentage >= (criteria.perfectAttendanceThreshold || SALARY.DEFAULT_PERFECT_ATTENDANCE_THRESHOLD)) {
            bonus = criteria.perfectAttendanceBonusAmount || 0;
          }
        }

        // Calculate per-hour salary (daily hours from work schedule)
        const dailyHours = employee.workSchedule.workingHoursPerWeek / employee.workSchedule.workingDaysPerWeek;
        const perHourSalary = Math.floor((baseSalary / totalWorkingDays) / dailyHours);

        // Calculate extra working hours and weekly off days worked
        let totalExtraWorkingHours = 0;
        let weeklyOffDaysWorked = 0;
        
        if (criteria.includeExtraWorkingHours || criteria.includeWeeklyOffDaysWorked) {
          attendanceRecords.forEach((record) => {
            const recordDate = new Date(record.date);
            const dayName = recordDate.toLocaleDateString("en-US", { weekday: "long" });
            const isWeeklyOff = employee.workSchedule.weeklyOffs.includes(dayName);
            
            // Check if this is a weekly off day and employee worked
            if (criteria.includeWeeklyOffDaysWorked && isWeeklyOff && record.checkIn && record.checkOut) {
              // Only count if status is present, late, or late-early-departure (not absent/leave)
              if (record.status === "present" || record.status === "late" || 
                  record.status === "early-departure" || record.status === "late-early-departure" ||
                  (record.status === "pending" && record.checkIn)) {
                weeklyOffDaysWorked++;
              }
            }
            
            // Calculate extra working hours (only for working days, not weekly offs)
            if (criteria.includeExtraWorkingHours && !isWeeklyOff && record.extraWorkingHours) {
              totalExtraWorkingHours += record.extraWorkingHours;
            }
          });
        }

        // Calculate additions for extra work
        let extraWorkAdditions = 0;
        if (criteria.includeExtraWorkingHours && totalExtraWorkingHours > 0) {
          extraWorkAdditions += totalExtraWorkingHours * perHourSalary;
        }
        if (criteria.includeWeeklyOffDaysWorked && weeklyOffDaysWorked > 0) {
          const perDaySalary = Math.floor(baseSalary / totalWorkingDays);
          extraWorkAdditions += weeklyOffDaysWorked * perDaySalary;
        }

        const netSalary = baseSalary - totalDeductions + bonus + extraWorkAdditions;

        previews.push({
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department?.name || "N/A",
          baseSalary,
          presentDays,
          absentDays,
          lateDays,
          halfDays,
          totalDeductions,
          bonus,
          overtime: criteria.includeExtraWorkingHours ? totalExtraWorkingHours * perHourSalary : 0,
          weeklyOffDaysWorked: criteria.includeWeeklyOffDaysWorked ? weeklyOffDaysWorked * Math.floor(baseSalary / totalWorkingDays) : 0,
          totalAdditions: bonus + extraWorkAdditions,
          netSalary,
        });
      } catch (err) {
        errors.push({
          employeeId: employee.employeeId,
          name: employee.name,
          message: err.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        previews,
        errors,
        summary: {
          totalEmployees: employees.length,
          calculated: previews.length,
          errors: errors.length,
          totalBaseSalary: previews.reduce((sum, p) => sum + p.baseSalary, 0),
          totalDeductions: previews.reduce((sum, p) => sum + p.totalDeductions, 0),
          totalBonus: previews.reduce((sum, p) => sum + p.bonus, 0),
          totalNetSalary: previews.reduce((sum, p) => sum + p.netSalary, 0),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all salaries
export const getAllSalaries = async (req, res) => {
  try {
    const { month, year, status, employeeId } = req.query;
    const filter = {};

    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (status) filter.status = status;
    if (employeeId) filter.employeeId = employeeId;

    const salaries = await Salary.find(filter)
      .populate("employee", "employeeId name email department position")
      .populate("calculatedBy", "name")
      .populate("approvedBy", "name")
      .sort({ year: -1, month: -1, employeeId: 1 });

    res.status(200).json({
      success: true,
      count: salaries.length,
      data: salaries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get salary by ID
export const getSalaryById = async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id)
      .populate("employee")
      .populate("calculatedBy", "name")
      .populate("approvedBy", "name");

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: salary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve salary
export const approveSalary = async (req, res) => {
  try {
    const salary = await Salary.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        approvedBy: req.user._id,
      },
      { new: true }
    ).populate("employee", "employeeId name email");

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    // Audit log
    await logSalaryAction(req, "STATUS_CHANGE", salary, {
      before: { status: "pending" },
      after: { status: "approved" }
    }, `Salary approved for ${salary.employee?.name} - ${salary.month}/${salary.year}`);

    res.status(200).json({
      success: true,
      message: "Salary approved successfully",
      data: salary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark salary as paid
export const markSalaryPaid = async (req, res) => {
  try {
    const salary = await Salary.findByIdAndUpdate(
      req.params.id,
      {
        status: "paid",
        paidOn: new Date(),
      },
      { new: true }
    ).populate("employee", "employeeId name email");

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    // Audit log
    await logSalaryAction(req, "STATUS_CHANGE", salary, {
      before: { status: "approved" },
      after: { status: "paid", paidOn: salary.paidOn }
    }, `Salary paid for ${salary.employee?.name} - ${salary.month}/${salary.year}`);

    res.status(200).json({
      success: true,
      message: "Salary marked as paid",
      data: salary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update salary (for manual adjustments)
export const updateSalary = async (req, res) => {
  try {
    const { deductions, additions, remarks } = req.body;

    const salary = await Salary.findById(req.params.id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    if (deductions) {
      salary.deductions = {
        ...salary.deductions,
        ...deductions,
        totalDeductions:
          (deductions.absentDeduction || salary.deductions.absentDeduction) +
          (deductions.lateDeduction || salary.deductions.lateDeduction) +
          (deductions.otherDeductions || salary.deductions.otherDeductions),
      };
    }

    if (additions) {
      salary.additions = {
        ...salary.additions,
        ...additions,
        totalAdditions:
          (additions.overtime || salary.additions.overtime) +
          (additions.bonus || salary.additions.bonus) +
          (additions.allowances || salary.additions.allowances),
      };
    }

    // Recalculate net salary
    salary.netSalary =
      salary.baseSalary -
      salary.deductions.totalDeductions +
      salary.additions.totalAdditions;

    if (remarks) salary.remarks = remarks;

    await salary.save();

    const updatedSalary = await Salary.findById(salary._id).populate(
      "employee",
      "employeeId name email"
    );

    // Audit log
    await logSalaryAction(req, "UPDATE", updatedSalary, {
      before: { netSalary: salary.netSalary },
      after: { netSalary: updatedSalary.netSalary, deductions, additions }
    }, `Salary updated for ${updatedSalary.employee?.name} - ${updatedSalary.month}/${updatedSalary.year}`);

    res.status(200).json({
      success: true,
      message: "Salary updated successfully",
      data: updatedSalary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
