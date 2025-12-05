import express from "express";
import {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
} from "../Controller/roleController.js";
import { verifyToken, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// Only superAdmin can manage roles
router.post("/", verifyToken, isSuperAdmin, createRole);
router.get("/", verifyToken, getAllRoles);
router.get("/:id", verifyToken, isSuperAdmin, getRoleById);
router.put("/:id", verifyToken, isSuperAdmin, updateRole);
router.delete("/:id", verifyToken, isSuperAdmin, deleteRole);

export default router;
