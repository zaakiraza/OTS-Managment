import User from "../Model/User.js";
import Employee from "../Model/Employee.js";
import Role from "../Model/Role.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { SECURITY } from "../Config/constants.js";

// Login user (supports both User and Employee login)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    let user = null;
    let userType = null;

    // Try to find as User first
    user = await User.findOne({ email, isActive: true })
      .select("+password")
      .populate("role", "name description");

    if (user) {
      userType = "user";
      // Compare password for User
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }
    } else {
      // Try to find as Employee (by email or employeeId)
      user = await Employee.findOne({
        $or: [{ email }, { employeeId: email.toUpperCase() }],
        isActive: true,
      })
        .select("+password")
        .populate("department", "name");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials - Employee not found",
        });
      }

      if (!user.password) {
        return res.status(401).json({
          success: false,
          message: "Password not set for this employee. Please contact admin.",
        });
      }

      userType = "employee";
      // Compare password for Employee
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid password",
        });
      }
    }

    // Generate JWT token
    const tokenPayload = userType === "user" 
      ? { id: user._id, role: user.role.name, userType }
      : { id: user._id, employeeId: user.employeeId, isTeamLead: user.isTeamLead, department: user.department._id, userType };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    // Prepare response
    const userResponse = userType === "user" 
      ? {
          _id: user._id,
          name: user.name,
          userId: user.userId,
          email: user.email,
          phone: user.phone,
          role: user.role,
          userType: "user",
        }
      : {
          _id: user._id,
          name: user.name,
          employeeId: user.employeeId,
          email: user.email,
          phone: user.phone,
          department: user.department,
          isTeamLead: user.isTeamLead,
          userType: "employee",
          role: { name: user.isTeamLead ? "teamLead" : "employee" },
        };

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: userResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get current logged-in user
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "role",
      "name description"
    );

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Change password (supports both User and Employee)
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

    let user = null;
    let userType = req.user.userType;

    if (userType === "employee") {
      // Handle employee password change
      user = await Employee.findById(req.user._id).select("+password");
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Hash and update new password
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save({ validateBeforeSave: false });
    } else {
      // Handle user password change
      user = await User.findById(req.user._id).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Hash and update new password
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
    }

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
