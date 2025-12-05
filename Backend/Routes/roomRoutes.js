import express from "express";
import {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
} from "../Controller/roomController.js";
import { verifyToken, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// All routes require superAdmin
router.use(verifyToken);
router.use(isSuperAdmin);

router.post("/", createRoom);
router.get("/", getAllRooms);
router.get("/:id", getRoomById);
router.put("/:id", updateRoom);
router.delete("/:id", deleteRoom);

export default router;
