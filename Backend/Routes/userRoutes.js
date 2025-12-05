import express from "express";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../Controller/userController.js";
import { verifyToken, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// Only superAdmin can create users
router.post("/", verifyToken, isSuperAdmin, createUser);

// Only superAdmin can view all users
router.get("/", verifyToken, isSuperAdmin, getAllUsers);

// Only superAdmin can view user details
router.get("/:id", verifyToken, isSuperAdmin, getUserById);

// Only superAdmin can update users
router.put("/:id", verifyToken, isSuperAdmin, updateUser);

// Only superAdmin can delete users
router.delete("/:id", verifyToken, isSuperAdmin, deleteUser);

export default router;
