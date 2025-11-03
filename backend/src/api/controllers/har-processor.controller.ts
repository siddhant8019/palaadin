import { Request, Response } from "express";
import { logger } from "../../utils/logger";
import { ValidationError } from "../../utils/errors";
import { HARProcessorService } from "../../services/har-processor.service";
import { FileUpload } from "../../database/models";
import { AppDataSource } from "../../config/database";

const fileUploadRepository = AppDataSource.getRepository(FileUpload);

export const processHARFile = async (
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

    // Get file from database
    const file = await fileUploadRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    if (file.fileType !== "har") {
      throw new ValidationError("File is not a HAR file");
    }

    if (file.status === "processing") {
      res.status(400).json({ error: "File is already being processed" });
      return;
    }

    if (file.status === "completed") {
      res.status(400).json({
        error: "File has already been processed",
        processingResult: file.processingResult,
      });
      return;
    }

    // Update status to processing
    file.status = "processing";
    await fileUploadRepository.save(file);

    logger.info("Starting HAR file processing", {
      fileId,
      userId,
      filepath: file.filePath,
    });

    // Process HAR file
    const harProcessor = new HARProcessorService();
    const result = await harProcessor.processHARFile(file.filePath);

    // Update file status
    file.status = result.success ? "completed" : "failed";
    file.processingResult = result;
    file.processedAt = new Date();
    await fileUploadRepository.save(file);

    logger.info("HAR file processed", {
      fileId,
      success: result.success,
      companiesAdded: result.companiesAdded,
      peopleAdded: result.peopleAdded,
    });

    res.status(200).json({
      success: true,
      message: "HAR file processed successfully",
      data: {
        fileId: file.id,
        filename: file.filename,
        status: file.status,
        result: {
          companiesAdded: result.companiesAdded,
          peopleAdded: result.peopleAdded,
          duplicatesSkipped: result.duplicatesSkipped,
          errorsCount: result.errorsCount,
          errors: result.errors.slice(0, 10), // Return first 10 errors
          summary: result.summary,
          dataSourcesFound: result.dataSourcesFound,
          apiEndpoints: result.apiEndpoints.slice(0, 20), // Return first 20 endpoints
        },
      },
    });
  } catch (error) {
    logger.error("HAR processing controller error:", error);

    // Update file status to failed
    const { fileId } = req.params;
    if (fileId) {
      const file = await fileUploadRepository.findOneBy({ id: fileId });
      if (file) {
        file.status = "failed";
        file.processingResult = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
        await fileUploadRepository.save(file);
      }
    }

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
