/**
 * File Upload Middleware
 * Handles file uploads for tickets and tasks
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const uploadDirs = {
  tickets: path.join(__dirname, "../uploads/tickets"),
  tasks: path.join(__dirname, "../uploads/tasks"),
  general: path.join(__dirname, "../uploads/general"),
};

Object.values(uploadDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Allowed file types
const ALLOWED_TYPES = {
  images: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
  all: [], // Will be populated with images + documents
};
ALLOWED_TYPES.all = [...ALLOWED_TYPES.images, ...ALLOWED_TYPES.documents];

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  default: 10 * 1024 * 1024, // 10MB
};

/**
 * Configure storage for different upload types
 */
const createStorage = (folder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = uploadDirs[folder] || uploadDirs.general;
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const safeName = file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, "_")
        .substring(0, 50);
      cb(null, `${uniqueSuffix}-${safeName}`);
    },
  });
};

/**
 * File filter for validation
 */
const createFileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Allowed types: ${allowedTypes
            .map((t) => t.split("/")[1])
            .join(", ")}`
        ),
        false
      );
    }
  };
};

/**
 * Ticket attachments upload (multiple files)
 */
export const ticketAttachmentUpload = multer({
  storage: createStorage("tickets"),
  fileFilter: createFileFilter(ALLOWED_TYPES.all),
  limits: {
    fileSize: FILE_SIZE_LIMITS.document,
    files: 5, // Max 5 files per upload
  },
}).array("attachments", 5);

/**
 * Task attachments upload (multiple files)
 */
export const taskAttachmentUpload = multer({
  storage: createStorage("tasks"),
  fileFilter: createFileFilter(ALLOWED_TYPES.all),
  limits: {
    fileSize: FILE_SIZE_LIMITS.document,
    files: 5,
  },
}).array("attachments", 5);

/**
 * Single image upload
 */
export const imageUpload = multer({
  storage: createStorage("general"),
  fileFilter: createFileFilter(ALLOWED_TYPES.images),
  limits: {
    fileSize: FILE_SIZE_LIMITS.image,
  },
}).single("image");

/**
 * Excel file upload for employee import
 */
export const excelUpload = multer({
  storage: createStorage("general"),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls) are allowed"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single("excelFile");

/**
 * Middleware to handle multer errors
 */
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 5 files.",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

/**
 * Helper to get file info for database storage
 */
export const getFileInfo = (file) => ({
  filename: file.filename,
  originalName: file.originalname,
  mimetype: file.mimetype,
  size: file.size,
  path: file.path,
  url: `/uploads/${file.destination.split("uploads")[1]}/${file.filename}`,
});

/**
 * Helper to delete uploaded files
 */
export const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
  return false;
};

export default {
  ticketAttachmentUpload,
  taskAttachmentUpload,
  imageUpload,
  excelUpload,
  handleUploadError,
  getFileInfo,
  deleteFile,
};

