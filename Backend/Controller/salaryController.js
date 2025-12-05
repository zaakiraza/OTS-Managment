import Salary from "../Model/Salary.js";
import Employee from "../Model/Employee.js";
import Attendance from "../Model/Attendance.js";

// Calculate salary for a specific month
export const calculateSalary = async (req, res) => {
  try {
    const { employeeId, month, year } = req.body;

    // Find employee
    const employee = await Employee.findOne({ employeeId, isActive: true });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if salary already calculated
    const existingSalary = await Salary.findOne({
      employee: employee._id,
      month,
      year,
    });

    if (existingSalary) {
      return res.status(400).json({
        success: false,
        message: "Salary already calculated for this month",
        data: existingSalary,
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

    // Calculate attendance statistics
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let lateDays = 0;

    attendanceRecords.forEach((record) => {
      if (record.status === "present") presentDays++;
      else if (record.status === "absent") absentDays++;
      else if (record.status === "half-day") halfDays++;
      else if (record.status === "late") lateDays++;
    });

    // Calculate total worked days (half-day counts as 0.5)
    const totalWorkedDays = presentDays + halfDays * 0.5 + lateDays;

    // Calculate per day salary
    const perDaySalary = employee.salary.monthlySalary / totalWorkingDays;

    // Calculate deductions
    const absentDeduction = (totalWorkingDays - presentDays - halfDays * 0.5 - lateDays) * perDaySalary;
    const lateDeduction = lateDays * (perDaySalary * 0.1); // 10% deduction for late days
    const totalDeductions = absentDeduction + lateDeduction;

    // Calculate net salary
    const netSalary = employee.salary.monthlySalary - totalDeductions;

    const salary = await Salary.create({
      employee: employee._id,
      employeeId: employee.employeeId,
      month,
      year,
      baseSalary: employee.salary.monthlySalary,
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
        absentDeduction,
        lateDeduction,
        otherDeductions: 0,
        totalDeductions,
      },
      additions: {
        overtime: 0,
        bonus: 0,
        allowances: 0,
        totalAdditions: 0,
      },
      netSalary,
      status: "calculated",
      calculatedBy: req.user._id,
    });

    const populatedSalary = await Salary.findById(salary._id).populate(
      "employee",
      "employeeId name email department position"
    );

    res.status(201).json({
      success: true,
      message: "Salary calculated successfully",
      data: populatedSalary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Calculate salary for all employees
export const calculateAllSalaries = async (req, res) => {
  try {
    const { month, year } = req.body;

    const employees = await Employee.find({ isActive: true });
    const results = [];
    const errors = [];

    for (const employee of employees) {
      try {
        // Check if already calculated
        const existingSalary = await Salary.findOne({
          employee: employee._id,
          month,
          year,
        });

        if (existingSalary) {
          errors.push({
            employeeId: employee.employeeId,
            message: "Already calculated",
          });
          continue;
        }

        // Same calculation logic as above
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

        let presentDays = 0;
        let absentDays = 0;
        let halfDays = 0;
        let lateDays = 0;

        attendanceRecords.forEach((record) => {
          if (record.status === "present") presentDays++;
          else if (record.status === "absent") absentDays++;
          else if (record.status === "half-day") halfDays++;
          else if (record.status === "late") lateDays++;
        });

        const totalWorkedDays = presentDays + halfDays * 0.5 + lateDays;
        const perDaySalary = employee.salary.monthlySalary / totalWorkingDays;
        const absentDeduction = (totalWorkingDays - presentDays - halfDays * 0.5 - lateDays) * perDaySalary;
        const lateDeduction = lateDays * (perDaySalary * 0.1);
        const totalDeductions = absentDeduction + lateDeduction;
        const netSalary = employee.salary.monthlySalary - totalDeductions;

        const salary = await Salary.create({
          employee: employee._id,
          employeeId: employee.employeeId,
          month,
          year,
          baseSalary: employee.salary.monthlySalary,
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
            absentDeduction,
            lateDeduction,
            otherDeductions: 0,
            totalDeductions,
          },
          additions: {
            overtime: 0,
            bonus: 0,
            allowances: 0,
            totalAdditions: 0,
          },
          netSalary,
          status: "calculated",
          calculatedBy: req.user._id,
        });

        results.push({
          employeeId: employee.employeeId,
          name: employee.name,
          netSalary,
        });
      } catch (err) {
        errors.push({
          employeeId: employee.employeeId,
          message: err.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Salary calculation completed",
      data: {
        calculated: results.length,
        errors: errors.length,
        results,
        errors,
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
