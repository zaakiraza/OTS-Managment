import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
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
import exportRoutes from "./Routes/exportRoutes.js";
import auditLogRoutes from "./Routes/auditLogRoutes.js";
import iclockRoutes from "./Routes/iclockRoutes.js";
import settingsRoutes from "./Routes/settingsRoutes.js";
import feedbackRoutes from "./Routes/feedbackRoutes.js";
import todoRoutes from "./Routes/todoRoutes.js";
import { connectToDevice, startPolling } from "./Utils/zktecoDevice.js";
import { scheduleAbsenteeCheck } from "./Utils/markAbsentees.js";
import logger from "./Utils/logger.js";
import { globalErrorHandler, notFoundHandler } from "./Middleware/errorHandler.js";
import { globalLimiter, authLimiter, intensiveLimiter } from "./Middleware/rateLimiter.js";

// ES module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Trust proxy to get real IP addresses (important for accurate audit logging)
app.set('trust proxy', true);

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // For form-data
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

// Serve static files (uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
app.use("/api/export", exportRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/todos", todoRoutes);
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