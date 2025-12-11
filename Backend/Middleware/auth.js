import jwt from "jsonwebtoken";
import User from "../Model/User.js";
import Employee from "../Model/Employee.js";

// Verify JWT token (supports both User and Employee)
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let user = null;
    
    if (decoded.userType === "employee") {
      // Find employee
      user = await Employee.findById(decoded.id).populate("department", "name");
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Invalid token or employee not found.",
        });
      }
      
      // Add virtual role for consistency
      user.role = { name: user.isTeamLead ? "teamLead" : "employee" };
      user.userType = "employee";
    } else {
      // Find user
      user = await User.findById(decoded.id).populate("role", "name");

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Invalid token or user not found.",
        });
      }
      
      user.userType = "user";
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

// Check if user is superAdmin
export const isSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only superAdmin can perform this action.",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Check if user has specific role
export const hasRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access.",
        });
      }

      if (!roles.includes(req.user.role.name)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${roles.join(", ")}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
};
