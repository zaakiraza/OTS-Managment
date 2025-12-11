import express from "express";
import {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  addComment,
  getTicketStats,
} from "../Controller/ticketController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// All authenticated users can create and view tickets
router.post("/", createTicket);
router.get("/", getAllTickets);
router.get("/stats", getTicketStats);
router.get("/:id", getTicketById);

// All authenticated users can add comments
router.post("/:id/comment", addComment);

// Only superAdmin can update, assign, and delete tickets
router.put("/:id", hasRole("superAdmin"), updateTicket);
router.delete("/:id", hasRole("superAdmin"), deleteTicket);

export default router;
