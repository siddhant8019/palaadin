"use client";

interface FileUploadProgressProps {
  files: Array<{
    name: string;
    progress: number;
    status: "uploading" | "processing" | "completed" | "failed";
    error?: string;
  }>;
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  files,
}) => {
  return (
    <div className="space-y-4">
      {files.map((file, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              {file.status === "completed" ? (
                <svg
                  className="w-6 h-6 text-teal-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : file.status === "failed" ? (
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}

              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {file.status === "uploading" && "Uploading..."}
                  {file.status === "processing" && "Processing..."}
                  {file.status === "completed" && "Completed"}
                  {file.status === "failed" && "Failed"}
                </p>
              </div>
            </div>

            <span className="text-sm font-medium text-gray-700">
              {file.progress}%
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                file.status === "completed"
                  ? "bg-teal-500"
                  : file.status === "failed"
                    ? "bg-red-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${file.progress}%` }}
            />
          </div>

          {file.error && (
            <p className="mt-2 text-xs text-red-600">{file.error}</p>
          )}
        </div>
      ))}
    </div>
  );
};
