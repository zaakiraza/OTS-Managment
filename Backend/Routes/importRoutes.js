import express from "express";
import multer from "multer";
import { importAttendance, importAttendanceText } from "../Controller/importController.js";
import { verifyToken, hasRole } from "../Middleware/auth.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Import attendance from file upload - Only superAdmin and attendanceDepartment
router.post("/upload", verifyToken, hasRole("superAdmin", "attendanceDepartment"), upload.single('file'), importAttendance);

// Import attendance from text content - Only superAdmin and attendanceDepartment
router.post("/text", verifyToken, hasRole("superAdmin", "attendanceDepartment"), importAttendanceText);

export default router;
