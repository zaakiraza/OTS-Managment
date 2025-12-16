import express from "express";
import {
  getAllSettings,
  getSetting,
  updateSetting,
  updateMultipleSettings,
  checkFeatureEnabled,
} from "../Controller/settingsController.js";
import { verifyToken, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// Public route to check if a feature is enabled (requires authentication)
router.get("/feature/:feature", verifyToken, checkFeatureEnabled);

// Get all settings (requires authentication)
router.get("/", verifyToken, getAllSettings);

// Get a specific setting
router.get("/:key", verifyToken, getSetting);

// Update a single setting (superAdmin only)
router.put("/", verifyToken, isSuperAdmin, updateSetting);

// Update multiple settings (superAdmin only)
router.put("/bulk", verifyToken, isSuperAdmin, updateMultipleSettings);

export default router;

