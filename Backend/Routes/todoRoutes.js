import express from "express";
import {
  getMyTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
  toggleTodoStatus,
} from "../Controller/todoController.js";
import { verifyToken } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Todo routes (all authenticated users - private to each user)
router.get("/", getMyTodos);
router.get("/:id", getTodoById);
router.post("/", createTodo);
router.put("/:id", updateTodo);
router.delete("/:id", deleteTodo);
router.patch("/:id/toggle", toggleTodoStatus);

export default router;

