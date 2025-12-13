import express from "express";
import { login, getMe, changePassword } from "../Controller/authController.js";
import { verifyToken } from "../Middleware/auth.js";
import { authLimiter } from "../Middleware/rateLimiter.js";

const router = express.Router();

// Apply stricter rate limiting to login route to prevent brute force attacks
router.post("/login", authLimiter, login);
router.get("/me", verifyToken, getMe);
// Password change also gets stricter limiting
router.put("/change-password", authLimiter, verifyToken, changePassword);

export default router;
