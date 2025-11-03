import Bull, { Queue, Job, JobOptions } from "bull";
import { logger } from "@/utils/logger";

/**
 * Job types for different background processes
 */
export enum JobType {
  SCRAPING = "scraping",
  FILE_PROCESSING = "file-processing",
  DATA_ENRICHMENT = "data-enrichment",
  EMAIL_NOTIFICATION = "email-notification",
  BATCH_IMPORT = "batch-import",
  CLEANUP = "cleanup",
}

/**
 * Job data interfaces
 */
export interface ScrapingJobData {
  url: string;
  userId: string;
  strategy?: string;
  options?: Record<string, any>;
}

export interface FileProcessingJobData {
  fileId: string;
  userId: string;
  fileType: string;
  filePath: string;
  options?: Record<string, any>;
}

export interface DataEnrichmentJobData {
  entityType: "person" | "company";
  entityId: string;
  source: string;
}

export interface BatchImportJobData {
  data: Array<Record<string, any>>;
  type: "companies" | "people";
  userId: string;
}

/**
 * Queue Service for managing background jobs with Bull
 */
export class QueueService {
  private static instance: QueueService;
  private queues: Map<JobType, Queue> = new Map();
  private readonly redisUrl: string;

  private constructor() {
    this.redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.initializeQueues();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Initialize all queues
   */
  private initializeQueues(): void {
    // Scraping queue
    this.createQueue(JobType.SCRAPING, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200, // Keep last 200 failed jobs
      },
    });

    // File processing queue
    this.createQueue(JobType.FILE_PROCESSING, {
      defaultJobOptions: {
        attempts: 2,
        timeout: 300000, // 5 minutes
      },
    });

