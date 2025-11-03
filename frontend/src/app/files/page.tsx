"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FileUploadDropzone } from "@/components/file-upload/FileUploadDropzone";
import { FileUploadProgress } from "@/components/file-upload/FileUploadProgress";
import { ProcessingResults } from "@/components/file-upload/ProcessingResults";
import { apiClient } from "@/services/api";

interface UploadedFile {
  file: File;
  id?: string;
  progress: number;
  status: "uploading" | "processing" | "completed" | "failed";
  error?: string;
  result?: any;
}

export default function FilesPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const handleFilesSelected = async (files: File[]) => {
    const newFiles: UploadedFile[] = files.map((file) => ({
      file,
      progress: 0,
      status: "uploading",
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // Upload each file
    for (let i = 0; i < newFiles.length; i++) {
      await uploadFile(newFiles[i], uploadedFiles.length + i);
    }
  };

  const uploadFile = async (fileData: UploadedFile, index: number) => {
    try {
      const formData = new FormData();
      formData.append("file", fileData.file);

      const response = await apiClient.post("/api/files/single", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;

          setUploadedFiles((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], progress };
            return updated;
          });
        },
      });

      if (response.data.success) {
        const fileId = response.data.data.id;
        const fileType = response.data.data.fileType;

        // Update file with ID
        setUploadedFiles((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            id: fileId,
            status: "processing",
            progress: 100,
          };
          return updated;
        });

        // Process the file
        await processFile(fileId, fileType, index);
      }
    } catch (error: any) {
      setUploadedFiles((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: "failed",
          error: error.response?.data?.error || "Upload failed",
        };
        return updated;
      });
    }
  };

  const processFile = async (
    fileId: string,
    fileType: string,
    index: number
  ) => {
    try {
      const endpoint =
        fileType === "har"
          ? `/api/files/${fileId}/process-har`
          : `/api/files/${fileId}/process-excel`;

      const response = await apiClient.post(endpoint, {});

      if (response.data.success) {
        setUploadedFiles((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: "completed",
            result: response.data.data.result,
          };
          return updated;
        });

        setSelectedResult(response.data.data.result);
      }
    } catch (error: any) {
      setUploadedFiles((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: "failed",
          error: error.response?.data?.error || "Processing failed",
        };
        return updated;
      });
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              File Upload & Processing
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Upload Excel, CSV, or HAR files to automatically extract and add
              companies and people to your database
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Upload */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Upload Files
                </h2>
                <FileUploadDropzone onFilesSelected={handleFilesSelected} />
              </div>

              {uploadedFiles.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Upload Progress
                  </h2>
                  <FileUploadProgress
                    files={uploadedFiles.map((f) => ({
                      name: f.file.name,
                      progress: f.progress,
                      status: f.status,
                      error: f.error,
                    }))}
                  />
                </div>
              )}
            </div>

            {/* Right Column - Results */}
            <div>
              {selectedResult && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Processing Results
                  </h2>
                  <ProcessingResults result={selectedResult} />
                </div>
              )}

              {!selectedResult && uploadedFiles.length === 0 && (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <svg
                    className="w-16 h-16 text-gray-300 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-gray-500">
                    Upload a file to see processing results
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Info Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">
                Excel/CSV Files
              </h3>
              <p className="text-sm text-blue-700">
                Upload spreadsheets with company or people data. AI
                automatically maps columns to database fields.
              </p>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-lg p-6">
              <h3 className="font-semibold text-teal-900 mb-2">HAR Files</h3>
              <p className="text-sm text-teal-700">
                Upload browser HTTP archive files. AI extracts data from API
                responses automatically.
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="font-semibold text-orange-900 mb-2">
                Automatic Processing
              </h3>
              <p className="text-sm text-orange-700">
                Files are validated, deduplicated, and integrated into your
                database automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
