import express from "express";
import {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  addComment,
  getTicketStats,
  getTicketsAgainstMe,
  getEmployeesForTicket,
  getDepartmentsForTicket,
} from "../Controller/ticketController.js";
import { verifyToken } from "../Middleware/auth.js";
import { ticketAttachmentUpload, handleUploadError } from "../Middleware/fileUpload.js";
import { ticketValidation } from "../Middleware/validators.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// All authenticated users can view employees and departments for filing tickets
router.get("/employees", getEmployeesForTicket);
router.get("/departments", getDepartmentsForTicket);

// All authenticated users can create and view tickets (with file upload support)
router.post("/", ticketAttachmentUpload, handleUploadError, ticketValidation.create, createTicket);
router.get("/", getAllTickets);
router.get("/stats", getTicketStats);
router.get("/against-me", getTicketsAgainstMe); // Get tickets reported against current user

router.get("/:id", getTicketById);

// All authenticated users can add comments
router.post("/:id/comment", addComment);

// Only creator or superAdmin can update/delete (checked in controller)
router.put("/:id", updateTicket);
router.delete("/:id", deleteTicket);

export default router;
