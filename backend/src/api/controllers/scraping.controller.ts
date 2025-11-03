import { Request, Response } from "express";
import { scrapingOrchestrator } from "../../agents/scraping";
import { logger } from "../../utils/logger";
import { ValidationError } from "../../utils/errors";
import { z } from "zod";

const ScrapingRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
  options: z
    .object({
      maxRetries: z.number().min(1).max(5).optional(),
      timeout: z.number().min(5000).max(120000).optional(),
      waitForSelector: z.string().optional(),
      extractPattern: z.string().optional(),
      pagination: z.boolean().optional(),
      authentication: z
        .object({
          username: z.string(),
          password: z.string(),
          loginUrl: z.string().url(),
        })
        .optional(),
    })
    .optional(),
  criteria: z
    .object({
      expectedDataTypes: z.array(z.string()).optional(),
      minimumRecords: z.number().min(0).optional(),
      requiredFields: z.array(z.string()).optional(),
      dataPatterns: z.array(z.string()).optional(),
      qualityThreshold: z.number().min(0).max(100).optional(),
    })
    .optional(),
  maxRetries: z.number().min(1).max(5).optional(),
});

export const scrapeWebsite = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Validate request
    const validationResult = ScrapingRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        "Invalid scraping request",
        validationResult.error.errors
      );
    }

    const { url, options, criteria, maxRetries } = validationResult.data;

    logger.info("Scraping request received", { userId, url });

    // Execute scraping
    const result = await scrapingOrchestrator.scrapeWebsite({
      url,
      options,
      criteria,
      maxRetries,
    });

    logger.info("Scraping completed", {
      userId,
      url,
      success: result.success,
      recordsFound: result.metadata.recordsFound,
      method: result.metadata.method,
      attempts: result.metadata.attempts,
    });

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result.data,
      metadata: result.metadata,
      analysis: result.analysis,
      validation: result.validation,
      error: result.error,
    });
  } catch (error) {
    logger.error("Scraping controller error:", error);

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const getScrapingJobStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { jobId } = req.params;

    const job = await scrapingOrchestrator.getJobStatus(jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json({
      id: job.id,
      url: job.url,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: job.error,
      analysis: job.analysis,
      result: job.result,
      validation: job.validation,
    });
  } catch (error) {
    logger.error("Get job status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getAllScrapingJobs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const jobs = await scrapingOrchestrator.getAllJobs();

    res.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        url: job.url,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error: job.error,
      })),
      total: jobs.length,
    });
  } catch (error) {
    logger.error("Get all jobs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const cancelScrapingJob = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { jobId } = req.params;

    const cancelled = await scrapingOrchestrator.cancelJob(jobId);
    if (!cancelled) {
      res.status(404).json({ error: "Job not found or cannot be cancelled" });
      return;
    }

    res.json({ success: true, message: "Job cancelled successfully" });
  } catch (error) {
    logger.error("Cancel job error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