    // Data enrichment queue
    this.createQueue(JobType.DATA_ENRICHMENT, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "fixed",
          delay: 5000,
        },
      },
    });

    // Email notification queue
    this.createQueue(JobType.EMAIL_NOTIFICATION, {
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        priority: 1, // Higher priority
      },
    });

    // Batch import queue
    this.createQueue(JobType.BATCH_IMPORT, {
      defaultJobOptions: {
        attempts: 1,
        timeout: 600000, // 10 minutes
      },
    });

    // Cleanup queue
    this.createQueue(JobType.CLEANUP, {
      defaultJobOptions: {
        attempts: 1,
        repeat: {
          cron: "0 2 * * *", // Run daily at 2 AM
        },
      },
    });

    logger.info("All job queues initialized");
  }

  /**
   * Create a queue
   */
  private createQueue(
    type: JobType,
    options?: {
      defaultJobOptions?: JobOptions;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Queue {
    const queue = new Bull(type, this.redisUrl, {
      defaultJobOptions: options?.defaultJobOptions,
      limiter: options?.limiter,
    });

    // Event listeners
    queue.on("error", (error: Error) => {
      logger.error(`Queue ${type} error:`, error);
    });

    queue.on("waiting", (jobId: string) => {
      logger.debug(`Job ${jobId} waiting in queue ${type}`);
    });

    queue.on("active", (job: Job) => {
      logger.info(`Job ${job.id} started processing in queue ${type}`);
    });

    queue.on("completed", (job: Job, result: any) => {
      logger.info(`Job ${job.id} completed in queue ${type}`, {
        duration: Date.now() - job.processedOn!,
      });
    });

    queue.on("failed", (job: Job, err: Error) => {
      logger.error(`Job ${job.id} failed in queue ${type}:`, {
        error: err.message,
        attempts: job.attemptsMade,
      });
    });

    queue.on("stalled", (job: Job) => {
      logger.warn(`Job ${job.id} stalled in queue ${type}`);
    });

    this.queues.set(type, queue);
    logger.info(`Queue ${type} created`);

    return queue;
  }

  /**
   * Get queue by type
   */
  getQueue(type: JobType): Queue {
    const queue = this.queues.get(type);
    
    if (!queue) {
      throw new Error(`Queue ${type} not found`);
    }

    return queue;
  }

  /**
   * Add job to queue
   */
  async addJob<T>(
    type: JobType,
    data: T,
    options?: JobOptions
  ): Promise<Job<T>> {
    const queue = this.getQueue(type);
    const job = await queue.add(data, options);

    logger.info(`Job ${job.id} added to queue ${type}`);
    return job;
  }

  /**
   * Add scraping job
   */
  async addScrapingJob(
    data: ScrapingJobData,
    options?: JobOptions
  ): Promise<Job<ScrapingJobData>> {
    return this.addJob(JobType.SCRAPING, data, {
      ...options,
      priority: options?.priority || 2,
    });
  }

  /**
   * Add file processing job
   */
  async addFileProcessingJob(
    data: FileProcessingJobData,
    options?: JobOptions
  ): Promise<Job<FileProcessingJobData>> {
    return this.addJob(JobType.FILE_PROCESSING, data, options);
  }

  /**
   * Add data enrichment job
   */
  async addDataEnrichmentJob(
    data: DataEnrichmentJobData,
    options?: JobOptions
  ): Promise<Job<DataEnrichmentJobData>> {
    return this.addJob(JobType.DATA_ENRICHMENT, data, {
      ...options,
      priority: options?.priority || 3,
    });
  }

  /**
   * Add batch import job
   */
  async addBatchImportJob(
    data: BatchImportJobData,
    options?: JobOptions
  ): Promise<Job<BatchImportJobData>> {
    return this.addJob(JobType.BATCH_IMPORT, data, options);
  }

  /**
   * Get job by ID
   */
  async getJob(type: JobType, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(type);
    return queue.getJob(jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(type: JobType, jobId: string): Promise<{
    state: string;
    progress: number;
    data: any;
    result?: any;
    failedReason?: string;
    attemptsMade: number;
  } | null> {
    const job = await this.getJob(type, jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = await job.progress();

    return {
      state,
      progress: typeof progress === "number" ? progress : 0,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
    };
  }

  /**
   * Cancel job
   */
  async cancelJob(type: JobType, jobId: string): Promise<boolean> {
    const job = await this.getJob(type, jobId);
    
    if (!job) {
      return false;
    }

    await job.remove();
    logger.info(`Job ${jobId} cancelled from queue ${type}`);
    
    return true;
  }

  /**
   * Retry failed job
   */
  async retryJob(type: JobType, jobId: string): Promise<boolean> {
    const job = await this.getJob(type, jobId);
    
    if (!job) {
      return false;
    }

    await job.retry();
    logger.info(`Job ${jobId} retried in queue ${type}`);
    
    return true;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(type: JobType): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.getQueue(type);

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getPausedCount(),
    ]);

    return { waiting, active, completed, failed, delayed, paused };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<Record<JobType, any>> {
    const stats: any = {};

    for (const type of Object.values(JobType)) {
      stats[type] = await this.getQueueStats(type as JobType);
    }

    return stats;
  }

  /**
   * Pause queue
   */
  async pauseQueue(type: JobType): Promise<void> {
    const queue = this.getQueue(type);
    await queue.pause();
    
    logger.info(`Queue ${type} paused`);
  }

  /**
   * Resume queue
   */
  async resumeQueue(type: JobType): Promise<void> {
    const queue = this.getQueue(type);
    await queue.resume();
    
    logger.info(`Queue ${type} resumed`);
  }

  /**
   * Clean queue (remove old jobs)
   */
  async cleanQueue(
    type: JobType,
    grace: number = 86400000, // 24 hours
    status: "completed" | "failed" = "completed"
  ): Promise<number> {
    const queue = this.getQueue(type);
    const jobs = await queue.clean(grace, status);
    
    logger.info(`Cleaned ${jobs.length} ${status} jobs from queue ${type}`);
    return jobs.length;
  }

  /**
   * Empty queue (remove all jobs)
   */
  async emptyQueue(type: JobType): Promise<void> {
    const queue = this.getQueue(type);
    await queue.empty();
    
    logger.warn(`Queue ${type} emptied`);
  }

  /**
   * Close all queues
   */
  async closeAll(): Promise<void> {
    for (const [type, queue] of this.queues.entries()) {
      await queue.close();
      logger.info(`Queue ${type} closed`);
    }
    
    this.queues.clear();
  }
}

// Export singleton instance
export const queueService = QueueService.getInstance();

