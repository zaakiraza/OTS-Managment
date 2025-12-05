import express from "express";
import {
  receiveBiometricData,
  biometricHealthCheck,
  getBiometricLogs,
  receiveBiometricDataAlt,
} from "../Controller/biometricController.js";
import { verifyToken } from "../Middleware/auth.js";

const router = express.Router();

// Test endpoint to see raw data
router.all("/test", (req, res) => {
  // console.log("=".repeat(60));
  // console.log("🧪 TEST ENDPOINT HIT!");
  // console.log("Method:", req.method);
  // console.log("Headers:", JSON.stringify(req.headers, null, 2));
  // console.log("Body:", JSON.stringify(req.body, null, 2));
  // console.log("Query:", JSON.stringify(req.query, null, 2));
  // console.log("=".repeat(60));
  res.status(200).send("OK");
});

// Public endpoints (no auth required - for biometric device)
router.all("/push", receiveBiometricData); // Accept both GET and POST
router.all("/data", receiveBiometricDataAlt); // Alternative endpoint
router.all("/", receiveBiometricDataAlt); // Root biometric endpoint
router.get("/health", biometricHealthCheck); // Health check

// Protected endpoints (require authentication)
router.get("/logs", verifyToken, getBiometricLogs); // View biometric logs

export default router;
