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

// Team leads and above can create and manage tasks
router.post("/", hasRole("superAdmin", "teamLead"), taskAttachmentUpload, handleUploadError, createTask);
router.get("/", hasRole("superAdmin", "teamLead"), getAllTasks);
router.get("/stats", hasRole("superAdmin", "teamLead"), getTaskStats);
router.get("/report", hasRole("superAdmin", "teamLead"), getTaskReport);
router.get("/:id", getTaskById);

// Authenticated users can add comments
router.post("/:id/comment", addComment);

// Team leads and above can update and delete tasks
router.put("/:id", hasRole("superAdmin", "teamLead"), taskAttachmentUpload, handleUploadError, updateTask);
router.delete("/:id", hasRole("superAdmin", "teamLead"), deleteTask);

export default router;
