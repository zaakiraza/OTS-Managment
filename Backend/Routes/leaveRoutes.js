import express from "express";
import {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
  cancelLeave,
  updateLeave,
} from "../Controller/leaveController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";
import { leaveAttachmentUpload, handleUploadError } from "../Middleware/fileUpload.js";

const router = express.Router();

// Employee routes
router.post("/apply", verifyToken, leaveAttachmentUpload, handleUploadError, applyLeave);
router.get("/my-leaves", verifyToken, getMyLeaves);
router.put("/:id", verifyToken, leaveAttachmentUpload, handleUploadError, updateLeave);
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
