import express from "express";
import { login, getMe, changePassword } from "../Controller/authController.js";
import { verifyToken } from "../Middleware/auth.js";
import { authLimiter } from "../Middleware/rateLimiter.js";
import { authValidation } from "../Middleware/validators.js";

const router = express.Router();

// Apply stricter rate limiting to login route to prevent brute force attacks
router.post("/login", authLimiter, authValidation.login, login);
router.get("/me", verifyToken, getMe);
// Password change with validation and stricter limiting
router.put("/change-password", authLimiter, verifyToken, authValidation.changePassword, changePassword);

export default router;
