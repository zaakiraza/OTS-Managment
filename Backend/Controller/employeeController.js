import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";

// Create employee
export const createEmployee = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      cnic,
      department,
      position,
      salary,
      workSchedule,
      joiningDate,
      address,
      emergencyContact,
    } = req.body;

    // Check if employee with email exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: "Employee with this email already exists",
      });
    }

    // Verify department exists
    const deptExists = await Department.findById(department);
    if (!deptExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid department",
      });
    }

    // Generate employee ID based on department code
    const deptCode = deptExists.code.substring(0, 3).toUpperCase();
    const lastEmployee = await Employee.findOne({
      employeeId: { $regex: `^${deptCode}` },
    })
      .sort({ employeeId: -1 })
      .limit(1);

    let newEmployeeId;
    if (lastEmployee) {
      const lastNumber = parseInt(lastEmployee.employeeId.replace(deptCode, ""));
      newEmployeeId = `${deptCode}${String(lastNumber + 1).padStart(4, "0")}`;
    } else {
      newEmployeeId = `${deptCode}0001`;
    }

    const employee = await Employee.create({
      employeeId: newEmployeeId,
      name,
      email,
      phone,
      cnic,
      department,
      position,
      salary,
      workSchedule,
      joiningDate,
      address,
      emergencyContact,
      createdBy: req.user._id,
    });

    const populatedEmployee = await Employee.findById(employee._id).populate(
      "department",
      "name code"
    );

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: populatedEmployee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all employees
export const getAllEmployees = async (req, res) => {
  try {
    const { department, isActive } = req.query;
    const filter = {};

    if (department) filter.department = department;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    else filter.isActive = true;

    const employees = await Employee.find(filter)
      .populate("department", "name code")
      .populate("createdBy", "name")
      .sort({ employeeId: 1 });

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get employee by ID
export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate("department", "name code description")
      .populate("createdBy", "name")
      .populate("modifiedBy", "name");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update employee
export const updateEmployee = async (req, res) => {
  try {
    const updateData = { ...req.body, modifiedBy: req.user._id };
    delete updateData.employeeId; // Don't allow changing employee ID

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate("department", "name code");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete employee (soft delete)
export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false, modifiedBy: req.user._id },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
