import jwt from "jsonwebtoken";
import Employee from "../Model/Employee.js";

// Verify JWT token (unified Employee authentication)
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
    
    // Find employee
    const employee = await Employee.findById(decoded.id)
      .populate("role", "name description permissions")
      .populate("department", "_id name code");
    
    if (!employee || !employee.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid token or employee not found.",
      });
    }

    req.user = employee;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

// Check if employee is superAdmin
export const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    // Check for superAdmin role (the actual admin role in the system)
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

// Alias for clarity - use isSuperAdmin in new code
export const isSuperAdmin = isAdmin;

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
