import multer, { StorageEngine, FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";
import { ValidationError } from "../utils/errors";
import { logger } from "../utils/logger";

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  },
});

// File type validation
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "text/csv", // .csv
    "application/json", // .json (for HAR files)
    "application/x-har", // .har
  ];

  const allowedExtensions = [".xlsx", ".xls", ".csv", ".json", ".har"];

  const ext = path.extname(file.originalname).toLowerCase();
  const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
  const extValid = allowedExtensions.includes(ext);

  if (mimeTypeValid || extValid) {
    logger.info("File accepted", {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    cb(null, true);
  } else {
    logger.warn("File rejected - invalid type", {
      filename: file.originalname,
      mimetype: file.mimetype,
    });
    cb(
      new ValidationError(
        `Invalid file type. Allowed types: ${allowedExtensions.join(", ")}`
      )
    );
  }
};

// File size limits (50MB)
const limits = {
  fileSize: 50 * 1024 * 1024, // 50MB in bytes
  files: 5, // Maximum 5 files at once
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits,
});

// Helper function to delete uploaded file
export const deleteUploadedFile = (filepath: string): void => {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      logger.info("Uploaded file deleted", { filepath });
    }
  } catch (error) {
    logger.error("Failed to delete uploaded file", { filepath, error });
  }
};

// Helper function to get file type from extension
export const getFileType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".xlsx":
    case ".xls":
      return "excel";
    case ".csv":
      return "csv";
    case ".json":
    case ".har":
      return "har";
    default:
      return "unknown";
  }
};

// Helper function to validate file size
export const validateFileSize = (
  size: number,
  maxSize: number = 50 * 1024 * 1024
): boolean => {
  return size <= maxSize;
};

// Cleanup old files (older than 24 hours)
export const cleanupOldFiles = (): void => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    files.forEach((file) => {
      const filepath = path.join(uploadsDir, file);
      const stats = fs.statSync(filepath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filepath);
        logger.info("Old file cleaned up", {
          filepath,
          age: `${Math.round(age / 1000 / 60)} minutes`,
        });
      }
    });
  } catch (error) {
    logger.error("Failed to cleanup old files", { error });
  }
};

// Schedule cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);
