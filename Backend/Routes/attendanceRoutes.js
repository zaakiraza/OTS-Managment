import express from "express";
import {
  markAttendance,
  getAllAttendance,
  getAttendanceById,
  getTodayAttendance,
  createManualAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceStats,
} from "../Controller/attendanceController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";

const router = express.Router();

// Public endpoint for biometric device to mark attendance
router.post("/mark", markAttendance);

// Protected routes - require authentication
router.get("/", verifyToken, getAllAttendance);
router.get("/today", verifyToken, getTodayAttendance);
router.get("/stats", verifyToken, getAttendanceStats);
router.get("/:id", verifyToken, getAttendanceById);

// Manual attendance entry (attendanceDepartment or superAdmin)
router.post(
  "/manual",
  verifyToken,
  hasRole("superAdmin", "attendanceDepartment"),
  createManualAttendance
);

// Only attendance department and superAdmin can update/delete
router.put(
  "/:id",
  verifyToken,
  hasRole("superAdmin", "attendanceDepartment"),
  updateAttendance
);
router.delete(
  "/:id",
  verifyToken,
  hasRole("superAdmin", "attendanceDepartment"),
  deleteAttendance
);

export default router;
