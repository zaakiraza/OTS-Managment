import Salary from "../Model/Salary.js";
import Employee from "../Model/Employee.js";
import Attendance from "../Model/Attendance.js";
import Role from "../Model/Role.js";
import logger from "../Utils/logger.js";
import { SALARY, ATTENDANCE } from "../Config/constants.js";

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

    // Calculate attendance statistics
    let presentDays = 0;
    let recordedAbsentDays = 0;
    let halfDays = 0;
    let lateDays = 0;
    let earlyArrivals = 0;
    let leaveDays = 0;

    // Create a set of dates that have attendance records
    const datesWithRecords = new Set();

    attendanceRecords.forEach((record) => {
      const dateStr = new Date(record.date).toISOString().split('T')[0];
      datesWithRecords.add(dateStr);
      
      if (record.status === "present" || record.status === "early-arrival") {
        presentDays++;
        if (record.status === "early-arrival") earlyArrivals++;
      }
      else if (record.status === "absent") recordedAbsentDays++;
      else if (record.status === "half-day") halfDays++;
      else if (record.status === "leave") leaveDays++;
      else if (record.status === "late" || record.status === "late-early-arrival") {
        lateDays++;
        presentDays++; // Late is still considered present
        if (record.status === "late-early-arrival") earlyArrivals++;
      }
      else if (record.status === "pending" && record.checkIn) {
        // Pending with check-in counts as present
        presentDays++;
      }
    });

    // Calculate missing days (working days without any attendance record)
    let missingDays = 0;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      const dateStr = date.toISOString().split('T')[0];
      
      // Skip weekly offs
      if (weeklyOffs.includes(dayName)) continue;
      
      // Skip future dates
      if (date > today) continue;
      
      // If no record exists for this working day, count as missing (absent)
      if (!datesWithRecords.has(dateStr)) {
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
      const totalAbsents = absentDays + lateAsAbsent + excessLeaves;
      
      // Apply early arrival bonus
      const earlyBonus = criteria.earlyArrivalBonus > 0 
        ? Math.floor(earlyArrivals / criteria.earlyArrivalBonus) 
        : 0;
      
      // Calculate deductions
      const perDaySalary = baseSalary / totalWorkingDays;
      const absentDeduction = totalAbsents * (criteria.absentDeduction || perDaySalary);
      totalDeductions = absentDeduction;
      
      // Add bonus days to present
      presentDays += earlyBonus;
      
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
    const perDaySalary = baseSalary / totalWorkingDays;

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
        overtime: 0,
        bonus: bonus,
        allowances: 0,
        totalAdditions: bonus,
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

        let presentDays = 0;
        let recordedAbsentDays = 0; // Days explicitly marked as absent
        let halfDays = 0;
        let lateDays = 0;
        let earlyArrivals = 0;

        // Create a set of dates that have attendance records
        const datesWithRecords = new Set();

        attendanceRecords.forEach((record) => {
          const dateStr = new Date(record.date).toISOString().split('T')[0];
          datesWithRecords.add(dateStr);
          
          if (record.status === "present" || record.status === "early-arrival") {
            presentDays++;
            if (record.status === "early-arrival") earlyArrivals++;
          }
          else if (record.status === "absent") recordedAbsentDays++;
          else if (record.status === "half-day") halfDays++;
          else if (record.status === "late" || record.status === "late-early-arrival") {
            lateDays++;
            presentDays++; // Late is still considered present
            if (record.status === "late-early-arrival") earlyArrivals++;
          }
          else if (record.status === "pending" && record.checkIn) {
            // Pending with check-in counts as present
            presentDays++;
          }
        });

        // Calculate missing days (working days without any attendance record)
        let missingDays = 0;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        for (let day = 1; day <= totalDaysInMonth; day++) {
          const date = new Date(year, month - 1, day);
          const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
          const dateStr = date.toISOString().split('T')[0];
          
          // Skip weekly offs
          if (weeklyOffs.includes(dayName)) continue;
          
          // Skip future dates
          if (date > today) continue;
          
          // If no record exists for this working day, count as missing (absent)
          if (!datesWithRecords.has(dateStr)) {
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
          const totalAbsents = absentDays + lateAsAbsent;
          
          const earlyBonus = criteria.earlyArrivalBonus > 0 
            ? Math.floor(earlyArrivals / criteria.earlyArrivalBonus) 
            : 0;
          
          const perDaySalary = baseSalary / totalWorkingDays;
          const absentDeduction = totalAbsents * (criteria.absentDeduction || perDaySalary);
          totalDeductions = absentDeduction;
          
          presentDays += earlyBonus;
        }

        // Perfect attendance bonus
        if (criteria.perfectAttendanceBonusEnabled) {
          const attendancePercentage = (presentDays / totalWorkingDays) * SALARY.PERCENTAGE_MULTIPLIER;
          if (attendancePercentage >= (criteria.perfectAttendanceThreshold || SALARY.DEFAULT_PERFECT_ATTENDANCE_THRESHOLD)) {
            bonus = criteria.perfectAttendanceBonusAmount || 0;
          }
        }

        const totalWorkedDays = presentDays + halfDays * ATTENDANCE.HALF_DAY_MULTIPLIER;
        const perDaySalary = baseSalary / totalWorkingDays;
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
            overtime: 0,
            bonus: bonus,
            allowances: 0,
            totalAdditions: bonus,
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
