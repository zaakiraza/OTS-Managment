import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import Role from "../Model/Role.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import ExcelJS from "exceljs";
import { notifyPasswordChanged, notifyEmployeeCreated } from "../Utils/emailNotifications.js";
import { logEmployeeAction } from "../Utils/auditLogger.js";
import { createNotification, createBulkNotifications } from "./notificationController.js";

// Helper to get superAdmin IDs
const getSuperAdminIds = async () => {
  const superAdminRole = await Role.findOne({ name: "superAdmin" });
  if (!superAdminRole) return [];
  const admins = await Employee.find({ role: superAdminRole._id, isActive: true }).select("_id");
  return admins.map((a) => a._id);
};

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

    // For attendanceDepartment role, restrict to user's own department and its sub-departments
    // OR departments they created
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    if (requestingUserRole === "attendanceDepartment") {
      // Try to get department from req.user first (populated by middleware)
      let userDepartment = req.user.department;
      
      // If department is not populated or is just an ObjectId, fetch the employee with department
      if (!userDepartment || !userDepartment._id) {
        const currentEmployee = await Employee.findById(req.user._id)
          .populate("department", "_id name code");
        
        if (!currentEmployee) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Employee record not found.",
          });
        }
        
        userDepartment = currentEmployee.department;
      }
      
      const requestedDeptId = String(department.toString ? department.toString() : department);
      
      // Check if requested department exists
      const requestedDept = await Department.findById(requestedDeptId);
      if (!requestedDept) {
        return res.status(400).json({
          success: false,
          message: "Invalid department",
        });
      }
      
      // Check if user created this department
      const userCreatedDept = String(requestedDept.createdBy) === String(req.user._id);
      
      // If user has an assigned department, check if requested dept is their dept or sub-dept
      if (userDepartment && userDepartment._id) {
        const userDeptId = String(userDepartment._id || userDepartment);
        const requestedParentId = requestedDept.parentDepartment 
          ? String(requestedDept.parentDepartment._id || requestedDept.parentDepartment) 
          : null;
        const requestedPath = requestedDept.path || "";
        
        // Allow if:
        // - User created this department, OR
        // - It's the user's assigned department, OR
        // - It's a direct child of user's department, OR
        // - It's a nested child (path contains user's department ID)
        const isAllowed = userCreatedDept ||
                         requestedDeptId === userDeptId || 
                         requestedParentId === userDeptId || 
                         requestedPath.includes(userDeptId);
        
        if (!isAllowed) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only create employees in your assigned department, its sub-departments, or departments you created.",
          });
        }
      } else {
        // If user doesn't have an assigned department, only allow departments they created
        if (!userCreatedDept) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only create employees in departments you created. Please contact your administrator to assign you to a department for additional access.",
          });
        }
      }

      // Also validate additional departments - they must be user's department or sub-departments
      if (additionalDepartments && additionalDepartments.length > 0) {
        const invalidDepts = [];
        for (const deptId of additionalDepartments) {
          if (!deptId) continue;
          const addDeptId = String(deptId);
          const addDept = await Department.findById(addDeptId);
          if (!addDept) {
            invalidDepts.push(deptId);
            continue;
          }
          
          const addDeptParentId = addDept.parentDepartment 
            ? String(addDept.parentDepartment._id || addDept.parentDepartment) 
            : null;
          const addDeptPath = addDept.path || "";
          
          const isAllowed = addDeptId === userDeptId || 
                           addDeptParentId === userDeptId || 
                           addDeptPath.includes(userDeptId);
          
          if (!isAllowed) {
            invalidDepts.push(deptId);
          }
        }
        
        if (invalidDepts.length > 0) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only assign employees to your own department or its sub-departments.",
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
    // Capture plain password before hashing (needed for email notification)
    let plainPassword = password && password.trim() ? password : null;
    
    if (plainPassword) {
      employeeData.password = plainPassword;
    } else {
      // If no password provided, pre-save hook will generate: Emp@{last4digits}
      // We need to generate it here too so we can send it in the email
      const last4 = newEmployeeId.slice(-4);
      plainPassword = `Emp@${last4}`;
      // Don't set password - pre-save hook will generate it for new documents
      // The hook checks this.isNew, so it will run for new employees
    }

    const employee = await Employee.create(employeeData);

    const populatedEmployee = await Employee.findById(employee._id)
      .populate("department", "name code")
      .populate("additionalDepartments", "name code")
      .populate("leadingDepartments", "name code")
      .populate("role", "name description");

    // Send email notification if email is provided
    if (populatedEmployee.email) {
      console.log(`[Employee Created] Attempting to send welcome email to: ${populatedEmployee.email}`);
      notifyEmployeeCreated(populatedEmployee.email, {
        name: populatedEmployee.name,
        email: populatedEmployee.email,
        employeeId: populatedEmployee.employeeId,
        department: populatedEmployee.department?.name || "N/A",
        tempPassword: plainPassword,
      })
      .then((result) => {
        if (result.success) {
          console.log(`[Employee Created] Welcome email sent successfully to ${populatedEmployee.email}. Message ID: ${result.messageId}`);
        } else {
          console.error(`[Employee Created] Failed to send email to ${populatedEmployee.email}:`, result.error);
        }
      })
      .catch((err) => {
        console.error(`[Employee Created] Error sending email to ${populatedEmployee.email}:`, err);
        // Don't fail the request if email fails
      });
    } else {
      console.log(`[Employee Created] No email provided for employee ${populatedEmployee.employeeId} (${populatedEmployee.name}). Skipping email notification.`);
    }

    // Audit log
    await logEmployeeAction(req, "CREATE", populatedEmployee, {
      after: { name: populatedEmployee.name, employeeId: populatedEmployee.employeeId, department: populatedEmployee.department?.name }
    });

    // Notify superAdmin about new employee
    try {
      const superAdminIds = await getSuperAdminIds();
      if (superAdminIds.length > 0 && req.user.role?.name !== "superAdmin") {
        await createBulkNotifications({
          recipients: superAdminIds,
          type: "general",
          title: "New Employee Created",
          message: `${req.user.name} created a new employee: ${populatedEmployee.name} (${populatedEmployee.employeeId})`,
          referenceId: populatedEmployee._id,
          referenceType: "Employee",
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating employee notification:", notifError);
    }

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

    // For attendanceDepartment role, show employees from departments they created or manage
    if (requestingUserRole === "attendanceDepartment") {
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("department", "_id");
      
      // Find all departments the user has access to (same logic as department filtering)
      const allDepts = await Department.find({ isActive: true });
      const allowedDeptIds = new Set();
      
      const userDeptId = currentEmployee?.department?._id || currentEmployee?.department;
      
      allDepts.forEach(dept => {
        const deptId = String(dept._id);
        const createdBy = String(dept.createdBy);
        const parentId = dept.parentDepartment 
          ? String(dept.parentDepartment._id || dept.parentDepartment) 
          : null;
        const deptPath = dept.path || "";
        
        // Include if:
        // - Created by user
        // - It's the assigned department (if user has one)
        // - It's a sub-department of assigned department
        if (createdBy === String(req.user._id) ||
            (userDeptId && (deptId === String(userDeptId) ||
                           parentId === String(userDeptId) ||
                           deptPath.includes(String(userDeptId))))) {
          allowedDeptIds.add(deptId);
        }
      });
      
      if (allowedDeptIds.size > 0) {
        // Show employees from allowed departments
        const allowedDeptObjectIds = Array.from(allowedDeptIds).map(id => new mongoose.Types.ObjectId(id));
        const deptFilter = {
          $or: [
            { department: { $in: allowedDeptObjectIds } },
            { additionalDepartments: { $in: allowedDeptObjectIds } }
          ]
        };
        
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, deptFilter];
          delete filter.$or;
        } else {
          filter.$or = deptFilter.$or;
        }
      } else {
        // If user has no accessible departments, show nothing
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

      // Get all departments created by the user
      const userCreatedDepts = await Department.find({
        createdBy: req.user._id,
        isActive: true
      });
      const userCreatedDeptIds = new Set(userCreatedDepts.map(d => d._id.toString()));

      // Check if employee is from a department the user created
      const empDeptIdStr = empDeptId?.toString();
      const isFromUserDept = userCreatedDeptIds.has(empDeptIdStr) || 
                             empDeptIdStr === userDeptId.toString();
      
      const isInUserAdditionalDepts = targetEmployee.additionalDepartments?.some(
        dept => userCreatedDeptIds.has((dept._id || dept).toString())
      ) || isInAdditionalDepts;

      if (!isFromUserDept && !isInUserAdditionalDepts) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only edit employees from departments you created.",
        });
      }

      // If changing department, verify the new department was also created by the user
      if (req.body.department) {
        const newDeptIdStr = req.body.department.toString();
        if (!userCreatedDeptIds.has(newDeptIdStr) && newDeptIdStr !== userDeptId.toString()) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only assign employees to departments you created.",
          });
        }
      }

      // Verify additional departments are also created by the user
      if (req.body.additionalDepartments) {
        const invalidDepts = req.body.additionalDepartments.filter(
          dept => dept && !userCreatedDeptIds.has(dept.toString()) && dept.toString() !== userDeptId.toString()
        );
        if (invalidDepts.length > 0) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only assign employees to departments you created.",
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

    // Notify the employee and superAdmin about the update
    try {
      const recipients = [];
      
      // Notify the employee if not updating self
      if (employee._id.toString() !== req.user._id.toString()) {
        recipients.push(employee._id);
      }
      
      // Notify superAdmin if requester is not superAdmin
      if (req.user.role?.name !== "superAdmin") {
        const superAdminIds = await getSuperAdminIds();
        recipients.push(...superAdminIds);
      }
      
      if (recipients.length > 0) {
        await createBulkNotifications({
          recipients,
          type: "general",
          title: "Employee Profile Updated",
          message: `${req.user.name} updated ${employee.name}'s profile${passwordChanged ? " (password changed)" : ""}`,
          referenceId: employee._id,
          referenceType: "Employee",
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating employee update notification:", notifError);
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

// Download Excel template for employee import
export const downloadEmployeeTemplate = async (req, res) => {
  try {
    // Fetch departments and roles for dropdowns
    const departments = await Department.find({ isActive: true }).sort({ code: 1 });
    const roles = await Role.find({ 
      isActive: true,
      name: { $in: ["teamLead", "employee"] } // Only allow teamLead and employee
    }).sort({ name: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Employees");

    // Define columns with clear required/optional labels
    worksheet.columns = [
      { header: "Name *", key: "name", width: 25 },
      { header: "Email*", key: "email", width: 30 },
      { header: "Phone (Optional)", key: "phone", width: 22 },
      { header: "CNIC (Optional) - Format: XXXXX-XXXXXXX-X", key: "cnic", width: 47 },
      { header: "Biometric ID - Format: 1,5,13", key: "biometricId", width: 40 },
      { header: "Department Code * (for OTS School:SCH, Morning School: MSCH, Evening School:ESCH, Primary School:PSCH, Secondary School:SSCH)", key: "departmentCode", width: 32 },
      { header: "Position *", key: "position", width: 25 },
      { header: "Role Name *(employee in All)", key: "roleName", width: 30 },
      { header: "Monthly Salary (Optional)", key: "monthlySalary", width: 31 },
      { header: "Check In Time*", key: "checkInTime", width: 37 },
      { header: "Check Out Time*", key: "checkOutTime", width: 37 },
      { header: "Working Days Per Week*", key: "workingDaysPerWeek", width: 28 },
      { header: "Working Hours Per Week*", key: "workingHoursPerWeek", width: 28 },
      { header: "Weekly Offs (Optional) - Format: Saturday,Sunday", key: "weeklyOffs", width: 47 },
      { header: "Joining Date (Optional) - Format: YYYY-MM-DD", key: "joiningDate", width: 47 },
      { header: "Is Team Lead (Optional) - false in all", key: "isTeamLead", width: 35 },
      { header: "Monday Check-In (Optional)", key: "mondayCheckIn", width: 30 },
      { header: "Monday Check-Out (Optional)", key: "mondayCheckOut", width: 30 },
      { header: "Tuesday Check-In (Optional)", key: "tuesdayCheckIn", width: 30 },
      { header: "Tuesday Check-Out (Optional)", key: "tuesdayCheckOut", width: 30 },
      { header: "Wednesday Check-In (Optional)", key: "wednesdayCheckIn", width: 30 },
      { header: "Wednesday Check-Out (Optional)", key: "wednesdayCheckOut", width: 30 },
      { header: "Thursday Check-In (Optional)", key: "thursdayCheckIn", width: 30 },
      { header: "Thursday Check-Out (Optional)", key: "thursdayCheckOut", width: 30 },
      { header: "Friday Check-In (Optional)", key: "fridayCheckIn", width: 30 },
      { header: "Friday Check-Out (Optional)", key: "fridayCheckOut", width: 30 },
      { header: "Saturday Check-In (Optional)", key: "saturdayCheckIn", width: 30 },
      { header: "Saturday Check-Out (Optional)", key: "saturdayCheckOut", width: 30 },
      { header: "Sunday Check-In (Optional)", key: "sundayCheckIn", width: 30 },
      { header: "Sunday Check-Out (Optional)", key: "sundayCheckOut", width: 30 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF093635" },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 25;

    // Add instructions row
    const instructionRow = worksheet.addRow([]);
    instructionRow.height = 40;
    instructionRow.getCell(1).value = "Instructions:";
    instructionRow.getCell(1).font = { bold: true, color: { argb: "FF093635" } };
    worksheet.mergeCells(`A2:${String.fromCharCode(64 + worksheet.columnCount)}2`);
    instructionRow.getCell(1).value = "Instructions: Fields marked with * are required. Optional fields can be left empty. Use dropdowns for Department Code and Role Name. Biometric ID should be comma-separated numbers (e.g., 1,5,13). CNIC format: XXXXX-XXXXXXX-X";
    instructionRow.getCell(1).alignment = { vertical: "middle", wrapText: true };
    instructionRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F9FF" },
    };

    // Add department codes list in a separate sheet
    const deptSheet = workbook.addWorksheet("Department Codes");
    deptSheet.columns = [
      { header: "Department Code", key: "code", width: 20 },
      { header: "Department Name", key: "name", width: 30 },
    ];
    deptSheet.getRow(1).font = { bold: true };
    deptSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF093635" },
    };
    deptSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    
    departments.forEach(dept => {
      deptSheet.addRow({
        code: dept.code,
        name: dept.name,
      });
    });

    // Add role names list in a separate sheet
    const roleSheet = workbook.addWorksheet("Role Names");
    roleSheet.columns = [
      { header: "Role Name", key: "name", width: 20 },
      { header: "Description", key: "description", width: 40 },
    ];
    roleSheet.getRow(1).font = { bold: true };
    roleSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF093635" },
    };
    roleSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    
    roles.forEach(role => {
      roleSheet.addRow({
        name: role.name,
        description: role.description || "",
      });
    });

    // Create named ranges for data validation
    const deptCodes = departments.map(d => d.code);
    const roleNames = roles.map(r => r.name);

    // Add data validation for Department Code column (column F = 6)
    worksheet.getColumn(6).eachCell((cell, rowNumber) => {
      if (rowNumber > 2) { // Skip header and instruction rows
        cell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${deptCodes.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Department Code',
          error: `Please select a valid department code from the list. See "Department Codes" sheet for available codes.`,
        };
      }
    });

    // Add data validation for Role Name column (column H = 8)
    worksheet.getColumn(8).eachCell((cell, rowNumber) => {
      if (rowNumber > 2) { // Skip header and instruction rows
        cell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${roleNames.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid Role Name',
          error: `Please select either "teamLead" or "employee" (case-sensitive).`,
        };
      }
    });

    // Add data validation for Is Team Lead column (column P = 16)
    worksheet.getColumn(16).eachCell((cell, rowNumber) => {
      if (rowNumber > 2) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"true,false"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Value',
          error: 'Please enter either "true" or "false"',
        };
      }
    });

    // Add example row
    const exampleRow = worksheet.addRow({
      name: "Raza",
      email: "raza@example.com",
      phone: "+923001234567",
      cnic: "12345-1234567-1",
      biometricId: "2",
      departmentCode: departments.length > 0 ? departments[0].code : "ESCH",
      position: "Developer",
      roleName: "employee",
      monthlySalary: "10000",
      checkInTime: "09:00",
      checkOutTime: "17:00",
      workingDaysPerWeek: "5",
      workingHoursPerWeek: "40",
      weeklyOffs: "Saturday,Sunday",
      joiningDate: "2026-01-01",
      isTeamLead: "false",
      fridayCheckIn: "09:00",
      fridayCheckOut: "13:00",
    });

    // Style example row (light gray background)
    exampleRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
      };
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=employee_import_template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Import employees from Excel file
export const importEmployees = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.getWorksheet(1); // Get first worksheet

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty or invalid",
      });
    }

    const results = {
      success: [],
      failed: [],
      total: 0,
    };

    // Get all departments and roles for lookup
    const departments = await Department.find({ isActive: true });
    const roles = await Role.find({ 
      isActive: true,
      name: { $in: ["teamLead", "employee"] } // Only allow teamLead and employee
    });
    const deptMap = new Map(departments.map(d => [d.code.toUpperCase(), d]));
    const roleMap = new Map(roles.map(r => [r.name, r])); // Use exact case for role names

    // Helper function to extract time from Excel cells (handles both string and Date objects)
    const extractTime = (cellValue) => {
      if (!cellValue) return null;
      
      // If it's a Date object (Excel time format) - use UTC to avoid timezone issues
      if (cellValue instanceof Date) {
        const hours = cellValue.getUTCHours().toString().padStart(2, '0');
        const minutes = cellValue.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      }
      
      // If it's already a string
      if (typeof cellValue === 'string') {
        const timeStr = cellValue.trim();
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
          const [h, m] = timeStr.split(':');
          return `${h.padStart(2, '0')}:${m}`;
        }
      }
      
      // Try to convert to string and parse
      const timeStr = cellValue.toString().trim();
      if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
        const [h, m] = timeStr.split(':');
        return `${h.padStart(2, '0')}:${m}`;
      }
      
      return null;
    };

    // Get user's department for validation (if attendanceDepartment)
    const requestingUserRole = req.user?.role?.name || req.user?.role;
    let userDepartment = req.user.department;
    
    if (requestingUserRole === "attendanceDepartment") {
      if (!userDepartment || !userDepartment._id) {
        const currentEmployee = await Employee.findById(req.user._id)
          .populate("department", "_id name code");
        userDepartment = currentEmployee?.department;
      }
    }

    // Process rows (skip header row 1 and instruction row 2, start from row 3)
    for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      // Skip empty rows
      if (!row.getCell(1).value) {
        continue;
      }

      results.total++;

      try {
        // Extract data from row
        const name = row.getCell(1).value?.toString().trim();
        const email = row.getCell(2).value?.toString().trim() || null;
        const phone = row.getCell(3).value?.toString().trim() || null;
        const cnic = row.getCell(4).value?.toString().trim() || null;
        let biometricId = row.getCell(5).value?.toString().trim() || null;
        const departmentCode = row.getCell(6).value?.toString().trim().toUpperCase();
        const position = row.getCell(7).value?.toString().trim() || "";
        const roleName = row.getCell(8).value?.toString().trim(); // Keep original case for validation
        const monthlySalary = row.getCell(9).value?.toString().trim() || null;
        const checkInTime = extractTime(row.getCell(10).value) || "09:00";
        const checkOutTime = extractTime(row.getCell(11).value) || "17:00";
        const workingDaysPerWeek = parseInt(row.getCell(12).value) || 5;
        const workingHoursPerWeek = parseInt(row.getCell(13).value) || 40;
        const weeklyOffsStr = row.getCell(14).value?.toString().trim() || "";
        const joiningDate = row.getCell(15).value?.toString().trim() || null;
        const isTeamLead = row.getCell(16).value?.toString().toLowerCase() === "true";
        const mondayCheckIn = extractTime(row.getCell(17).value) || null;
        const mondayCheckOut = extractTime(row.getCell(18).value) || null;
        const tuesdayCheckIn = extractTime(row.getCell(19).value) || null;
        const tuesdayCheckOut = extractTime(row.getCell(20).value) || null;
        const wednesdayCheckIn = extractTime(row.getCell(21).value) || null;
        const wednesdayCheckOut = extractTime(row.getCell(22).value) || null;
        const thursdayCheckIn = extractTime(row.getCell(23).value) || null;
        const thursdayCheckOut = extractTime(row.getCell(24).value) || null;
        const fridayCheckIn = extractTime(row.getCell(25).value) || null;
        const fridayCheckOut = extractTime(row.getCell(26).value) || null;
        const saturdayCheckIn = extractTime(row.getCell(27).value) || null;
        const saturdayCheckOut = extractTime(row.getCell(28).value) || null;
        const sundayCheckIn = extractTime(row.getCell(29).value) || null;
        const sundayCheckOut = extractTime(row.getCell(30).value) || null;

        // Validation
        if (!name) {
          throw new Error("Name is required");
        }

        if (!departmentCode) {
          throw new Error("Department code is required");
        }

        const department = deptMap.get(departmentCode);
        if (!department) {
          const availableCodes = Array.from(deptMap.keys()).join(", ");
          throw new Error(`Department with code "${departmentCode}" not found. Available codes: ${availableCodes || "None"}`);
        }

        // Validate department access for attendanceDepartment users
        if (requestingUserRole === "attendanceDepartment") {
          const requestedDeptId = String(department._id);
          const userCreatedDept = String(department.createdBy) === String(req.user._id);
          
          if (userDepartment && userDepartment._id) {
            const userDeptId = String(userDepartment._id || userDepartment);
            const requestedParentId = department.parentDepartment 
              ? String(department.parentDepartment._id || department.parentDepartment) 
              : null;
            const requestedPath = department.path || "";
            
            const isAllowed = userCreatedDept ||
                             requestedDeptId === userDeptId || 
                             requestedParentId === userDeptId || 
                             requestedPath.includes(userDeptId);
            
            if (!isAllowed) {
              throw new Error(`Access denied. You cannot create employees in department "${departmentCode}"`);
            }
          } else if (!userCreatedDept) {
            throw new Error(`Access denied. You cannot create employees in department "${departmentCode}"`);
          }
        }

        if (!roleName) {
          throw new Error("Role name is required");
        }

        // Validate role name is exactly "teamLead" or "employee" (case-sensitive)
        if (roleName !== "teamLead" && roleName !== "employee") {
          throw new Error(`Invalid role name "${roleName}". Must be exactly "teamLead" or "employee" (case-sensitive).`);
        }

        const role = roleMap.get(roleName);
        if (!role) {
          throw new Error(`Role "${roleName}" not found in database. Available roles: teamLead, employee`);
        }

        // Check if employee with email already exists
        if (email) {
          const existingEmployee = await Employee.findOne({ email });
          if (existingEmployee) {
            throw new Error(`Employee with email "${email}" already exists`);
          }
        }

        // Generate employee ID
        const deptCode = department.code.substring(0, 3).toUpperCase();
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

        // Parse weekly offs - filter out invalid values and default to Saturday,Sunday if empty
        let weeklyOffs = ["Saturday", "Sunday"]; // Default
        if (weeklyOffsStr && weeklyOffsStr.length > 0) {
          const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          const parsedDays = weeklyOffsStr.split(",").map(day => day.trim()).filter(day => validDays.includes(day));
          if (parsedDays.length > 0) {
            weeklyOffs = parsedDays;
          }
        }

        // Prepare employee data
        const employeeData = {
          employeeId: newEmployeeId,
          name,
          department: department._id,
          position,
          role: role._id,
          salary: {
            monthlySalary: monthlySalary ? parseFloat(monthlySalary) : null,
            currency: "PKR",
            leaveThreshold: 0,
          },
          workSchedule: {
            checkInTime,
            checkOutTime,
            workingDaysPerWeek,
            weeklyOffs,
            workingHoursPerWeek,
            daySchedules: {},
          },
          createdBy: req.user._id,
          isTeamLead,
        };

        // Add day-specific schedules if provided (only if both check-in and check-out are specified)
        const daySchedules = {};
        
        if (mondayCheckIn && mondayCheckOut) {
          daySchedules.Monday = {
            checkInTime: mondayCheckIn,
            checkOutTime: mondayCheckOut,
            isHalfDay: false,
            isOff: false
          };
        }
        
        if (tuesdayCheckIn && tuesdayCheckOut) {
          daySchedules.Tuesday = {
            checkInTime: tuesdayCheckIn,
            checkOutTime: tuesdayCheckOut,
            isHalfDay: false,
            isOff: false
          };
        }
        
        if (wednesdayCheckIn && wednesdayCheckOut) {
          daySchedules.Wednesday = {
            checkInTime: wednesdayCheckIn,
            checkOutTime: wednesdayCheckOut,
            isHalfDay: false,
            isOff: false
          };
        }
        
        if (thursdayCheckIn && thursdayCheckOut) {
          daySchedules.Thursday = {
            checkInTime: thursdayCheckIn,
            checkOutTime: thursdayCheckOut,
            isHalfDay: false,
            isOff: false
          };
        }
        
        if (fridayCheckIn && fridayCheckOut) {
          daySchedules.Friday = {
            checkInTime: fridayCheckIn,
            checkOutTime: fridayCheckOut,
            isHalfDay: false,
            isOff: false
          };
        }
        
        if (saturdayCheckIn && saturdayCheckOut) {
          daySchedules.Saturday = {
            checkInTime: saturdayCheckIn,
            checkOutTime: saturdayCheckOut,
            isHalfDay: false,
            isOff: false
          };
        }
        
        if (sundayCheckIn && sundayCheckOut) {
          daySchedules.Sunday = {
            checkInTime: sundayCheckIn,
            checkOutTime: sundayCheckOut,
            isHalfDay: false,
            isOff: false
          };
        }
        
        // Only add daySchedules to workSchedule if at least one day has custom schedule
        if (Object.keys(daySchedules).length > 0) {
          employeeData.workSchedule.daySchedules = daySchedules;
        }

        if (email) employeeData.email = email;
        if (phone) employeeData.phone = phone;
        if (cnic) {
          // Validate CNIC format: XXXXX-XXXXXXX-X
          if (!/^\d{5}-\d{7}-\d{1}$/.test(cnic)) {
            throw new Error(`Invalid CNIC format "${cnic}". Use format: XXXXX-XXXXXXX-X`);
          }
          employeeData.cnic = cnic;
        }
        if (biometricId) {
          // Validate biometric ID format: comma-separated numbers (e.g., 1,5,13)
          const bioIds = biometricId.split(',').map(id => id.trim());
          const isValidFormat = bioIds.every(id => /^\d+$/.test(id));
          if (!isValidFormat) {
            throw new Error(`Invalid Biometric ID format "${biometricId}". Use comma-separated numbers (e.g., 1,5,13)`);
          }
          // Store as comma-separated string
          employeeData.biometricId = bioIds.join(',');
        }
        if (joiningDate) {
          // Validate date format
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(joiningDate)) {
            throw new Error(`Invalid joining date format "${joiningDate}". Use format: YYYY-MM-DD`);
          }
          employeeData.joiningDate = joiningDate;
        }

        // Password will be auto-generated by the Employee model's pre-save hook (Emp@{last4digits})

        // Create employee
        const employee = await Employee.create(employeeData);

        const populatedEmployee = await Employee.findById(employee._id)
          .populate("department", "name code")
          .populate("role", "name description");

        // Send email notification (async, don't wait)
        if (populatedEmployee.email) {
          notifyEmployeeCreated(populatedEmployee.email, {
            name: populatedEmployee.name,
            email: populatedEmployee.email,
            employeeId: populatedEmployee.employeeId,
            department: populatedEmployee.department?.name || "N/A",
            tempPassword: plainPassword,
          }).catch((err) => {
            console.error(`Failed to send email to ${populatedEmployee.email}:`, err);
          });
        }

        // Audit log
        await logEmployeeAction(req, "CREATE", populatedEmployee, {
          after: { name: populatedEmployee.name, employeeId: populatedEmployee.employeeId, department: populatedEmployee.department?.name }
        });

        results.success.push({
          row: rowNumber,
          employeeId: newEmployeeId,
          name,
          email: email || "N/A",
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          name: row.getCell(1).value?.toString() || "Unknown",
          error: error.message,
        });
      }
    }

    // Delete uploaded file
    const fs = await import("fs");
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(200).json({
      success: true,
      message: `Import completed. ${results.success.length} employees created successfully, ${results.failed.length} failed.`,
      data: {
        total: results.total,
        successful: results.success.length,
        failed: results.failed.length,
        details: {
          success: results.success,
          failed: results.failed,
        },
      },
    });
  } catch (error) {
    // Delete uploaded file on error
    if (req.file && req.file.path) {
      const fs = await import("fs");
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
