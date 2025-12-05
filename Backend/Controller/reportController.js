import Attendance from "../Model/Attendance.js";
import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import User from "../Model/User.js";
import Salary from "../Model/Salary.js";

// Generate attendance report with multiple filter options
export const generateAttendanceReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      month, // Format: YYYY-MM
      departmentId,
      employeeId,
      userId,
      status,
      reportType, // 'summary' or 'detailed'
    } = req.query;

    let dateFilter = {};

    // Handle month filter
    if (month) {
      const [year, monthNum] = month.split("-");
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);
      dateFilter.date = { $gte: startOfMonth, $lte: endOfMonth };
    }
    // Handle date range filter
    else if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }
    // Handle single day filter
    else if (startDate) {
      const dayStart = new Date(startDate);
      const dayEnd = new Date(startDate + "T23:59:59.999Z");
      dateFilter.date = { $gte: dayStart, $lte: dayEnd };
    }

    // Build filter object
    let filter = { ...dateFilter };

    if (employeeId) {
      const employee = await Employee.findOne({ employeeId });
      if (employee) {
        filter.employee = employee._id;
      }
    }

    if (userId) {
      filter.userId = userId;
    }

    if (status) {
      filter.status = status;
    }

    // Department filter
    if (departmentId) {
      const employees = await Employee.find({
        department: departmentId,
        isActive: true,
      });
      const employeeIds = employees.map((emp) => emp._id);
      filter.employee = { $in: employeeIds };
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(filter)
      .populate({
        path: "employee",
        select: "name employeeId email department position",
        populate: { path: "department", select: "name code" },
      })
      .populate("user", "name userId email")
      .sort({ date: -1, createdAt: -1 });

    // Generate summary statistics
    const summary = {
      totalRecords: attendanceRecords.length,
      statusBreakdown: {},
      totalWorkingHours: 0,
      averageWorkingHours: 0,
    };

    // Calculate statistics
    attendanceRecords.forEach((record) => {
      // Status breakdown
      if (record.status) {
        summary.statusBreakdown[record.status] =
          (summary.statusBreakdown[record.status] || 0) + 1;
      }

      // Total working hours
      if (record.workingHours) {
        summary.totalWorkingHours += record.workingHours;
      }
    });

    // Calculate average
    if (attendanceRecords.length > 0) {
      summary.averageWorkingHours =
        summary.totalWorkingHours / attendanceRecords.length;
    }

    // Get salary information if month and employeeId filters are provided
    let salaryInfo = null;
    if (month && employeeId) {
      const employee = await Employee.findOne({ employeeId });
      if (employee) {
        const [year, monthNum] = month.split("-");
        const salary = await Salary.findOne({
          employee: employee._id,
          month: parseInt(monthNum),
          year: parseInt(year),
        });

        if (salary) {
          salaryInfo = {
            baseSalary: salary.baseSalary,
            workingDays: salary.workingDays,
            presentDays: salary.presentDays,
            absentDays: salary.absentDays,
            halfDays: salary.halfDays,
            lateDays: salary.lateDays,
            deductions: salary.deductions,
            netSalary: salary.netSalary,
            status: salary.status,
            calculatedAt: salary.calculatedAt,
          };
        }
      }
    }

    // Format response based on report type
    let response = {
      success: true,
      summary,
      salaryInfo,
      filters: {
        startDate: startDate || (month ? `${month}-01` : null),
        endDate: endDate || (month ? new Date(month + "-01").toISOString() : null),
        month,
        departmentId,
        employeeId,
        userId,
        status,
      },
    };

    if (reportType === "summary") {
      response.data = {
        totalRecords: attendanceRecords.length,
        summary,
      };
    } else {
      response.data = attendanceRecords;
    }

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Generate department-wise attendance report
export const getDepartmentWiseReport = async (req, res) => {
  try {
    const { startDate, endDate, month } = req.query;

    let dateFilter = {};

    // Handle filters
    if (month) {
      const [year, monthNum] = month.split("-");
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);
      dateFilter = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    // Get all departments
    const departments = await Department.find({ isActive: true });

    const departmentReports = await Promise.all(
      departments.map(async (dept) => {
        // Get employees in this department
        const employees = await Employee.find({
          department: dept._id,
          isActive: true,
        });
        const employeeIds = employees.map((emp) => emp._id);

        // Get attendance records for this department
        let filter = { employee: { $in: employeeIds } };
        if (Object.keys(dateFilter).length > 0) {
          filter.date = dateFilter;
        }

        const attendanceRecords = await Attendance.find(filter);

        // Calculate statistics
        const stats = {
          totalEmployees: employees.length,
          totalRecords: attendanceRecords.length,
          statusBreakdown: {},
          totalWorkingHours: 0,
          averageWorkingHours: 0,
        };

        attendanceRecords.forEach((record) => {
          if (record.status) {
            stats.statusBreakdown[record.status] =
              (stats.statusBreakdown[record.status] || 0) + 1;
          }
          if (record.workingHours) {
            stats.totalWorkingHours += record.workingHours;
          }
        });

        if (attendanceRecords.length > 0) {
          stats.averageWorkingHours =
            stats.totalWorkingHours / attendanceRecords.length;
        }

        return {
          department: {
            id: dept._id,
            name: dept.name,
            code: dept.code,
          },
          statistics: stats,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: departmentReports,
      filters: { startDate, endDate, month },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Generate employee-wise attendance report
export const getEmployeeWiseReport = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, month } = req.query;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const employee = await Employee.findOne({ employeeId }).populate(
      "department",
      "name code"
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    let dateFilter = {};

    if (month) {
      const [year, monthNum] = month.split("-");
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);
      dateFilter = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    let filter = { employee: employee._id };
    if (Object.keys(dateFilter).length > 0) {
      filter.date = dateFilter;
    }

    const attendanceRecords = await Attendance.find(filter).sort({ date: -1 });

    // Calculate statistics
    const stats = {
      totalRecords: attendanceRecords.length,
      statusBreakdown: {},
      totalWorkingHours: 0,
      averageWorkingHours: 0,
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      lateDays: 0,
      earlyArrivalDays: 0,
    };

    attendanceRecords.forEach((record) => {
      if (record.status) {
        stats.statusBreakdown[record.status] =
          (stats.statusBreakdown[record.status] || 0) + 1;

        // Count specific statuses
        if (record.status === "present") stats.presentDays++;
        if (record.status === "absent") stats.absentDays++;
        if (record.status === "half-day") stats.halfDays++;
        if (record.status === "late") stats.lateDays++;
        if (record.status === "early-arrival") stats.earlyArrivalDays++;
      }

      if (record.workingHours) {
        stats.totalWorkingHours += record.workingHours;
      }
    });

    if (attendanceRecords.length > 0) {
      stats.averageWorkingHours =
        stats.totalWorkingHours / attendanceRecords.length;
    }

    // Get salary information for the employee
    let salaryInfo = null;
    if (month) {
      const [year, monthNum] = month.split("-");
      const salary = await Salary.findOne({
        employee: employee._id,
        month: parseInt(monthNum),
        year: parseInt(year),
      });

      if (salary) {
        salaryInfo = {
          baseSalary: salary.baseSalary,
          workingDays: salary.workingDays,
          presentDays: salary.presentDays,
          absentDays: salary.absentDays,
          halfDays: salary.halfDays,
          lateDays: salary.lateDays,
          deductions: salary.deductions,
          netSalary: salary.netSalary,
          status: salary.status,
          calculatedAt: salary.calculatedAt,
        };
      }
    }

    res.status(200).json({
      success: true,
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        monthlySalary: employee.salary.monthlySalary,
      },
      statistics: stats,
      salaryInfo,
      records: attendanceRecords,
      filters: { startDate, endDate, month },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Generate monthly attendance summary
export const getMonthlyAttendanceSummary = async (req, res) => {
  try {
    const { month, departmentId } = req.query; // month format: YYYY-MM

    if (!month) {
      return res.status(400).json({
        success: false,
        message: "Month is required (format: YYYY-MM)",
      });
    }

    const [year, monthNum] = month.split("-");
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);

    let filter = {
      date: { $gte: startOfMonth, $lte: endOfMonth },
    };

    // Department filter
    if (departmentId) {
      const employees = await Employee.find({
        department: departmentId,
        isActive: true,
      });
      const employeeIds = employees.map((emp) => emp._id);
      filter.employee = { $in: employeeIds };
    }

    // Aggregate daily statistics
    const dailyStats = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
          totalPresent: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          totalAbsent: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          totalHalfDay: {
            $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] },
          },
          totalLate: {
            $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] },
          },
          totalEarlyArrival: {
            $sum: { $cond: [{ $eq: ["$status", "early-arrival"] }, 1, 0] },
          },
          totalWorkingHours: { $sum: "$workingHours" },
          totalRecords: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Overall month statistics
    const monthStats = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalPresent: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          totalAbsent: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          totalHalfDay: {
            $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] },
          },
          totalLate: {
            $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] },
          },
          totalEarlyArrival: {
            $sum: { $cond: [{ $eq: ["$status", "early-arrival"] }, 1, 0] },
          },
          totalWorkingHours: { $sum: "$workingHours" },
          averageWorkingHours: { $avg: "$workingHours" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      month,
      departmentId,
      monthSummary: monthStats[0] || {},
      dailyBreakdown: dailyStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Export attendance data (for CSV/Excel generation)
export const exportAttendanceData = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      month,
      departmentId,
      employeeId,
      status,
    } = req.query;

    let dateFilter = {};

    if (month) {
      const [year, monthNum] = month.split("-");
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);
      dateFilter.date = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    let filter = { ...dateFilter };

    if (employeeId) {
      const employee = await Employee.findOne({ employeeId });
      if (employee) filter.employee = employee._id;
    }

    if (status) filter.status = status;

    if (departmentId) {
      const employees = await Employee.find({
        department: departmentId,
        isActive: true,
      });
      const employeeIds = employees.map((emp) => emp._id);
      filter.employee = { $in: employeeIds };
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate({
        path: "employee",
        select: "name employeeId email department position",
        populate: { path: "department", select: "name code" },
      })
      .populate("user", "name userId email")
      .sort({ date: -1 });

    // Format data for export
    const exportData = attendanceRecords.map((record) => ({
      Date: record.date.toISOString().split("T")[0],
      EmployeeID: record.userId || "N/A",
      EmployeeName:
        record.employee?.name || record.user?.name || "N/A",
      Department: record.employee?.department?.name || "N/A",
      Position: record.employee?.position || "N/A",
      CheckIn: record.checkIn
        ? new Date(record.checkIn).toLocaleTimeString()
        : "N/A",
      CheckOut: record.checkOut
        ? new Date(record.checkOut).toLocaleTimeString()
        : "N/A",
      WorkingHours: record.workingHours?.toFixed(2) || "0",
      Status: record.status || "pending",
      ManualEntry: record.isManualEntry ? "Yes" : "No",
      Remarks: record.remarks || "",
    }));

    res.status(200).json({
      success: true,
      count: exportData.length,
      data: exportData,
      filters: { startDate, endDate, month, departmentId, employeeId, status },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
