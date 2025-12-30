import express from "express";
import {
  submitFeedback,
  getMyFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedback,
  deleteFeedback,
} from "../Controller/feedbackController.js";
import { verifyToken, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// User routes (all authenticated users)
router.post("/", submitFeedback);
router.get("/my", getMyFeedback);

// Admin routes (superAdmin only) - must come before /:id
router.get("/", isSuperAdmin, getAllFeedback);

// Routes with ID parameter (must come after specific routes)
router.get("/:id", getFeedbackById);
router.put("/:id", isSuperAdmin, updateFeedback);
router.delete("/:id", deleteFeedback);

export default router;

