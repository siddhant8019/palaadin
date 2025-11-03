import { Request, Response } from "express";
import { logger } from "../../utils/logger";
import { ValidationError } from "../../utils/errors";
import { getFileType, deleteUploadedFile } from "../../config/multer";
import { FileUpload } from "../../database/models";
import { AppDataSource } from "../../config/database";

const fileUploadRepository = AppDataSource.getRepository(FileUpload);

export const uploadFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!req.file) {
      throw new ValidationError("No file uploaded");
    }

    const file = req.file;
    const fileType = getFileType(file.originalname);

    logger.info("File uploaded", {
      userId,
      filename: file.originalname,
      size: file.size,
      type: fileType,
      path: file.path,
    });

    // Create file upload record
    const fileUpload = fileUploadRepository.create({
      userId,
      filename: file.originalname,
      filePath: file.path,
      fileType,
      fileSize: file.size,
      processingStatus: "pending",
    });

    await fileUploadRepository.save(fileUpload);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        id: fileUpload.id,
        filename: fileUpload.filename,
        fileType: fileUpload.fileType,
        fileSize: fileUpload.fileSize,
        processingStatus: fileUpload.processingStatus,
        uploadedAt: fileUpload.createdAt,
      },
    });
  } catch (error) {
    logger.error("File upload controller error:", error);

    // Clean up file if upload failed
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const uploadMultipleFiles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new ValidationError("No files uploaded");
    }

    const files = req.files as Express.Multer.File[];
    const uploadedFiles = [];

    for (const file of files) {
      const fileType = getFileType(file.originalname);

      logger.info("File uploaded", {
        userId,
        filename: file.originalname,
        size: file.size,
        type: fileType,
        path: file.path,
      });

      const fileUpload = fileUploadRepository.create({
        userId,
        filename: file.originalname,
        filePath: file.path,
        fileType,
        fileSize: file.size,
        processingStatus: "pending",
      });

      await fileUploadRepository.save(fileUpload);

      uploadedFiles.push({
        id: fileUpload.id,
        filename: fileUpload.filename,
        fileType: fileUpload.fileType,
        fileSize: fileUpload.fileSize,
        processingStatus: fileUpload.processingStatus,
        uploadedAt: fileUpload.createdAt,
      });
    }

    res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully`,
      data: uploadedFiles,
    });
  } catch (error) {
    logger.error("Multiple file upload controller error:", error);

    // Clean up files if upload failed
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        deleteUploadedFile(file.path);
      });
    }

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const getUploadedFiles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const files = await fileUploadRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: 50, // Limit to last 50 files
    });

    res.status(200).json({
      success: true,
      data: files,
      total: files.length,
    });
  } catch (error) {
    logger.error("Get uploaded files controller error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getFileById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { fileId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const file = await fileUploadRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: file,
    });
  } catch (error) {
    logger.error("Get file by ID controller error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { fileId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const file = await fileUploadRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Delete from database
    await fileUploadRepository.remove(file);

    // Delete physical file
    deleteUploadedFile(file.filePath);

    logger.info("File deleted", { fileId, userId, filename: file.filename });

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    logger.error("Delete file controller error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
