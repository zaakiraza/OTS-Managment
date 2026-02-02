import express from "express";
import {
  createTask,
  getAllTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  addComment,
  getTaskStats,
  getTaskReport,
} from "../Controller/taskController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";
import { taskAttachmentUpload, handleUploadError } from "../Middleware/fileUpload.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Employee routes - can view their own tasks and update status
router.get("/my-tasks", getMyTasks);
router.patch("/:id/status", updateTaskStatus);

// Team leads, attendance department, and above can create and manage tasks
router.post("/", hasRole("superAdmin", "teamLead", "attendanceDepartment"), taskAttachmentUpload, handleUploadError, createTask);
router.get("/", hasRole("superAdmin", "teamLead", "attendanceDepartment"), getAllTasks);
router.get("/stats", hasRole("superAdmin", "teamLead", "attendanceDepartment"), getTaskStats);
router.get("/report", hasRole("superAdmin", "teamLead", "attendanceDepartment"), getTaskReport);
router.get("/:id", getTaskById);

// Authenticated users can add comments
router.post("/:id/comment", addComment);

// Team leads, attendance department, and above can update and delete tasks
router.put("/:id", hasRole("superAdmin", "teamLead", "attendanceDepartment"), taskAttachmentUpload, handleUploadError, updateTask);
router.delete("/:id", hasRole("superAdmin", "teamLead", "attendanceDepartment"), deleteTask);

export default router;
