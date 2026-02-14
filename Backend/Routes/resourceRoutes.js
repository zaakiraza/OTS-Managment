import express from "express";
import {
  createResource,
  getAllResources,
  getResourceById,
  updateResource,
  deleteResource,
  getResourceStats,
} from "../Controller/resourceController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Resources access
router.post("/", hasRole("superAdmin", "attendanceDepartment"), createResource);
router.get("/", hasRole("superAdmin", "attendanceDepartment", "teamLead"), getAllResources);
router.get("/stats", hasRole("superAdmin", "attendanceDepartment", "teamLead"), getResourceStats);
router.get("/:id", hasRole("superAdmin", "attendanceDepartment", "teamLead"), getResourceById);
router.put("/:id", hasRole("superAdmin", "attendanceDepartment"), updateResource);
router.delete("/:id", hasRole("superAdmin", "attendanceDepartment"), deleteResource);

export default router;
