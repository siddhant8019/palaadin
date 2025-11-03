import { IBatchJob, IBatchProgress } from "./websocket.service";

export interface IStartBatchJobRequest {
  url: string;
  options?: {
    batchSize?: number;
    maxConcurrent?: number;
    timeout?: number;
    retryAttempts?: number;
  };
}

export interface IStartBatchJobResponse {
  success: boolean;
  data?: {
    jobId: string;
    status: string;
    url: string;
    startTime: string;
  };
  error?: string;
}

export interface IJobStatusResponse {
  success: boolean;
  data?: IBatchJob;
  error?: string;
}

export interface IUserJobsResponse {
  success: boolean;
  data?: IBatchJob[];
  error?: string;
}

export interface ISystemStatsResponse {
  success: boolean;
  data?: {
    connectedClients: number;
    connectedUsers: number;
    timestamp: string;
  };
  error?: string;
}

class BatchProcessingService {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem("token");

    const response = await fetch(`${this.baseUrl}/api/batch${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Start a new batch scraping job
   */
  async startBatchJob(
    request: IStartBatchJobRequest
  ): Promise<IStartBatchJobResponse> {
    return this.makeRequest<IStartBatchJobResponse>("/start", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<IJobStatusResponse> {
    return this.makeRequest<IJobStatusResponse>(`/jobs/${jobId}`);
  }

  /**
   * Get all jobs for the authenticated user
   */
  async getUserJobs(): Promise<IUserJobsResponse> {
    return this.makeRequest<IUserJobsResponse>("/jobs");
  }

  /**
   * Cancel a job
   */
  async cancelJob(
    jobId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.makeRequest(`/jobs/${jobId}`, {
      method: "DELETE",
    });
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<ISystemStatsResponse> {
    return this.makeRequest<ISystemStatsResponse>("/stats");
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(
    hours: number = 24
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.makeRequest("/cleanup", {
      method: "POST",
      body: JSON.stringify({ hours }),
    });
  }
}

// Export singleton instance
export const batchProcessingService = new BatchProcessingService();
