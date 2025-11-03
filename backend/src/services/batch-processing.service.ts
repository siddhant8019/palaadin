import { EventEmitter } from "events";
import { logger } from "../utils/logger";
import { ScrapingIntegrationService } from "./scraping-integration.service";
import { CompanyRepository } from "../database/repositories/company.repository";
import { PersonRepository } from "../database/repositories/person.repository";

export interface IBatchJob {
  id: string;
  userId: string;
  url: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  errorCount: number;
  startTime: Date;
  endTime?: Date;
  errors: string[];
  progress: number;
  estimatedTimeRemaining?: number;
}

export interface IBatchProgress {
  jobId: string;
  status: string;
  progress: number;
  processedRecords: number;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  currentUrl?: string;
  estimatedTimeRemaining?: number;
  errors: string[];
}

export class BatchProcessingService extends EventEmitter {
  private activeJobs: Map<string, IBatchJob> = new Map();
  private scrapingService: ScrapingIntegrationService;
  private companyRepository: CompanyRepository;
  private personRepository: PersonRepository;

  constructor() {
    super();
    this.scrapingService = new ScrapingIntegrationService();
    this.companyRepository = new CompanyRepository();
    this.personRepository = new PersonRepository();
  }

  /**
   * Start a batch scraping job for massive data processing
   */
  async startBatchJob(
    userId: string,
    url: string,
    options: {
      batchSize?: number;
      maxConcurrent?: number;
      timeout?: number;
      retryAttempts?: number;
    } = {}
  ): Promise<IBatchJob> {
    const jobId = this.generateJobId();
    const batchSize = options.batchSize || 100;
    const maxConcurrent = options.maxConcurrent || 5;
    const timeout = options.timeout || 300000; // 5 minutes
    const retryAttempts = options.retryAttempts || 3;

    const job: IBatchJob = {
      id: jobId,
      userId,
      url,
      status: "pending",
      totalRecords: 0,
      processedRecords: 0,
      successCount: 0,
      errorCount: 0,
      startTime: new Date(),
      errors: [],
      progress: 0,
    };

    this.activeJobs.set(jobId, job);
    this.emit("jobStarted", job);

    // Start processing in background
    this.processBatchJob(job, {
      batchSize,
      maxConcurrent,
      timeout,
      retryAttempts,
    }).catch((error) => {
      logger.error("Batch job failed:", error);
      job.status = "failed";
      job.endTime = new Date();
      job.errors.push(error.message);
      this.emit("jobFailed", job);
    });

    return job;
  }

