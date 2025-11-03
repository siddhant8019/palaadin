"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { BatchProgressTracker } from "@/components/batch-processing/BatchProgressTracker";
import { batchProcessingService } from "@/services/batch-processing.service";
import { IBatchJob } from "@/services/websocket.service";
import { useAuthStore } from "@/store/auth.store";
import {
  Play,
  Database,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

function BatchProcessingContent(): JSX.Element {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [jobs, setJobs] = useState<IBatchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [showStartForm, setShowStartForm] = useState(false);
  const [newJobUrl, setNewJobUrl] = useState("");
  const [newJobOptions, setNewJobOptions] = useState({
    batchSize: 100,
    maxConcurrent: 5,
    timeout: 300000,
    retryAttempts: 3,
  });

  useEffect(() => {
    loadUserJobs();
  }, []);

  const loadUserJobs = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await batchProcessingService.getUserJobs();

      if (response.success && response.data) {
        setJobs(response.data);
      }
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartJob = async (): Promise<void> => {
    if (!newJobUrl.trim()) {
      alert("Please enter a URL");
      return;
    }

    try {
      setIsStartingJob(true);
      const response = await batchProcessingService.startBatchJob({
        url: newJobUrl.trim(),
        options: newJobOptions,
      });

      if (response.success && response.data) {
        setNewJobUrl("");
        setShowStartForm(false);
        await loadUserJobs(); // Refresh jobs list
      } else {
        alert(response.error || "Failed to start job");
      }
    } catch (error) {
      console.error("Failed to start job:", error);
      alert("Failed to start job");
    } finally {
      setIsStartingJob(false);
    }
  };

  const handleCancelJob = async (jobId: string): Promise<void> => {
    try {
      await batchProcessingService.cancelJob(jobId);
      await loadUserJobs(); // Refresh jobs list
    } catch (error) {
      console.error("Failed to cancel job:", error);
      alert("Failed to cancel job");
    }
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push("/login");
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

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startTime: string, endTime?: string): string => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = end - start;

    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Batch Processing</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowStartForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Start New Job</span>
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-red-600 hover:text-red-800 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Start New Job Form */}
        {showStartForm && (
          <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Start New Batch Job
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  value={newJobUrl}
                  onChange={(e) => setNewJobUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Size
                  </label>
                  <input
                    type="number"
                    value={newJobOptions.batchSize}
                    onChange={(e) =>
                      setNewJobOptions((prev) => ({
                        ...prev,
                        batchSize: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Concurrent
                  </label>
                  <input
                    type="number"
                    value={newJobOptions.maxConcurrent}
                    onChange={(e) =>
                      setNewJobOptions((prev) => ({
                        ...prev,
                        maxConcurrent: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={handleStartJob}
                  disabled={isStartingJob}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStartingJob ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  <span>{isStartingJob ? "Starting..." : "Start Job"}</span>
                </button>

                <button
                  onClick={() => setShowStartForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Batch Jobs
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No batch jobs found</p>
              <p className="text-sm">
                Start a new job to begin processing large datasets
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-lg border border-gray-200 p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Job #{job.id.split("_")[1]}
                        </h3>
                        <p className="text-sm text-gray-600 truncate max-w-md">
                          {job.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}
                      >
                        {job.status.toUpperCase()}
                      </span>

                      {job.status === "processing" && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Progress
                      </span>
                      <span className="text-sm text-gray-600">
                        {job.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-1">
                        Total Records
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {job.totalRecords.toLocaleString()}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-1">
                        Processed
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {job.processedRecords.toLocaleString()}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-1">Success</div>
                      <div className="text-lg font-semibold text-green-600">
                        {job.successCount.toLocaleString()}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-1">Errors</div>
                      <div className="text-lg font-semibold text-red-600">
                        {job.errorCount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Time Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">
                        Start Time
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(job.startTime)}
                      </div>
                    </div>

                    {job.endTime && (
                      <div>
                        <div className="text-sm text-gray-600 mb-1">
                          End Time
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatDate(job.endTime)}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-sm text-gray-600 mb-1">Duration</div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatDuration(job.startTime, job.endTime)}
                      </div>
                    </div>

                    {job.estimatedTimeRemaining &&
                      job.status === "processing" && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1">
                            Estimated Time Remaining
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {Math.floor(job.estimatedTimeRemaining / 60)}m{" "}
                            {job.estimatedTimeRemaining % 60}s
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Real-time Progress Tracker */}
                  {job.status === "processing" && (
                    <div className="mt-4">
                      <BatchProgressTracker
                        jobId={job.id}
                        onJobComplete={() => loadUserJobs()}
                        onJobFailed={() => loadUserJobs()}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function BatchProcessing(): JSX.Element {
  return (
    <ProtectedRoute>
      <BatchProcessingContent />
    </ProtectedRoute>
  );
}
