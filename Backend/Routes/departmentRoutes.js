import express from "express";
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from "../Controller/departmentController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Write operations - Only superAdmin and attendanceDepartment
router.post("/", hasRole("superAdmin", "attendanceDepartment"), createDepartment);
router.put("/:id", hasRole("superAdmin", "attendanceDepartment"), updateDepartment);
router.delete("/:id", hasRole("superAdmin", "attendanceDepartment"), deleteDepartment);

// Read operations - Allow teamLead as well (for task management)
router.get("/", hasRole("superAdmin", "attendanceDepartment", "teamLead"), getAllDepartments);
router.get("/:id", hasRole("superAdmin", "attendanceDepartment", "teamLead"), getDepartmentById);

export default router;
