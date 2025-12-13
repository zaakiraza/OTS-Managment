import express from "express";
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getDepartmentTeamLeads,
  getDepartmentEmployees,
  getSubDepartments,
} from "../Controller/departmentController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Write operations - Only superAdmin and attendanceDepartment
router.post("/", hasRole("superAdmin", "attendanceDepartment"), createDepartment);
router.put("/:id", hasRole("superAdmin", "attendanceDepartment"), updateDepartment);
router.delete("/:id", hasRole("superAdmin", "attendanceDepartment"), deleteDepartment);

// Read operations - Allow teamLead and ITAssetManager as well
router.get("/", hasRole("superAdmin", "attendanceDepartment", "teamLead", "ITAssetManager"), getAllDepartments);
router.get("/:id", hasRole("superAdmin", "attendanceDepartment", "teamLead", "ITAssetManager"), getDepartmentById);
router.get("/:id/team-leads", hasRole("superAdmin", "attendanceDepartment", "teamLead"), getDepartmentTeamLeads);
router.get("/:id/employees", hasRole("superAdmin", "attendanceDepartment", "teamLead", "ITAssetManager"), getDepartmentEmployees);
router.get("/:id/sub-departments", hasRole("superAdmin", "attendanceDepartment", "teamLead"), getSubDepartments);

export default router;
