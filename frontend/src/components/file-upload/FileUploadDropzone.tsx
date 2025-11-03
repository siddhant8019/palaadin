"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface FileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  acceptedFileTypes?: string[];
}

export const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({
  onFilesSelected,
  maxFiles = 5,
  maxSize = 50 * 1024 * 1024, // 50MB
  acceptedFileTypes = [".xlsx", ".xls", ".csv", ".json", ".har"],
}) => {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === "file-too-large") {
          setError(
            `File is too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
          );
        } else if (rejection.errors[0]?.code === "file-invalid-type") {
          setError(
            `Invalid file type. Accepted: ${acceptedFileTypes.join(", ")}`
          );
        } else {
          setError("File rejected. Please check file requirements.");
        }
        return;
      }

      if (acceptedFiles.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      onFilesSelected(acceptedFiles);
    },
    [onFilesSelected, maxFiles, maxSize, acceptedFileTypes]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      maxFiles,
      maxSize,
      accept: {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
          ".xlsx",
        ],
        "application/vnd.ms-excel": [".xls"],
        "text/csv": [".csv"],
        "application/json": [".json", ".har"],
      },
    });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragActive && !isDragReject
              ? "border-blue-500 bg-blue-50"
              : isDragReject
                ? "border-red-500 bg-red-50"
                : "border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50"
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center space-y-4">
          <svg
            className={`w-16 h-16 ${
              isDragActive ? "text-blue-500" : "text-gray-400"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {isDragActive ? (
            <p className="text-lg font-medium text-blue-600">
              Drop files here...
            </p>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-700">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                Supports Excel (.xlsx, .xls), CSV (.csv), and HAR (.json, .har)
                files
              </p>
              <p className="text-xs text-gray-400">
                Maximum {maxFiles} files, {maxSize / (1024 * 1024)}MB each
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};
