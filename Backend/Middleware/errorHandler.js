/**
 * Global Error Handling Middleware
 * 
 * This middleware provides centralized error handling for the entire application.
 * It catches all errors and returns standardized error responses.
 * 
 * Features:
 * - Standardized error response format
 * - Mongoose validation error handling
 * - Mongoose duplicate key error handling
 * - JWT error handling
 * - Development vs Production error details
 * - Error logging with Winston
 */

import logger from "../Utils/logger.js";

/**
 * Custom Application Error class
 * Use this to throw errors with specific status codes
 */
export class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true; // Operational errors are expected (vs programming errors)
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error codes for the application
 */
export const ErrorCodes = {
  // Authentication errors (1000-1099)
  INVALID_CREDENTIALS: "AUTH_1000",
  TOKEN_EXPIRED: "AUTH_1001",
  TOKEN_INVALID: "AUTH_1002",
  UNAUTHORIZED: "AUTH_1003",
  FORBIDDEN: "AUTH_1004",
  
  // Validation errors (2000-2099)
  VALIDATION_ERROR: "VAL_2000",
  DUPLICATE_KEY: "VAL_2001",
  INVALID_ID: "VAL_2002",
  MISSING_REQUIRED: "VAL_2003",
  
  // Resource errors (3000-3099)
  NOT_FOUND: "RES_3000",
  ALREADY_EXISTS: "RES_3001",
  
  // Database errors (4000-4099)
  DATABASE_ERROR: "DB_4000",
  CONNECTION_ERROR: "DB_4001",
  
  // Server errors (5000-5099)
  INTERNAL_ERROR: "SRV_5000",
  RATE_LIMIT_EXCEEDED: "SRV_5001",
};

/**
 * Handle Mongoose CastError (invalid ObjectId)
 */
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, ErrorCodes.INVALID_ID);
};

/**
 * Handle Mongoose Duplicate Key Error
 */
const handleDuplicateKeyError = (err) => {
  // Extract the duplicate field from the error message
  const field = Object.keys(err.keyValue || {})[0] || "field";
  const value = err.keyValue?.[field] || "value";
  const message = `Duplicate value for ${field}: "${value}". Please use a different value.`;
  return new AppError(message, 400, ErrorCodes.DUPLICATE_KEY);
};

/**
 * Handle Mongoose Validation Error
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Validation failed: ${errors.join(". ")}`;
  return new AppError(message, 400, ErrorCodes.VALIDATION_ERROR);
};

/**
 * Handle JWT Error
 */
const handleJWTError = () => {
  return new AppError("Invalid token. Please log in again.", 401, ErrorCodes.TOKEN_INVALID);
};

/**
 * Handle JWT Expired Error
 */
const handleJWTExpiredError = () => {
  return new AppError("Your session has expired. Please log in again.", 401, ErrorCodes.TOKEN_EXPIRED);
};

/**
 * Send error response in development mode (with full details)
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    errorCode: err.errorCode || ErrorCodes.INTERNAL_ERROR,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

/**
 * Send error response in production mode (minimal details)
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      errorCode: err.errorCode || ErrorCodes.INTERNAL_ERROR,
      message: err.message,
    });
  } else {
    // Programming or unknown error: don't leak error details
    logger.error("Unexpected error:", { error: err, stack: err.stack });
    
    res.status(500).json({
      success: false,
      errorCode: ErrorCodes.INTERNAL_ERROR,
      message: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Global Error Handler Middleware
 * 
 * This should be the last middleware in the chain.
 * It catches all errors thrown or passed via next(err).
 */
export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  // Log the error
  logger.error(`${req.method} ${req.originalUrl} - Error: ${err.message}`, {
    statusCode: err.statusCode,
    errorCode: err.errorCode,
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user?._id || "unauthenticated",
  });

  // Check environment
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    sendErrorDev(err, res);
  } else {
    // Create a copy of the error
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.name === "CastError") error = handleCastError(err);
    if (err.code === 11000) error = handleDuplicateKeyError(err);
    if (err.name === "ValidationError") error = handleValidationError(err);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

/**
 * Async Handler wrapper
 * Wraps async route handlers to catch errors automatically
 * 
 * Usage:
 *   router.get("/", asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found Handler
 * Use this for routes that don't exist
 */
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    ErrorCodes.NOT_FOUND
  );
  next(error);
};

export default {
  AppError,
  ErrorCodes,
  globalErrorHandler,
  asyncHandler,
  notFoundHandler,
};

