import express from "express";
import {
  createBuilding,
  getAllBuildings,
  getBuildingById,
  updateBuilding,
  deleteBuilding,
} from "../Controller/buildingController.js";
import { verifyToken, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// All routes require superAdmin
router.use(verifyToken);
router.use(isSuperAdmin);

router.post("/", createBuilding);
router.get("/", getAllBuildings);
router.get("/:id", getBuildingById);
router.put("/:id", updateBuilding);
router.delete("/:id", deleteBuilding);

export default router;
