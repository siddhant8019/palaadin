import { Request, Response } from "express";
import { logger } from "../../utils/logger";
import { batchProcessingService } from "../../services/batch-processing.service";
import { getWebSocketService } from "../../services/websocket.service";

export class BatchProcessingController {
  /**
   * Start a new batch scraping job
   */
  async startBatchJob(req: Request, res: Response): Promise<void> {
    try {
      const { url, options } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      if (!url) {
        res.status(400).json({
          success: false,
          error: "URL is required",
        });
        return;
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        res.status(400).json({
          success: false,
          error: "Invalid URL format",
        });
        return;
      }

      // Start batch job
      const job = await batchProcessingService.startBatchJob(userId, url, {
        batchSize: options?.batchSize || 100,
        maxConcurrent: options?.maxConcurrent || 5,
        timeout: options?.timeout || 300000,
        retryAttempts: options?.retryAttempts || 3,
      });

      logger.info("Batch job started", {
        jobId: job.id,
        userId,
        url,
        options,
      });

      res.status(201).json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          url: job.url,
          startTime: job.startTime,
        },
      });
    } catch (error) {
      logger.error("Failed to start batch job:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start batch job",
      });
    }
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const job = batchProcessingService.getJob(jobId);
      if (!job) {
        res.status(404).json({
          success: false,
          error: "Job not found",
        });
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          error: "Access denied",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          totalRecords: job.totalRecords,
          processedRecords: job.processedRecords,
          successCount: job.successCount,
          errorCount: job.errorCount,
          startTime: job.startTime,
          endTime: job.endTime,
          estimatedTimeRemaining: job.estimatedTimeRemaining,
          errors: job.errors,
        },
      });
    } catch (error) {
      logger.error("Failed to get job status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get job status",
      });
    }
  }

  /**
   * Get all jobs for a user
   */
  async getUserJobs(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const jobs = batchProcessingService.getUserJobs(userId);

      res.json({
        success: true,
        data: jobs.map((job) => ({
          id: job.id,
          url: job.url,
          status: job.status,
          progress: job.progress,
          totalRecords: job.totalRecords,
          processedRecords: job.processedRecords,
          successCount: job.successCount,
          errorCount: job.errorCount,
          startTime: job.startTime,
          endTime: job.endTime,
          estimatedTimeRemaining: job.estimatedTimeRemaining,
        })),
      });
    } catch (error) {
      logger.error("Failed to get user jobs:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user jobs",
      });
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const job = batchProcessingService.getJob(jobId);
      if (!job) {
        res.status(404).json({
          success: false,
          error: "Job not found",
        });
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          error: "Access denied",
        });
        return;
      }

      const cancelled = batchProcessingService.cancelJob(jobId);
      if (cancelled) {
        res.json({
          success: true,
          message: "Job cancelled successfully",
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Job cannot be cancelled",
        });
      }
    } catch (error) {
      logger.error("Failed to cancel job:", error);
      res.status(500).json({
        success: false,
        error: "Failed to cancel job",
      });
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const websocketService = getWebSocketService();
      const connectedClients =
        websocketService?.getConnectedClientsCount() || 0;
      const connectedUsers = websocketService?.getConnectedUsersCount() || 0;

      res.json({
        success: true,
        data: {
          connectedClients,
          connectedUsers,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Failed to get system stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get system stats",
      });
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      // Only allow cleanup for admin users (you can add role checking here)
      const olderThanHours = parseInt(req.query.hours as string) || 24;

      batchProcessingService.cleanupJobs(olderThanHours);

      res.json({
        success: true,
        message: `Cleaned up jobs older than ${olderThanHours} hours`,
      });
    } catch (error) {
      logger.error("Failed to cleanup jobs:", error);
      res.status(500).json({
        success: false,
        error: "Failed to cleanup jobs",
      });
    }
  }
}
