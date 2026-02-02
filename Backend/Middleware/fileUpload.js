/**
 * File Upload Middleware with AWS S3
 * Handles file uploads for tickets, tasks, leaves, assets, etc.
 */

import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import { s3Client, S3_BUCKET_NAME, getS3Url, deleteFromS3, getKeyFromUrl } from "../Config/s3.js";

// Allowed file types
const ALLOWED_TYPES = {
  images: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  videos: [
    "video/mp4",
    "video/quicktime", // .mov
    "video/x-msvideo", // .avi
    "video/x-matroska", // .mkv
    "video/x-ms-wmv", // .wmv
    "video/x-flv", // .flv
    "video/webm",
  ],
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
  all: [], // Will be populated with images + videos + documents
};
ALLOWED_TYPES.all = [...ALLOWED_TYPES.images, ...ALLOWED_TYPES.videos, ...ALLOWED_TYPES.documents];

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB
  video: 50 * 1024 * 1024, // 50MB
  document: 10 * 1024 * 1024, // 10MB
  default: 50 * 1024 * 1024, // 50MB
};

/**
 * Create S3 storage configuration
 */
const createS3Storage = (folder) => {
  return multerS3({
    s3: s3Client,
    bucket: S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, { 
        fieldName: file.fieldname,
        originalName: file.originalname,
        uploadedBy: req.user?._id?.toString() || "anonymous",
      });
    },
    key: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const safeName = file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, "_")
        .substring(0, 50);
      // Structure: OTS Managment/folder/filename
      const key = `OTS Managment/${folder}/${uniqueSuffix}-${safeName}`;
      cb(null, key);
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
  storage: createS3Storage("tickets"),
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
  storage: createS3Storage("tasks"),
  fileFilter: createFileFilter(ALLOWED_TYPES.all),
  limits: {
    fileSize: FILE_SIZE_LIMITS.document,
    files: 5,
  },
}).array("attachments", 5);

/**
 * Leave attachments upload (multiple files for absence applications)
 */
export const leaveAttachmentUpload = multer({
  storage: createS3Storage("leaves"),
  fileFilter: createFileFilter(ALLOWED_TYPES.all),
  limits: {
    fileSize: FILE_SIZE_LIMITS.document,
    files: 5,
  },
}).array("attachments", 5);

/**
 * Asset image upload (single image)
 */
export const assetImageUpload = multer({
  storage: createS3Storage("assets"),
  fileFilter: createFileFilter(ALLOWED_TYPES.images),
  limits: {
    fileSize: FILE_SIZE_LIMITS.image,
  },
}).single("image");

/**
 * Single image upload
 */
export const imageUpload = multer({
  storage: createS3Storage("images"),
  fileFilter: createFileFilter(ALLOWED_TYPES.images),
  limits: {
    fileSize: FILE_SIZE_LIMITS.image,
  },
}).single("image");

/**
 * Excel file upload for employee import (memory storage for processing)
 */
export const excelUpload = multer({
  storage: multer.memoryStorage(),
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
 * Helper to get file info for database storage (S3 version)
 */
export const getFileInfo = (file) => ({
  filename: file.key ? file.key.split("/").pop() : file.filename,
  originalName: file.originalname,
  mimetype: file.mimetype || file.contentType,
  size: file.size,
  key: file.key, // S3 key
  url: file.location || getS3Url(file.key), // S3 URL
  path: file.location || getS3Url(file.key), // For backwards compatibility
});

/**
 * Helper to delete uploaded files from S3
 */
export const deleteFile = async (filePathOrKey) => {
  try {
    const key = getKeyFromUrl(filePathOrKey);
    if (key) {
      return await deleteFromS3(key);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
  return false;
};

/**
 * Helper to delete multiple files from S3
 */
export const deleteFiles = async (files) => {
  const results = await Promise.all(
    files.map(async (file) => {
      const key = file.key || getKeyFromUrl(file.url || file.path);
      if (key) {
        return await deleteFromS3(key);
      }
      return false;
    })
  );
  return results;
};

export default {
  ticketAttachmentUpload,
  taskAttachmentUpload,
  leaveAttachmentUpload,
  assetImageUpload,
  imageUpload,
  excelUpload,
  handleUploadError,
  getFileInfo,
  deleteFile,
  deleteFiles,
};

