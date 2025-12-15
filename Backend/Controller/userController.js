/**
 * User Controller - Creates Employee records for system users
 * 
 * NOTE: This controller now creates Employee records instead of User records.
 * The User model is deprecated - all authentication uses Employee model.
 * This change ensures users created via /api/users can actually log in.
 */

import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import Role from "../Model/Role.js";
import { SECURITY } from "../Config/constants.js";
import { notifyPasswordChanged } from "../Utils/emailNotifications.js";

/**
 * Generate a unique employee ID based on role
 * Format: {ROLE_PREFIX}{NUMBER} e.g., SADM001, ATTN001
 */
const generateEmployeeId = async (roleName) => {
  const prefixMap = {
    superAdmin: "SADM",
    attendanceDepartment: "ATTN",
    ITAssetManager: "ITAM",
    teamLead: "LEAD",
    employee: "EMP",
  };

  const prefix = prefixMap[roleName] || "USR";

  // Find the last employee with this prefix
  const lastEmployee = await Employee.findOne({
    employeeId: { $regex: `^${prefix}` },
  })
    .sort({ employeeId: -1 })
    .limit(1);

  let newNumber = 1;
  if (lastEmployee) {
    const match = lastEmployee.employeeId.match(/(\d+)$/);
    if (match) {
      newNumber = parseInt(match[1]) + 1;
    }
  }

  return `${prefix}${String(newNumber).padStart(4, "0")}`;
};

// Create a new user (as Employee record)
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, department } = req.body;

    // Check if employee with email already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Verify role exists
    const roleDoc = await Role.findById(role);
    if (!roleDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // For admin roles, find or create a default admin department
    let departmentId = department;
    if (!departmentId) {
      // Find or create Administration department for system users
      let adminDept = await Department.findOne({ code: "ADMIN" });
      if (!adminDept) {
        adminDept = await Department.create({
          name: "Administration",
          code: "ADMIN",
          description: "System administrators and management",
          createdBy: req.user._id,
        });
      }
      departmentId = adminDept._id;
    }

    // Generate employee ID
    const employeeId = await generateEmployeeId(roleDoc.name);

    // Determine if user should be team lead based on role
    const isTeamLead = roleDoc.name === "teamLead" || roleDoc.name === "superAdmin";

    // Create employee record
    const employee = await Employee.create({
      employeeId,
      name,
      email,
      phone,
      password, // Will be hashed by pre-save hook
      role,
      department: departmentId,
      position: roleDoc.name === "superAdmin" ? "System Administrator" : roleDoc.description || roleDoc.name,
      isTeamLead,
      createdBy: req.user._id,
      workSchedule: {
        checkInTime: "09:00",
        checkOutTime: "17:00",
        workingDaysPerWeek: 5,
        workingHoursPerWeek: 40,
        weeklyOffs: ["Saturday", "Sunday"],
      },
    });

    // Fetch the created employee with populated fields
    const employeeResponse = await Employee.findById(employee._id)
      .populate("role", "name description")
      .populate("department", "name code");

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        _id: employeeResponse._id,
        userId: employeeResponse.employeeId, // Map to userId for backward compatibility
        employeeId: employeeResponse.employeeId,
        name: employeeResponse.name,
        email: employeeResponse.email,
        phone: employeeResponse.phone,
        role: employeeResponse.role,
        department: employeeResponse.department,
        isActive: employeeResponse.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all users (system users with admin/management roles)
export const getAllUsers = async (req, res) => {
  try {
    // Get roles that are considered "system users" (not regular employees)
    const systemRoles = await Role.find({
      name: { $in: ["superAdmin", "attendanceDepartment", "ITAssetManager"] },
    });
    const systemRoleIds = systemRoles.map((r) => r._id);

    // Find employees with system roles
    const employees = await Employee.find({
      role: { $in: systemRoleIds },
      isActive: true,
    })
      .populate("role", "name description")
      .populate("department", "name code")
      .sort({ createdAt: -1 });

    // Map to user-like response for backward compatibility
    const users = employees.map((emp) => ({
      _id: emp._id,
      userId: emp.employeeId,
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      department: emp.department,
      isActive: emp.isActive,
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate("role", "name description")
      .populate("department", "name code");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: employee._id,
        userId: employee.employeeId,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        department: employee.department,
        isActive: employee.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { name, phone, role, isActive, email, password } = req.body;

    // If role is being updated, verify it exists
    if (role) {
      const roleExists = await Role.findById(role);
      if (!roleExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
      }
    }

    // Check if email is being updated and if it already exists for another employee
    if (email) {
      const existingEmployee = await Employee.findOne({
        email,
        _id: { $ne: req.params.id },
      });
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Build update object
    const updateData = {
      modifiedBy: req.user._id,
    };
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (email) updateData.email = email;

    // Handle password update
    const passwordChanged = !!password;
    if (password) {
      const bcrypt = await import("bcrypt");
      updateData.password = await bcrypt.default.hash(password, SECURITY.BCRYPT_SALT_ROUNDS);
    }

    const employee = await Employee.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("role", "name description")
      .populate("department", "name code");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Send email notification if password was changed
    if (passwordChanged && employee.email) {
      notifyPasswordChanged(employee).catch(err => {
        console.error("Failed to send password change notification:", err.message);
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        _id: employee._id,
        userId: employee.employeeId,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        department: employee.department,
        isActive: employee.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete user (soft delete)
export const deleteUser = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false, modifiedBy: req.user._id },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
