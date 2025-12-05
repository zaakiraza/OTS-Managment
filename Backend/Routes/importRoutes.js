import express from "express";
import multer from "multer";
import { importAttendance, importAttendanceText } from "../Controller/importController.js";
import { verifyToken } from "../Middleware/auth.js";

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

// Import attendance from file upload
router.post("/upload", verifyToken, upload.single('file'), importAttendance);

// Import attendance from text content
router.post("/text", verifyToken, importAttendanceText);

export default router;
