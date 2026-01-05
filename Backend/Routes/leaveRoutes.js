import express from "express";
import {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
  cancelLeave,
} from "../Controller/leaveController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";

const router = express.Router();

// Employee routes
router.post("/apply", verifyToken, applyLeave);
router.get("/my-leaves", verifyToken, getMyLeaves);
router.delete("/:id", verifyToken, cancelLeave);

// Attendance Department / SuperAdmin routes
router.get(
  "/all",
  verifyToken,
  hasRole("superAdmin", "attendanceDepartment"),
  getAllLeaves
);
router.put(
  "/:id/status",
  verifyToken,
  hasRole("superAdmin", "attendanceDepartment"),
  updateLeaveStatus
);

export default router;
