import express from "express";
import {
  calculateSalary,
  calculateAllSalaries,
  previewSalary,
  previewAllSalaries,
  getAllSalaries,
  getSalaryById,
  approveSalary,
  markSalaryPaid,
  updateSalary,
} from "../Controller/salaryController.js";
import { verifyToken, hasRole, isAdmin } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Preview salary calculation for single employee (attendanceDepartment or superAdmin)
router.post("/preview", hasRole("superAdmin", "attendanceDepartment"), previewSalary);

// Preview salary calculation for all employees (attendanceDepartment or superAdmin)
router.post("/preview-all", hasRole("superAdmin", "attendanceDepartment"), previewAllSalaries);

// Calculate salary for single employee (attendanceDepartment or superAdmin)
router.post("/calculate", hasRole("superAdmin", "attendanceDepartment"), calculateSalary);

// Calculate salary for all employees (attendanceDepartment or superAdmin)
router.post("/calculate-all", hasRole("superAdmin", "attendanceDepartment"), calculateAllSalaries);

// Get all salaries (attendanceDepartment or superAdmin)
router.get("/", hasRole("superAdmin", "attendanceDepartment"), getAllSalaries);

// Get salary by ID (attendanceDepartment or superAdmin)
router.get("/:id", hasRole("superAdmin", "attendanceDepartment"), getSalaryById);

// Approve salary (superAdmin only)
router.patch("/:id/approve", isAdmin, approveSalary);

// Mark salary as paid (superAdmin only)
router.patch("/:id/paid", isAdmin, markSalaryPaid);

// Update salary (manual adjustments) - attendanceDepartment or superAdmin
router.put("/:id", hasRole("superAdmin", "attendanceDepartment"), updateSalary);

export default router;
