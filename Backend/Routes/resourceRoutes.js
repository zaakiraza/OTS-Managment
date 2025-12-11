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

// Team leads and above can manage resources
router.post("/", hasRole("superAdmin", "teamLead"), createResource);
router.get("/", hasRole("superAdmin", "teamLead"), getAllResources);
router.get("/stats", hasRole("superAdmin", "teamLead"), getResourceStats);
router.get("/:id", hasRole("superAdmin", "teamLead"), getResourceById);
router.put("/:id", hasRole("superAdmin", "teamLead"), updateResource);
router.delete("/:id", hasRole("superAdmin", "teamLead"), deleteResource);

export default router;
