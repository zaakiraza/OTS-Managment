import express from "express";
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} from "../Controller/employeeController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";
import { employeeValidation, paginationValidation, validateMongoId } from "../Middleware/validators.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Create, Update, Delete - Only superAdmin and attendanceDepartment
router.post("/", hasRole("superAdmin", "attendanceDepartment"), employeeValidation.create, createEmployee);
router.put("/:id", hasRole("superAdmin", "attendanceDepartment"), employeeValidation.update, updateEmployee);
router.delete("/:id", hasRole("superAdmin", "attendanceDepartment"), validateMongoId(), deleteEmployee);

// Read operations - Allow ITAssetManager and teamLead as well
router.get("/", hasRole("superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead"), paginationValidation, getAllEmployees);
router.get("/:id", hasRole("superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead"), validateMongoId(), getEmployeeById);

export default router;
