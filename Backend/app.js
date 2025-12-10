import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./Utils/DB.js";
import authRoutes from "./Routes/authRoutes.js";
import roleRoutes from "./Routes/roleRoutes.js";
import userRoutes from "./Routes/userRoutes.js";
import attendanceRoutes from "./Routes/attendanceRoutes.js";
import campusRoutes from "./Routes/campusRoutes.js";
import buildingRoutes from "./Routes/buildingRoutes.js";
import floorRoutes from "./Routes/floorRoutes.js";
import roomRoutes from "./Routes/roomRoutes.js";
import departmentRoutes from "./Routes/departmentRoutes.js";
import employeeRoutes from "./Routes/employeeRoutes.js";
import salaryRoutes from "./Routes/salaryRoutes.js";
import reportRoutes from "./Routes/reportRoutes.js";
import biometricRoutes from "./Routes/biometricRoutes.js";
import importRoutes from "./Routes/importRoutes.js";
import assetRoutes from "./Routes/assetRoutes.js";
import iclockRoutes from "./Routes/iclockRoutes.js";
import { connectToDevice, startPolling } from "./Utils/zktecoDevice.js";
import { scheduleAbsenteeCheck } from "./Utils/markAbsentees.js";

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
app.use("/api/campuses", campusRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/floors", floorRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/biometric", biometricRoutes);
app.use("/api/import", importRoutes);
app.use("/api/assets", assetRoutes);
app.use("/iclock", iclockRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(process.env.PORT, async () => {
  console.log(`Server is running on port ${process.env.PORT}`);
  
  // Connect to ZKTeco biometric device and start polling
  console.log('\n🔧 Initializing ZKTeco biometric integration...');
  const connected = await connectToDevice();
  if (connected) {
    startPolling();
  } else {
    console.log('⚠️ ZKTeco device not connected. Will retry...\n');
  }
  
  // Schedule daily absentee check at 11:59 PM
  scheduleAbsenteeCheck("23:59");
  console.log('✅ Daily absentee check scheduled\n');
});

export default app;