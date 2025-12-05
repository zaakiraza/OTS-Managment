import express from "express";
import {
  createCampus,
  getAllCampuses,
  getCampusById,
  updateCampus,
  deleteCampus,
} from "../Controller/campusController.js";
import { verifyToken, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// All routes require superAdmin
router.use(verifyToken);
router.use(isSuperAdmin);

router.post("/", createCampus);
router.get("/", getAllCampuses);
router.get("/:id", getCampusById);
router.put("/:id", updateCampus);
router.delete("/:id", deleteCampus);

export default router;
