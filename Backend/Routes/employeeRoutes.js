import express from "express";
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} from "../Controller/employeeController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Create, Update, Delete - Only superAdmin and attendanceDepartment
router.post("/", hasRole("superAdmin", "attendanceDepartment"), createEmployee);
router.put("/:id", hasRole("superAdmin", "attendanceDepartment"), updateEmployee);
router.delete("/:id", hasRole("superAdmin", "attendanceDepartment"), deleteEmployee);

// Read operations - Allow ITAssetManager and teamLead as well (for asset assignment and task assignment)
router.get("/", hasRole("superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead"), getAllEmployees);
router.get("/:id", hasRole("superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead"), getEmployeeById);

export default router;
