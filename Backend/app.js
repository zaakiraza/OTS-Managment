import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./Utils/DB.js";
import authRoutes from "./Routes/authRoutes.js";
import roleRoutes from "./Routes/roleRoutes.js";
import userRoutes from "./Routes/userRoutes.js";
import attendanceRoutes from "./Routes/attendanceRoutes.js";
import departmentRoutes from "./Routes/departmentRoutes.js";
import employeeRoutes from "./Routes/employeeRoutes.js";
import salaryRoutes from "./Routes/salaryRoutes.js";
import reportRoutes from "./Routes/reportRoutes.js";
import biometricRoutes from "./Routes/biometricRoutes.js";
import importRoutes from "./Routes/importRoutes.js";
import assetRoutes from "./Routes/assetRoutes.js";
import ticketRoutes from "./Routes/ticketRoutes.js";
import taskRoutes from "./Routes/taskRoutes.js";
import resourceRoutes from "./Routes/resourceRoutes.js";
import iclockRoutes from "./Routes/iclockRoutes.js";
import { connectToDevice, startPolling } from "./Utils/zktecoDevice.js";
import { scheduleAbsenteeCheck } from "./Utils/markAbsentees.js";
import logger from "./Utils/logger.js";
import { globalErrorHandler, notFoundHandler } from "./Middleware/errorHandler.js";
import { globalLimiter, authLimiter, intensiveLimiter } from "./Middleware/rateLimiter.js";

dotenv.config();

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For form-data
app.use(express.text({ type: 'application/octet-stream' })); // For iClock protocol
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' })); // Raw data

// Apply global rate limiting to all requests
// Can be disabled by setting RATE_LIMIT_ENABLED=false in environment
if (process.env.RATE_LIMIT_ENABLED !== 'false') {
  app.use(globalLimiter);
  logger.info('Rate limiting enabled');
}

// Log all incoming requests
app.use((req, res, next) => {
  // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  // console.log("Headers:", req.headers);
  // console.log("Body:", req.body);
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.send("Working Fine");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/biometric", biometricRoutes);
app.use("/api/import", importRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/iclock", iclockRoutes);

// 404 Handler - catches all unmatched routes
app.use(notFoundHandler);

// Global Error Handler - must be last middleware
// Handles all errors including validation, authentication, and operational errors
app.use(globalErrorHandler);

app.listen(process.env.PORT, async () => {
  logger.info(`Server is running on port ${process.env.PORT}`);
  
  // Connect to ZKTeco biometric device and start polling
  logger.info('Initializing ZKTeco biometric integration...');
  const connected = await connectToDevice();
  if (connected) {
    startPolling();
  } else {
    logger.warn('ZKTeco device not connected. Will retry...');
  }
  
  // Schedule daily absentee check at 11:59 PM
  scheduleAbsenteeCheck("23:59");
  logger.info('Daily absentee check scheduled');
});

export default app;