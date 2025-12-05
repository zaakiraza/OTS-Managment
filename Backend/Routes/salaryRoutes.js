import express from "express";
import {
  calculateSalary,
  calculateAllSalaries,
  getAllSalaries,
  getSalaryById,
  approveSalary,
  markSalaryPaid,
  updateSalary,
} from "../Controller/salaryController.js";
import { verifyToken, hasRole, isSuperAdmin } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Calculate salary for single employee (attendanceDepartment or superAdmin)
router.post("/calculate", hasRole("superAdmin", "attendanceDepartment"), calculateSalary);

// Calculate salary for all employees (attendanceDepartment or superAdmin)
router.post("/calculate-all", hasRole("superAdmin", "attendanceDepartment"), calculateAllSalaries);

// Get all salaries (attendanceDepartment or superAdmin)
router.get("/", hasRole("superAdmin", "attendanceDepartment"), getAllSalaries);

// Get salary by ID (attendanceDepartment or superAdmin)
router.get("/:id", hasRole("superAdmin", "attendanceDepartment"), getSalaryById);

// Approve salary (superAdmin only)
router.patch("/:id/approve", isSuperAdmin, approveSalary);

// Mark salary as paid (superAdmin only)
router.patch("/:id/paid", isSuperAdmin, markSalaryPaid);

// Update salary (manual adjustments) - attendanceDepartment or superAdmin
router.put("/:id", hasRole("superAdmin", "attendanceDepartment"), updateSalary);

export default router;
