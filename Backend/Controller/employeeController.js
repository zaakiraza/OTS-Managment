import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import Role from "../Model/Role.js";
import bcrypt from "bcrypt";
import { notifyPasswordChanged } from "../Utils/emailNotifications.js";
import { logEmployeeAction } from "../Utils/auditLogger.js";

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

    // For attendanceDepartment role, restrict to user's own department
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (requestingUserRole === "attendanceDepartment") {
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("department", "_id");
      
      if (!currentEmployee || !currentEmployee.department) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You must be assigned to a department to create employees.",
        });
      }

      const userDeptId = currentEmployee.department._id || currentEmployee.department;
      const requestedDeptId = department.toString ? department.toString() : department;
      
      // Check if primary department matches user's department
      if (userDeptId.toString() !== requestedDeptId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only create employees in your own department.",
        });
      }

      // Also validate additional departments - they must be user's department or empty
      if (additionalDepartments && additionalDepartments.length > 0) {
        const invalidDepts = additionalDepartments.filter(
          dept => dept && dept.toString() !== userDeptId.toString()
        );
        if (invalidDepts.length > 0) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only assign employees to your own department.",
          });
        }
      }
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

    // Audit log
    await logEmployeeAction(req, "CREATE", populatedEmployee, {
      after: { name: populatedEmployee.name, employeeId: populatedEmployee.employeeId, department: populatedEmployee.department?.name }
    });

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

