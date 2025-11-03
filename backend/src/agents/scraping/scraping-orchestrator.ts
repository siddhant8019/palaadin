import { logger } from "../../utils/logger";
import axios from "axios";
import * as cheerio from "cheerio";

export interface IScrapingJob {
  id: string;
  url: string;
  status:
    | "pending"
    | "analyzing"
    | "implementing"
    | "validating"
    | "completed"
    | "failed";
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
}

export interface IScrapingRequest {
  url: string;
  authentication?: {
    cookies?: string[];
    authToken?: string;
    harFile?: string;
    sessionData?: any;
  };
  maxRetries?: number;
}

export interface IScrapingResponse {
  success: boolean;
  data: any[];
  metadata: {
    jobId: string;
    method: string;
    executionTime: number;
    recordsFound: number;
    confidence: number;
    attempts: number;
  };
  error?: string;
}

export class ScrapingOrchestrator {
  private activeJobs: Map<string, IScrapingJob>;

  constructor() {
    this.activeJobs = new Map();
  }

  async scrapeWebsite(request: IScrapingRequest): Promise<IScrapingResponse> {
    const jobId = this.generateJobId();
    const job: IScrapingJob = {
      id: jobId,
      url: request.url,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      maxAttempts: request.maxRetries || 3,
    };

    this.activeJobs.set(jobId, job);

    try {
      logger.info("Starting scraping job", { jobId, url: request.url });

      job.status = "implementing";
      job.updatedAt = new Date();
      job.attempts = 1;

      // Simple scraping implementation
      const result = await this.performSimpleScraping(
        request.url,
        request.authentication
      );

      job.status = "completed";
      job.updatedAt = new Date();

      logger.info("Scraping job completed", {
        jobId,
        success: result.success,
        recordsFound: result.data.length,
      });

      return {
        success: result.success,
        data: result.data,
        metadata: {
          jobId,
          method: "simple",
          executionTime: Date.now() - job.createdAt.getTime(),
          recordsFound: result.data.length,
          confidence: 85,
          attempts: job.attempts,
        },
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown error";
      job.updatedAt = new Date();

      logger.error("Scraping job failed", { jobId, error: job.error });

      return {
        success: false,
        data: [],
        metadata: {
          jobId,
          method: "simple",
          executionTime: 0,
          recordsFound: 0,
          confidence: 0,
          attempts: job.attempts,
        },
        error: job.error,
      };
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private async performSimpleScraping(
    url: string,
    authOptions?: any
  ): Promise<{ success: boolean; data: any[]; error?: string }> {
    try {
      const headers: any = {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      };

      // Add authentication headers if provided
      if (authOptions?.authToken) {
        headers.Authorization = `Bearer ${authOptions.authToken}`;
      }

      if (authOptions?.cookies) {
        headers.Cookie = authOptions.cookies.join("; ");
      }

      const response = await axios.get(url, {
        timeout: 30000,
        headers,
      });

      const $ = cheerio.load(response.data);
      const companies = this.extractCompanies($);

      return {
        success: true,
        data: companies,
      };
    } catch (error) {
      logger.error("Simple scraping failed", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Scraping failed",
      };
    }
  }

  private extractCompanies($: cheerio.CheerioAPI): any[] {
    const companies: any[] = [];

    // Simple company extraction logic
    $("h1, h2, h3, h4, h5, h6").each((_, element) => {
      const text = $(element).text().trim();
      if (text && text.length > 2 && text.length < 100) {
        // Check if it looks like a company name
        if (this.isValidCompanyName(text)) {
          companies.push({
            name: text,
            source: "scraped",
            extractedAt: new Date().toISOString(),
          });
        }
      }
    });

    // Also check for list items
    $("li, .company, .business, .organization").each((_, element) => {
      const text = $(element).text().trim();
      if (text && text.length > 2 && text.length < 100) {
        if (this.isValidCompanyName(text)) {
          companies.push({
            name: text,
            source: "scraped",
            extractedAt: new Date().toISOString(),
          });
        }
      }
    });

    return companies;
  }

  private isValidCompanyName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 100) return false;

    // Basic validation - not too generic
    const lowerName = name.toLowerCase();
    const genericWords = [
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
    ];

    if (genericWords.includes(lowerName)) return false;
    if (lowerName.includes("login") || lowerName.includes("signup"))
      return false;
    if (lowerName.includes("copyright") || lowerName.includes("privacy"))
      return false;

    return true;
  }

  async scrapeUrl(url: string, authOptions?: any): Promise<any> {
    // Simple method for agent mode - uses direct scraping
    try {
      const request: IScrapingRequest = {
        url,
        authentication: authOptions,
        maxRetries: 1,
      };

      const result = await this.scrapeWebsite(request);
      return result;
    } catch (error) {
      logger.error("Simple scrape failed", error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<IScrapingJob | null> {
    return this.activeJobs.get(jobId) || null;
  }

  async getAllJobs(): Promise<IScrapingJob[]> {
    return Array.from(this.activeJobs.values());
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (job && job.status !== "completed" && job.status !== "failed") {
      job.status = "failed";
      job.error = "Cancelled by user";
      job.updatedAt = new Date();

      logger.info("Job cancelled", { jobId });
      return true;
    }
    return false;
  }

  private generateJobId(): string {
    return `scrape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup(): Promise<void> {
    // Cancel all active jobs
    for (const [jobId, job] of this.activeJobs) {
      if (job.status !== "completed" && job.status !== "failed") {
        job.status = "failed";
        job.error = "System cleanup";
        job.updatedAt = new Date();
      }
    }

    // Clear jobs
    this.activeJobs.clear();

    logger.info("Scraping orchestrator cleaned up");
  }
}

// Export singleton instance
export const scrapingOrchestrator = new ScrapingOrchestrator();
