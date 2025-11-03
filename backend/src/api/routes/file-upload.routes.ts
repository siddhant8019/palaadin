import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/authorization.middleware";
import { UserRole } from "../../database/models";
import { upload } from "../../config/multer";
import {
  uploadFile,
  uploadMultipleFiles,
  getUploadedFiles,
  getFileById,
  deleteFile,
} from "../controllers/file-upload.controller";
import {
  processExcelFile,
  getProcessingStatus,
} from "../controllers/excel-processor.controller";
import { processHARFile } from "../controllers/har-processor.controller";

const router = Router();

// All file upload routes require authentication
router.use(authenticateJWT);

// Upload single file
router.post(
  "/single",
  requireRole(UserRole.ADMIN, UserRole.USER),
  upload.single("file"),
  uploadFile
);

// Upload multiple files
router.post(
  "/multiple",
  requireRole(UserRole.ADMIN, UserRole.USER),
  upload.array("files", 5),
  uploadMultipleFiles
);

// Get all uploaded files for user
router.get(
  "/",
  requireRole(UserRole.ADMIN, UserRole.USER, UserRole.VIEWER),
  getUploadedFiles
);

// Get specific file details
router.get(
  "/:fileId",
  requireRole(UserRole.ADMIN, UserRole.USER, UserRole.VIEWER),
  getFileById
);

// Delete file
router.delete(
  "/:fileId",
  requireRole(UserRole.ADMIN, UserRole.USER),
  deleteFile
);

// Process Excel file
router.post(
  "/:fileId/process-excel",
  requireRole(UserRole.ADMIN, UserRole.USER),
  processExcelFile
);

// Process HAR file
router.post(
  "/:fileId/process-har",
  requireRole(UserRole.ADMIN, UserRole.USER),
  processHARFile
);

// Get processing status
router.get(
  "/:fileId/status",
  requireRole(UserRole.ADMIN, UserRole.USER, UserRole.VIEWER),
  getProcessingStatus
);

export default router;
