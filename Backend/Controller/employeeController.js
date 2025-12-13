import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import Role from "../Model/Role.js";
import bcrypt from "bcrypt";

// Create employee
export const createEmployee = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      cnic,
      biometricId,
      department,
      additionalDepartments,
      leadingDepartments,
      position,
      salary,
      workSchedule,
      joiningDate,
      address,
      emergencyContact,
      password,
      isTeamLead,
      role,
    } = req.body;

    // Check if employee with email exists (only if email is provided)
    if (email) {
      const existingEmployee = await Employee.findOne({ email });
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: "Employee with this email already exists",
        });
      }
    }

    // Verify department exists
    const deptExists = await Department.findById(department);
    if (!deptExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid department",
      });
    }

    // Verify role exists (role is now required)
    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }
    
    const roleExists = await Role.findById(role);
    if (!roleExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
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

    // Prepare employee data, excluding empty optional fields
    const employeeData = {
      employeeId: newEmployeeId,
      name,
      department,
      position,
      role,
      salary,
      workSchedule,
      createdBy: req.user._id,
      isTeamLead: isTeamLead || false,
    };

    // Only add optional fields if they have values
    if (email && email.trim()) employeeData.email = email;
    if (phone && phone.trim()) employeeData.phone = phone;
    if (cnic && cnic.trim()) employeeData.cnic = cnic;
    if (biometricId && biometricId.trim()) employeeData.biometricId = biometricId;
    if (joiningDate) employeeData.joiningDate = joiningDate;
    if (address) employeeData.address = address;
    if (emergencyContact) employeeData.emergencyContact = emergencyContact;
    
    // Handle multiple departments
    if (additionalDepartments && additionalDepartments.length > 0) {
      employeeData.additionalDepartments = additionalDepartments.filter(d => d && d !== department);
    }
    
    // Handle leading departments
    if (leadingDepartments && leadingDepartments.length > 0) {
      employeeData.leadingDepartments = leadingDepartments;
      // Auto-set isTeamLead if leading any department
      employeeData.isTeamLead = true;
    }
    
    // Handle password: if provided use it, otherwise let pre-save hook generate default
    if (password && password.trim()) {
      employeeData.password = password;
    }

    const employee = await Employee.create(employeeData);

    const populatedEmployee = await Employee.findById(employee._id)
      .populate("department", "name code")
      .populate("additionalDepartments", "name code")
      .populate("leadingDepartments", "name code")
      .populate("role", "name description");

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

    // Get the superAdmin role ID to exclude superAdmin employees for non-superAdmin users
    const superAdminRole = await Role.findOne({ name: "superAdmin" });
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    
    // If the requesting user is NOT superAdmin, exclude superAdmin employees
    if (requestingUserRole !== "superAdmin" && superAdminRole) {
      filter.role = { $ne: superAdminRole._id };
    }

    // For teamLead role, only show employees from departments they lead
    if (requestingUserRole === "teamLead") {
      // Get the current user's employee record with leadingDepartments
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("leadingDepartments", "_id");
      
      if (currentEmployee && currentEmployee.leadingDepartments?.length > 0) {
        // Get the department IDs the team lead is leading
        const leadingDeptIds = currentEmployee.leadingDepartments.map(d => d._id);
        
        // Filter to only show employees whose primary or additional department is in the leading departments
        filter.$or = [
          { department: { $in: leadingDeptIds } },
          { additionalDepartments: { $in: leadingDeptIds } }
        ];
      } else {
        // If team lead has no leading departments, only show themselves
        filter._id = req.user._id;
      }
    }

    const employees = await Employee.find(filter)
      .populate("department", "name code")
      .populate("additionalDepartments", "name code")
      .populate("leadingDepartments", "name code")
      .populate("role", "name description")
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
      .populate("additionalDepartments", "name code")
      .populate("leadingDepartments", "name code")
      .populate("role", "name description")
      .populate("createdBy", "name")
      .populate("modifiedBy", "name");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Prevent non-superAdmin users from viewing superAdmin employees
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (employee.role?.name === "superAdmin" && requestingUserRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Cannot view superAdmin details.",
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
    // Check if trying to update a superAdmin employee
    const targetEmployee = await Employee.findById(req.params.id).populate("role", "name");
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Prevent non-superAdmin users from updating superAdmin employees
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (targetEmployee.role?.name === "superAdmin" && requestingUserRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Cannot modify superAdmin.",
      });
    }

    const updateData = { ...req.body, modifiedBy: req.user._id };
    delete updateData.employeeId; // Don't allow changing employee ID

    // Convert empty strings to undefined for unique sparse fields to avoid duplicate key errors
    if (updateData.email === '') updateData.email = undefined;
    if (updateData.phone === '') updateData.phone = undefined;
    if (updateData.cnic === '') updateData.cnic = undefined;
    if (updateData.biometricId === '') updateData.biometricId = undefined;
    
    // Handle additional departments - filter out primary department and empty values
    if (updateData.additionalDepartments) {
      updateData.additionalDepartments = updateData.additionalDepartments.filter(
        d => d && d !== updateData.department
      );
    }
    
    // Handle leading departments - auto-set isTeamLead
    if (updateData.leadingDepartments && updateData.leadingDepartments.length > 0) {
      updateData.isTeamLead = true;
    }
    
    // Handle password: hash if provided, otherwise remove from update
    if (updateData.password && updateData.password !== '') {
      // Hash the password before updating
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("department", "name code")
      .populate("additionalDepartments", "name code")
      .populate("leadingDepartments", "name code")
      .populate("role", "name description");

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
    // Check if trying to delete a superAdmin employee
    const targetEmployee = await Employee.findById(req.params.id).populate("role", "name");
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Prevent non-superAdmin users from deleting superAdmin employees
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (targetEmployee.role?.name === "superAdmin" && requestingUserRole !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Cannot delete superAdmin.",
      });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false, modifiedBy: req.user._id },
      { new: true }
    );

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
