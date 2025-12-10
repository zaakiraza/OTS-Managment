import User from "../Model/User.js";
import Role from "../Model/Role.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { SECURITY } from "../Config/constants.js";

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user and include password field
    const user = await User.findOne({ email, isActive: true })
      .select("+password")
      .populate("role", "name description");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Remove password from response
    const userResponse = {
      _id: user._id,
      name: user.name,
      userId: user.userId,
      email: user.email,
      phone: user.phone,
      role: user.role,
      lastLogin: user.lastLogin,
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

    const user = await User.findById(req.user._id).select("+password");

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, SECURITY.BCRYPT_SALT_ROUNDS);
    user.password = hashedPassword;
    await user.save();

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
