"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  TrendingUp,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { IBatchJob, IBatchProgress } from "@/services/websocket.service";
import { batchProcessingService } from "@/services/batch-processing.service";
import { websocketService } from "@/services/websocket.service";

interface IBatchProgressTrackerProps {
  jobId: string;
  onJobComplete?: (job: IBatchJob) => void;
  onJobFailed?: (job: IBatchJob) => void;
  className?: string;
}

export function BatchProgressTracker({
  jobId,
  onJobComplete,
  onJobFailed,
  className = "",
}: IBatchProgressTrackerProps): JSX.Element {
  const [job, setJob] = useState<IBatchJob | null>(null);
  const [progress, setProgress] = useState<IBatchProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial job data
  useEffect(() => {
    const loadJobData = async () => {
      try {
        setIsLoading(true);
        const response = await batchProcessingService.getJobStatus(jobId);

        if (response.success && response.data) {
          setJob(response.data);
        } else {
          setError(response.error || "Failed to load job data");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    loadJobData();
  }, [jobId]);

  // Setup WebSocket listeners
  useEffect(() => {
    const handleJobProgress = (progressData: IBatchProgress) => {
      if (progressData.jobId === jobId) {
        setProgress(progressData);
      }
    };

    const handleJobCompleted = (data: any) => {
      if (data.jobId === jobId) {
        setJob((prev) =>
          prev
            ? {
                ...prev,
                status: "completed",
                endTime: new Date().toISOString(),
              }
            : null
        );
        onJobComplete?.(job!);
      }
    };

    const handleJobFailed = (data: any) => {
      if (data.jobId === jobId) {
        setJob((prev) =>
          prev
            ? { ...prev, status: "failed", endTime: new Date().toISOString() }
            : null
        );
        onJobFailed?.(job!);
      }
    };

    const handleJobCancelled = (data: any) => {
      if (data.jobId === jobId) {
        setJob((prev) =>
          prev
            ? { ...prev, status: "failed", endTime: new Date().toISOString() }
            : null
        );
      }
    };

    // Subscribe to job updates
    websocketService.subscribeToJob(jobId);
    websocketService.onJobProgress(handleJobProgress);
    websocketService.onJobCompleted(handleJobCompleted);
    websocketService.onJobFailed(handleJobFailed);
    websocketService.onJobCancelled(handleJobCancelled);

    return () => {
      websocketService.unsubscribeFromJob(jobId);
    };
  }, [jobId, onJobComplete, onJobFailed, job]);

  const handleCancelJob = useCallback(async () => {
    try {
      await batchProcessingService.cancelJob(jobId);
    } catch (err) {
      console.error("Failed to cancel job:", err);
    }
  }, [jobId]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "processing":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div
        className={`p-6 bg-white rounded-lg border border-gray-200 ${className}`}
      >
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading job data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-6 bg-white rounded-lg border border-red-200 ${className}`}
      >
        <div className="flex items-center text-red-600">
          <XCircle className="h-5 w-5 mr-2" />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div
        className={`p-6 bg-white rounded-lg border border-gray-200 ${className}`}
      >
        <div className="text-center text-gray-500">Job not found</div>
      </div>
    );
  }

  const currentProgress = progress || {
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

  return (
    <div
      className={`p-6 bg-white rounded-lg border border-gray-200 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon(currentProgress.status)}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Batch Processing Job
            </h3>
            <p className="text-sm text-gray-600">{job.url}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentProgress.status)}`}
          >
            {currentProgress.status.toUpperCase()}
          </span>

          {currentProgress.status === "processing" && (
            <button
              onClick={handleCancelJob}
              className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
            >
              <Square className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">
            {currentProgress.progress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${currentProgress.progress}%` }}
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Database className="h-4 w-4 text-blue-500 mr-1" />
            <span className="text-sm text-gray-600">Total Records</span>
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {currentProgress.totalRecords.toLocaleString()}
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-gray-600">Processed</span>
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {currentProgress.processedRecords.toLocaleString()}
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-gray-600">Success</span>
          </div>
          <div className="text-lg font-semibold text-green-600">
            {currentProgress.successCount.toLocaleString()}
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <XCircle className="h-4 w-4 text-red-500 mr-1" />
            <span className="text-sm text-gray-600">Errors</span>
          </div>
          <div className="text-lg font-semibold text-red-600">
            {currentProgress.errorCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Time Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm text-gray-600 mb-1">Start Time</div>
          <div className="text-sm font-medium text-gray-900">
            {new Date(job.startTime).toLocaleString()}
          </div>
        </div>

        {job.endTime && (
          <div>
            <div className="text-sm text-gray-600 mb-1">End Time</div>
            <div className="text-sm font-medium text-gray-900">
              {new Date(job.endTime).toLocaleString()}
            </div>
          </div>
        )}

        {currentProgress.estimatedTimeRemaining &&
          currentProgress.status === "processing" && (
            <div>
              <div className="text-sm text-gray-600 mb-1">
                Estimated Time Remaining
              </div>
              <div className="text-sm font-medium text-gray-900">
                {formatTimeRemaining(currentProgress.estimatedTimeRemaining)}
              </div>
            </div>
          )}

        {job.endTime && (
          <div>
            <div className="text-sm text-gray-600 mb-1">Duration</div>
            <div className="text-sm font-medium text-gray-900">
              {formatDuration(
                new Date(job.endTime).getTime() -
                  new Date(job.startTime).getTime()
              )}
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {currentProgress.errors.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium text-red-600 mb-2">
            Errors ({currentProgress.errors.length})
          </div>
          <div className="max-h-32 overflow-y-auto">
            {currentProgress.errors.slice(0, 5).map((error, index) => (
              <div
                key={index}
                className="text-xs text-red-600 mb-1 p-2 bg-red-50 rounded"
              >
                {error}
              </div>
            ))}
            {currentProgress.errors.length > 5 && (
              <div className="text-xs text-gray-500">
                ... and {currentProgress.errors.length - 5} more errors
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