  /**
   * Process a batch job with progress tracking
   */
  private async processBatchJob(
    job: IBatchJob,
    options: {
      batchSize: number;
      maxConcurrent: number;
      timeout: number;
      retryAttempts: number;
    }
  ): Promise<void> {
    try {
      job.status = "processing";
      this.emit("jobProgress", this.getJobProgress(job));

      logger.info("Starting batch processing", {
        jobId: job.id,
        url: job.url,
        batchSize: options.batchSize,
      });

      // Step 1: Analyze the website to determine total records
      const analysisResult = await this.analyzeWebsiteForBatch(job.url);
      job.totalRecords = analysisResult.estimatedRecords;
      this.emit("jobProgress", this.getJobProgress(job));

      // Step 2: Process in batches
      const batches = this.createBatches(
        analysisResult.urls,
        options.batchSize
      );

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchStartTime = Date.now();

        logger.info(`Processing batch ${i + 1}/${batches.length}`, {
          jobId: job.id,
          batchSize: batch.length,
        });

        // Process batch concurrently
        const batchPromises = batch.map((url, index) =>
          this.processSingleUrl(job, url, options.retryAttempts)
        );

        await Promise.allSettled(batchPromises);

        // Update progress
        job.processedRecords += batch.length;
        job.progress = Math.round(
          (job.processedRecords / job.totalRecords) * 100
        );

        // Calculate estimated time remaining
        const batchTime = Date.now() - batchStartTime;
        const remainingBatches = batches.length - (i + 1);
        job.estimatedTimeRemaining = Math.round(
          (batchTime * remainingBatches) / 1000
        );

        this.emit("jobProgress", this.getJobProgress(job));

        // Small delay between batches to avoid overwhelming the server
        await this.delay(1000);
      }

      // Step 3: Complete the job
      job.status = "completed";
      job.endTime = new Date();
      this.emit("jobCompleted", job);

      logger.info("Batch job completed", {
        jobId: job.id,
        totalRecords: job.totalRecords,
        successCount: job.successCount,
        errorCount: job.errorCount,
        duration: job.endTime.getTime() - job.startTime.getTime(),
      });
    } catch (error) {
      job.status = "failed";
      job.endTime = new Date();
      job.errors.push(error instanceof Error ? error.message : "Unknown error");
      this.emit("jobFailed", job);
      throw error;
    }
  }

  /**
   * Analyze website to determine total records and create URL list
   */
  private async analyzeWebsiteForBatch(url: string): Promise<{
    estimatedRecords: number;
    urls: string[];
  }> {
    try {
      // This is a simplified version - in reality, you'd use your analysis agent
      // to determine the total number of records and create a list of URLs to process

      // For now, we'll simulate by creating multiple URLs based on pagination
      const urls: string[] = [url];

      // Simulate pagination detection (in reality, this would be done by your analysis agent)
      for (let i = 2; i <= 10; i++) {
        urls.push(`${url}?page=${i}`);
      }

      return {
        estimatedRecords: urls.length * 50, // Assume 50 records per page
        urls,
      };
    } catch (error) {
      logger.error("Failed to analyze website for batch processing:", error);
      throw error;
    }
  }

  /**
   * Create batches from URL list
   */
  private createBatches(urls: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < urls.length; i += batchSize) {
      batches.push(urls.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a single URL with retry logic
   */
  private async processSingleUrl(
    job: IBatchJob,
    url: string,
    retryAttempts: number
  ): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < retryAttempts) {
      try {
        attempts++;

        logger.info(`Processing URL (attempt ${attempts}/${retryAttempts})`, {
          jobId: job.id,
          url,
        });

        const result = await this.scrapingService.scrapeAndIntegrate(url);

        if (result.success) {
          job.successCount += result.companiesAdded + result.peopleAdded;
          logger.info("URL processed successfully", {
            jobId: job.id,
            url,
            companiesAdded: result.companiesAdded,
            peopleAdded: result.peopleAdded,
          });
          return;
        } else {
          throw new Error(result.errors.join(", "));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        logger.warn(
          `URL processing failed (attempt ${attempts}/${retryAttempts})`,
          {
            jobId: job.id,
            url,
            error: lastError.message,
          }
        );

        if (attempts < retryAttempts) {
          // Wait before retry (exponential backoff)
          await this.delay(Math.pow(2, attempts) * 1000);
        }
      }
    }

    // All retry attempts failed
    job.errorCount++;
    job.errors.push(`Failed to process ${url}: ${lastError?.message}`);
    logger.error("URL processing failed after all retry attempts", {
      jobId: job.id,
      url,
      error: lastError?.message,
    });
  }

  /**
   * Get job progress information
   */
  getJobProgress(job: IBatchJob): IBatchProgress {
    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      processedRecords: job.processedRecords,
      totalRecords: job.totalRecords,
      successCount: job.successCount,
      errorCount: job.errorCount,
      estimatedTimeRemaining: job.estimatedTimeRemaining,
      errors: job.errors,
    };
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): IBatchJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all active jobs for a user
   */
  getUserJobs(userId: string): IBatchJob[] {
    return Array.from(this.activeJobs.values()).filter(
      (job) => job.userId === userId
    );
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === "processing") {
      job.status = "failed";
      job.endTime = new Date();
      job.errors.push("Job cancelled by user");
      this.emit("jobCancelled", job);
      return true;
    }
    return false;
  }

  /**
   * Clean up completed jobs older than specified hours
   */
  cleanupJobs(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.endTime &&
        job.endTime < cutoffTime
      ) {
        this.activeJobs.delete(jobId);
        logger.info("Cleaned up old job", { jobId, status: job.status });
      }
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const batchProcessingService = new BatchProcessingService();
