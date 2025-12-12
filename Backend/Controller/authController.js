import Employee from "../Model/Employee.js";
import Role from "../Model/Role.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { SECURITY } from "../Config/constants.js";

// Login employee (unified authentication)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find employee by email or employeeId
    const employee = await Employee.findOne({
      $or: [{ email }, { employeeId: email.toUpperCase() }],
      isActive: true,
    })
      .select("+password")
      .populate("role", "name description permissions")
      .populate("department", "name");

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!employee.password) {
      return res.status(401).json({
        success: false,
        message: "Password not set for this employee. Please contact admin.",
      });
    }

    // Compare password
    const isPasswordValid = await employee.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Update last login
    employee.lastLogin = new Date();
    await employee.save({ validateBeforeSave: false });

    // Generate JWT token
    const tokenPayload = {
      id: employee._id,
      employeeId: employee.employeeId,
      role: employee.role.name,
      isTeamLead: employee.isTeamLead,
      department: employee.department?._id,
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    // Prepare response
    const employeeResponse = {
      _id: employee._id,
      name: employee.name,
      employeeId: employee.employeeId,
      email: employee.email,
      phone: employee.phone,
      department: employee.department,
      position: employee.position,
      role: employee.role,
      isTeamLead: employee.isTeamLead,
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: employeeResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get current logged-in employee
export const getMe = async (req, res) => {
  try {
    const employee = await Employee.findById(req.user._id)
      .populate("role", "name description permissions")
      .populate("department", "name");

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

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const employee = await Employee.findById(req.user._id).select("+password");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Verify current password
    const isPasswordValid = await employee.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash and update new password
    employee.password = newPassword; // Will be hashed by pre-save hook
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