// Get all employees with pagination
export const getAllEmployees = async (req, res) => {
  try {
    const { 
      department, 
      isActive, 
      page = 1, 
      limit = 50, 
      search,
      sortBy = "employeeId",
      sortOrder = "asc",
      noPagination // If true, returns all results (for dropdowns)
    } = req.query;
    
    const filter = {};

    if (department) filter.department = department;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    else filter.isActive = true;

    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Get the superAdmin role ID to exclude superAdmin employees for non-superAdmin users
    const superAdminRole = await Role.findOne({ name: "superAdmin" });
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    
    // If the requesting user is NOT superAdmin, exclude superAdmin employees
    if (requestingUserRole !== "superAdmin" && superAdminRole) {
      filter.role = { $ne: superAdminRole._id };
    }

    // For attendanceDepartment role, only show employees from their own department
    if (requestingUserRole === "attendanceDepartment") {
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("department", "_id");
      
      if (currentEmployee && currentEmployee.department) {
        const userDeptId = currentEmployee.department._id || currentEmployee.department;
        
        // Only show employees from the user's department
        const deptFilter = {
          $or: [
            { department: userDeptId },
            { additionalDepartments: userDeptId }
          ]
        };
        
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, deptFilter];
          delete filter.$or;
        } else {
          filter.$or = deptFilter.$or;
        }
      } else {
        // If user has no department, show nothing
        filter._id = null; // This will return no results
      }
    }

    // For teamLead role, only show employees from departments they lead
    if (requestingUserRole === "teamLead") {
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("leadingDepartments", "_id");
      
      if (currentEmployee && currentEmployee.leadingDepartments?.length > 0) {
        const leadingDeptIds = currentEmployee.leadingDepartments.map(d => d._id);
        
        // Use $and to combine with existing $or from search
        const deptFilter = {
          $or: [
            { department: { $in: leadingDeptIds } },
            { additionalDepartments: { $in: leadingDeptIds } }
          ]
        };
        
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, deptFilter];
          delete filter.$or;
        } else {
          filter.$or = deptFilter.$or;
        }
      } else {
        filter._id = req.user._id;
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // If noPagination is true, return all results
    if (noPagination === "true") {
      const employees = await Employee.find(filter)
        .populate("department", "name code")
        .populate("additionalDepartments", "name code")
        .populate("leadingDepartments", "name code")
        .populate("role", "name description")
        .populate("createdBy", "name")
        .sort(sort);

      return res.status(200).json({
        success: true,
        count: employees.length,
        data: employees,
      });
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate("department", "name code")
        .populate("additionalDepartments", "name code")
        .populate("leadingDepartments", "name code")
        .populate("role", "name description")
        .populate("createdBy", "name")
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Employee.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: employees.length,
      total,
      data: employees,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
      },
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

    // For attendanceDepartment role, only allow viewing employees from their own department
    if (requestingUserRole === "attendanceDepartment") {
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("department", "_id");
      
      if (!currentEmployee || !currentEmployee.department) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You must be assigned to a department.",
        });
      }

      const userDeptId = currentEmployee.department._id || currentEmployee.department;
      const empDeptId = employee.department?._id || employee.department;
      const isInAdditionalDepts = employee.additionalDepartments?.some(
        dept => (dept._id || dept).toString() === userDeptId.toString()
      );

      if (empDeptId?.toString() !== userDeptId.toString() && !isInAdditionalDepts) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view employees from your own department.",
        });
      }
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
    const targetEmployee = await Employee.findById(req.params.id)
      .populate("role", "name")
      .populate("department", "_id")
      .populate("additionalDepartments", "_id");
    
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

    // For attendanceDepartment role, only allow updating employees from their own department
    if (requestingUserRole === "attendanceDepartment") {
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("department", "_id");
      
      if (!currentEmployee || !currentEmployee.department) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You must be assigned to a department.",
        });
      }

      const userDeptId = currentEmployee.department._id || currentEmployee.department;
      const empDeptId = targetEmployee.department?._id || targetEmployee.department;
      const isInAdditionalDepts = targetEmployee.additionalDepartments?.some(
        dept => (dept._id || dept).toString() === userDeptId.toString()
      );

      if (empDeptId?.toString() !== userDeptId.toString() && !isInAdditionalDepts) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only edit employees from your own department.",
        });
      }

      // Also prevent changing department to a different one
      if (req.body.department && req.body.department.toString() !== userDeptId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You cannot change employee's department to a different department.",
        });
      }

      // Prevent adding additional departments that are not user's department
      if (req.body.additionalDepartments) {
        const invalidDepts = req.body.additionalDepartments.filter(
          dept => dept && dept.toString() !== userDeptId.toString()
        );
        if (invalidDepts.length > 0) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only assign employees to your own department.",
          });
        }
      }
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
    const passwordChanged = !!(updateData.password && updateData.password !== '');
    if (passwordChanged) {
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

    // Send email notification if password was changed
    if (passwordChanged && employee.email) {
      notifyPasswordChanged(employee).catch(err => {
        console.error("Failed to send password change notification:", err.message);
      });
    }

    // Audit log
    const changes = {
      before: { name: targetEmployee.name, department: targetEmployee.department?.name },
      after: { name: employee.name, department: employee.department?.name }
    };
    if (passwordChanged) {
      changes.passwordChanged = true;
    }
    await logEmployeeAction(req, "UPDATE", employee, changes);

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
    const targetEmployee = await Employee.findById(req.params.id)
      .populate("role", "name")
      .populate("department", "_id")
      .populate("additionalDepartments", "_id");
    
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

    // For attendanceDepartment role, only allow deleting employees from their own department
    if (requestingUserRole === "attendanceDepartment") {
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("department", "_id");
      
      if (!currentEmployee || !currentEmployee.department) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You must be assigned to a department.",
        });
      }

      const userDeptId = currentEmployee.department._id || currentEmployee.department;
      const empDeptId = targetEmployee.department?._id || targetEmployee.department;
      const isInAdditionalDepts = targetEmployee.additionalDepartments?.some(
        dept => (dept._id || dept).toString() === userDeptId.toString()
      );

      if (empDeptId?.toString() !== userDeptId.toString() && !isInAdditionalDepts) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only delete employees from your own department.",
        });
      }
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false, modifiedBy: req.user._id },
      { new: true }
    );

    // Audit log
    await logEmployeeAction(req, "DELETE", targetEmployee, {
      before: { name: targetEmployee.name, employeeId: targetEmployee.employeeId, isActive: true },
      after: { isActive: false }
    });

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
