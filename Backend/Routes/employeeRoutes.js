import express from "express";
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  downloadEmployeeTemplate,
  importEmployees,
} from "../Controller/employeeController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";
import { employeeValidation, paginationValidation, validateMongoId } from "../Middleware/validators.js";
import { excelUpload, handleUploadError } from "../Middleware/fileUpload.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Import/Export operations - Only superAdmin and attendanceDepartment
// IMPORTANT: These specific routes must come BEFORE parameterized routes like /:id
router.get("/template/download", hasRole("superAdmin", "attendanceDepartment"), downloadEmployeeTemplate);
router.post("/import", hasRole("superAdmin", "attendanceDepartment"), excelUpload, handleUploadError, importEmployees);

// Create, Update, Delete - Only superAdmin and attendanceDepartment
router.post("/", hasRole("superAdmin", "attendanceDepartment"), employeeValidation.create, createEmployee);
router.put("/:id", hasRole("superAdmin", "attendanceDepartment"), employeeValidation.update, updateEmployee);
router.delete("/:id", hasRole("superAdmin", "attendanceDepartment"), validateMongoId(), deleteEmployee);

// Read operations - Allow ITAssetManager and teamLead as well
router.get("/", hasRole("superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead"), paginationValidation, getAllEmployees);
router.get("/:id", hasRole("superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead"), validateMongoId(), getEmployeeById);

export default router;
