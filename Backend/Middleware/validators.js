/**
 * Input Validation & Sanitization Middleware
 * Uses express-validator for comprehensive input validation
 */

import { body, param, query, validationResult } from "express-validator";

/**
 * Handle validation errors
 */
export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Password complexity validation rules
 */
export const passwordComplexityRules = (fieldName = "password") => [
  body(fieldName)
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Password must contain at least one special character"),
];

/**
 * Common sanitization for strings
 */
const sanitizeString = (field) =>
  body(field).trim().escape().optional({ nullable: true });

/**
 * Employee validation rules
 */
export const employeeValidation = {
  create: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ max: 100 })
      .withMessage("Name must be less than 100 characters")
      .escape(),
    body("email")
      .optional({ checkFalsy: true })
      .trim()
      .isEmail()
      .withMessage("Invalid email format")
      .normalizeEmail(),
    body("phone")
      .optional({ checkFalsy: true })
      .trim()
      .isMobilePhone("any")
      .withMessage("Invalid phone number"),
    body("cnic")
      .optional({ checkFalsy: true })
      .trim()
      .matches(/^\d{5}-\d{7}-\d{1}$/)
      .withMessage("Invalid CNIC format. Use: XXXXX-XXXXXXX-X"),
    body("salary.monthlySalary")
      .optional({ checkFalsy: true })
      .isNumeric()
      .withMessage("Monthly salary must be a number"),
    body("salary.leaveThreshold")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Leave threshold must be a positive number"),
    body("joiningDate")
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage("Invalid joining date format"),
    body("department")
      .notEmpty()
      .withMessage("Department is required")
      .isMongoId()
      .withMessage("Invalid department ID"),
    body("role")
      .notEmpty()
      .withMessage("Role is required")
      .isMongoId()
      .withMessage("Invalid role ID"),
    body("position")
      .trim()
      .notEmpty()
      .withMessage("Position is required")
      .isLength({ max: 100 })
      .withMessage("Position must be less than 100 characters")
      .escape(),
    handleValidation,
  ],
  update: [
    param("id").isMongoId().withMessage("Invalid employee ID"),
    body("name")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Name must be less than 100 characters")
      .escape(),
    body("email")
      .optional()
      .trim()
      .isEmail()
      .withMessage("Invalid email format")
      .normalizeEmail(),
    body("phone")
      .optional()
      .trim()
      .isMobilePhone("any")
      .withMessage("Invalid phone number"),
    handleValidation,
  ],
};

/**
 * Department validation rules
 */
export const departmentValidation = {
  create: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Department name is required")
      .isLength({ max: 100 })
      .withMessage("Name must be less than 100 characters")
      .escape(),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters")
      .escape(),
    body("parentDepartment")
      .optional()
      .isMongoId()
      .withMessage("Invalid parent department ID"),
    handleValidation,
  ],
  update: [
    param("id").isMongoId().withMessage("Invalid department ID"),
    body("name")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Name must be less than 100 characters")
      .escape(),
    handleValidation,
  ],
};

/**
 * Task validation rules
 */
export const taskValidation = {
  create: [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Task title is required")
      .isLength({ max: 200 })
      .withMessage("Title must be less than 200 characters")
      .escape(),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description must be less than 2000 characters")
      .escape(),
    body("priority")
      .notEmpty()
      .withMessage("Priority is required")
      .isIn(["Low", "Medium", "High", "Critical"])
      .withMessage("Invalid priority value"),
    body("dueDate")
      .notEmpty()
      .withMessage("Due date is required")
      .isISO8601()
      .withMessage("Invalid date format"),
    body("department")
      .notEmpty()
      .withMessage("Department is required")
      .isMongoId()
      .withMessage("Invalid department ID"),
    body("assignedTo")
      .isArray({ min: 1 })
      .withMessage("At least one assignee is required"),
    body("assignedTo.*")
      .isMongoId()
      .withMessage("Invalid employee ID in assignedTo"),
    handleValidation,
  ],
  update: [
    param("id").isMongoId().withMessage("Invalid task ID"),
    body("title")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Title must be less than 200 characters")
      .escape(),
    body("priority")
      .optional()
      .isIn(["Low", "Medium", "High", "Critical"])
      .withMessage("Invalid priority value"),
    handleValidation,
  ],
  updateStatus: [
    param("id").isMongoId().withMessage("Invalid task ID"),
    body("status")
      .notEmpty()
      .withMessage("Status is required")
      .isIn(["todo", "in-progress", "completed"])
      .withMessage("Invalid status value"),
    handleValidation,
  ],
};

/**
 * Ticket validation rules
 */
export const ticketValidation = {
  create: [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Ticket title is required")
      .isLength({ max: 200 })
      .withMessage("Title must be less than 200 characters")
      .escape(),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required")
      .isLength({ max: 5000 })
      .withMessage("Description must be less than 5000 characters")
      .escape(),
    body("category")
      .notEmpty()
      .withMessage("Category is required")
      .isIn(["Maintenance", "Technical", "HR", "Administrative", "Other"])
      .withMessage("Invalid category"),
    body("priority")
      .notEmpty()
      .withMessage("Priority is required")
      .isIn(["Low", "Medium", "High", "Critical"])
      .withMessage("Invalid priority"),
    body("reportedAgainst")
      .optional()
      .isMongoId()
      .withMessage("Invalid employee ID"),
    handleValidation,
  ],
  update: [
    param("id").isMongoId().withMessage("Invalid ticket ID"),
    body("status")
      .optional()
      .isIn(["Open", "In Progress", "Resolved", "Closed"])
      .withMessage("Invalid status"),
    handleValidation,
  ],
  addComment: [
    param("id").isMongoId().withMessage("Invalid ticket ID"),
    body("comment")
      .trim()
      .notEmpty()
      .withMessage("Comment is required")
      .isLength({ max: 1000 })
      .withMessage("Comment must be less than 1000 characters")
      .escape(),
    handleValidation,
  ],
};

/**
 * Auth validation rules
 */
export const authValidation = {
  login: [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email or Employee ID is required"),
    body("password").notEmpty().withMessage("Password is required"),
    handleValidation,
  ],
  changePassword: [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    ...passwordComplexityRules("newPassword"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Confirm password is required")
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
    handleValidation,
  ],
};

/**
 * Pagination validation
 */
export const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  query("sortBy")
    .optional()
    .isIn(["name", "email", "createdAt", "employeeId", "department"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
  handleValidation,
];

/**
 * MongoDB ID validation
 */
export const validateMongoId = (paramName = "id") => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
  handleValidation,
];

