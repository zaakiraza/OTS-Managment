import express from "express";
import {
  createFloor,
  getAllFloors,
  getFloorById,
  updateFloor,
  deleteFloor,
} from "../Controller/floorController.js";
import { verifyToken, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// All routes require superAdmin
router.use(verifyToken);
router.use(isSuperAdmin);

router.post("/", createFloor);
router.get("/", getAllFloors);
router.get("/:id", getFloorById);
router.put("/:id", updateFloor);
router.delete("/:id", deleteFloor);

export default router;
