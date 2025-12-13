/**
 * Rate Limiting Middleware
 * 
 * This middleware protects the API from abuse by limiting the number of requests
 * a client can make within a specified time window.
 * 
 * Features:
 * - Global rate limiting for all routes
 * - Stricter rate limiting for authentication routes (login, password reset)
 * - Configurable limits via environment variables
 * - Custom error responses
 */

import rateLimit from "express-rate-limit";
import { AppError, ErrorCodes } from "./errorHandler.js";

/**
 * Configuration for rate limiters
 * Can be overridden via environment variables
 */
const RATE_LIMIT_CONFIG = {
  // Global rate limit
  GLOBAL: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
  },
  
  // Authentication rate limit (stricter for login/password routes)
  AUTH: {
    WINDOW_MS: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 10, // 10 login attempts per window
  },
  
  // API-intensive routes (reports, exports)
  INTENSIVE: {
    WINDOW_MS: parseInt(process.env.INTENSIVE_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
    MAX_REQUESTS: parseInt(process.env.INTENSIVE_RATE_LIMIT_MAX_REQUESTS) || 20, // 20 requests per hour
  },
};

/**
 * Custom key generator that uses IP + user ID if authenticated
 */
const keyGenerator = (req) => {
  // Use IP address by default
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  
  // If user is authenticated, include their ID for more precise limiting
  const userId = req.user?._id || "";
  
  return userId ? `${ip}-${userId}` : ip;
};

/**
 * Custom error handler for rate limit exceeded
 */
const rateLimitHandler = (req, res, next, options) => {
  const error = new AppError(
    `Too many requests. Please try again after ${Math.ceil(options.windowMs / 60000)} minutes.`,
    429,
    ErrorCodes.RATE_LIMIT_EXCEEDED
  );
  
  res.status(429).json({
    success: false,
    errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: error.message,
    retryAfter: Math.ceil(options.windowMs / 1000), // seconds
  });
};

/**
 * Skip rate limiting for trusted sources (optional)
 * Enable by setting RATE_LIMIT_SKIP_TRUSTED=true in env
 */
const skipTrusted = (req) => {
  // Skip rate limiting for localhost in development
  if (process.env.NODE_ENV === "development") {
    const trustedIPs = ["127.0.0.1", "::1", "localhost"];
    return trustedIPs.includes(req.ip);
  }
  
  // In production, could skip for internal services via API key
  const internalApiKey = req.headers["x-internal-api-key"];
  if (internalApiKey && internalApiKey === process.env.INTERNAL_API_KEY) {
    return true;
  }
  
  return false;
};

/**
 * Global Rate Limiter
 * Applies to all routes
 */
export const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.GLOBAL.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.GLOBAL.MAX_REQUESTS,
  keyGenerator,
  skip: skipTrusted,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: "Too many requests. Please try again later.",
  },
  handler: rateLimitHandler,
});

/**
 * Authentication Rate Limiter
 * Stricter limits for login and password-related routes
 */
export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.AUTH.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.AUTH.MAX_REQUESTS,
  keyGenerator,
  skip: skipTrusted,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: "Too many login attempts. Please try again later.",
  },
  handler: (req, res, next, options) => {
    res.status(429).json({
      success: false,
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: `Too many login attempts. Please try again after ${Math.ceil(options.windowMs / 60000)} minutes.`,
      retryAfter: Math.ceil(options.windowMs / 1000),
    });
  },
});

/**
 * Intensive Operations Rate Limiter
 * For resource-intensive operations like reports and exports
 */
export const intensiveLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.INTENSIVE.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.INTENSIVE.MAX_REQUESTS,
  keyGenerator,
  skip: skipTrusted,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: "Too many report requests. Please try again later.",
  },
  handler: rateLimitHandler,
});

/**
 * Create a custom rate limiter with specific limits
 * 
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @param {string} message - Custom error message
 * @returns {Function} Rate limiter middleware
 */
export const createRateLimiter = (maxRequests, windowMs, message = "Too many requests") => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator,
    skip: skipTrusted,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message,
    },
    handler: rateLimitHandler,
  });
};

export default {
  globalLimiter,
  authLimiter,
  intensiveLimiter,
  createRateLimiter,
};

