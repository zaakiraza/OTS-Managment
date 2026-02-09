import express from "express";
import {
  getAllAssets,
  getAssetById,
  createAsset,
  bulkCreateAssets,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  getAssetHistory,
  getEmployeeAssets,
  getAssetStats,
  getAssetAnalytics,
} from "../Controller/assetController.js";
import { verifyToken } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Asset CRUD
router.get("/", getAllAssets);
router.get("/stats", getAssetStats);
router.get("/analytics/detailed", getAssetAnalytics);
router.get("/:id", getAssetById);
router.post("/", createAsset);
router.post("/bulk", bulkCreateAssets);  // Bulk import
router.put("/:id", updateAsset);
router.delete("/:id", deleteAsset);

// Asset assignment
router.post("/assign", assignAsset);
router.post("/return", returnAsset);
router.get("/:assetId/history", getAssetHistory);
router.get("/employee/:employeeId", getEmployeeAssets);

export default router;
