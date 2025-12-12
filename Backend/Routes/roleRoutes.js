import express from "express";
import {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
} from "../Controller/roleController.js";
import { verifyToken, isAdmin } from "../Middleware/auth.js";

const router = express.Router();

// Only superAdmin can manage roles
router.post("/", verifyToken, isAdmin, createRole);
router.get("/", verifyToken, getAllRoles);
router.get("/:id", verifyToken, isAdmin, getRoleById);
router.put("/:id", verifyToken, isAdmin, updateRole);
router.delete("/:id", verifyToken, isAdmin, deleteRole);

export default router;
