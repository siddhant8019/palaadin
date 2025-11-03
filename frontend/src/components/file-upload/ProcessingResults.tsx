"use client";

interface ProcessingResultsProps {
  result: {
    success: boolean;
    companiesAdded: number;
    peopleAdded: number;
    duplicatesSkipped: number;
    errorsCount: number;
    errors: string[];
    summary: string;
    columnMappings?: Array<{
      excelColumn: string;
      systemField: string;
      confidence: number;
    }>;
    apiEndpoints?: string[];
  };
}

export const ProcessingResults: React.FC<ProcessingResultsProps> = ({
  result,
}) => {
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div
        className={`border-l-4 p-6 rounded-lg ${
          result.success
            ? "bg-teal-50 border-teal-500"
            : "bg-orange-50 border-orange-500"
        }`}
      >
        <div className="flex items-start">
          {result.success ? (
            <svg
              className="w-6 h-6 text-teal-500 mt-0.5"
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
          ) : (
            <svg
              className="w-6 h-6 text-orange-500 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {result.success
                ? "Processing Completed"
                : "Processing Completed with Warnings"}
            </h3>
            <p className="text-sm text-gray-700">{result.summary}</p>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Companies Added</p>
          <p className="text-2xl font-bold text-blue-600">
            {result.companiesAdded}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">People Added</p>
          <p className="text-2xl font-bold text-teal-600">
            {result.peopleAdded}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Duplicates Skipped</p>
          <p className="text-2xl font-bold text-gray-600">
            {result.duplicatesSkipped}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Errors</p>
          <p className="text-2xl font-bold text-red-600">
            {result.errorsCount}
          </p>
        </div>
      </div>

      {/* Column Mappings */}
      {result.columnMappings && result.columnMappings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            Column Mappings (AI-Generated)
          </h4>
          <div className="space-y-2">
            {result.columnMappings.map((mapping, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <span className="text-sm font-medium text-gray-700">
                    {mapping.excelColumn}
                  </span>
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                  <span className="text-sm text-gray-600">
                    {mapping.systemField}
                  </span>
                </div>
                <span className="text-xs font-medium text-blue-600">
                  {mapping.confidence}% confident
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Endpoints */}
      {result.apiEndpoints && result.apiEndpoints.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            API Endpoints Found ({result.apiEndpoints.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {result.apiEndpoints.map((endpoint, index) => (
              <div
                key={index}
                className="p-2 bg-gray-50 rounded text-xs font-mono text-gray-600 break-all"
              >
                {endpoint}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {result.errors && result.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-red-900 mb-4">
            Errors ({result.errors.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {result.errors.map((error, index) => (
              <p key={index} className="text-sm text-red-700">
                {error}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
