import express from "express";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../Controller/userController.js";
import { verifyToken, isAdmin } from "../Middleware/auth.js";

const router = express.Router();

// Only superAdmin can create users
router.post("/", verifyToken, isAdmin, createUser);

// Only superAdmin can view all users
router.get("/", verifyToken, isAdmin, getAllUsers);

// Only superAdmin can view user details
router.get("/:id", verifyToken, isAdmin, getUserById);

// Only superAdmin can update users
router.put("/:id", verifyToken, isAdmin, updateUser);

// Only superAdmin can delete users
router.delete("/:id", verifyToken, isAdmin, deleteUser);

export default router;
