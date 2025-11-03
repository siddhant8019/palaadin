"use client";

import { useRouter } from "next/navigation";
import { DataTable, IColumn } from "@/components/table/DataTable";

interface IResultsDisplayProps {
  answer: string;
  data?:
    | {
        columns: Array<{ key: string; header: string }>;
        rows: unknown[][];
        totalRecords: number;
      }
    | any[]; // Allow direct array for scraping results
  metadata?: {
    resultCount: number;
    queryTime: number;
    dataSource: string;
  };
}

export function ResultsDisplay({
  answer,
  data,
  metadata,
}: IResultsDisplayProps): JSX.Element {
  const router = useRouter();

  const handleRowClick = (item: any) => {
    // Determine if it's a company or person based on available fields
    if (item.id) {
      // Check if it has company-specific fields
      if (item.name && (item.domain || item.industry || item.companySize)) {
        router.push(`/companies/${item.id}`);
      }
      // Check if it has person-specific fields
      else if (item.fullName || item.firstName || item.lastName || item.email) {
        router.push(`/people/${item.id}`);
      }
      // Default to company if we can't determine
      else {
        router.push(`/companies/${item.id}`);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <p className="text-neutral-800">{answer}</p>
        {metadata && (
          <div className="mt-2 flex gap-4 text-xs text-neutral-500">
            <span>{metadata.resultCount} results</span>
            <span>{metadata.queryTime}ms</span>
            <span>Source: {metadata.dataSource}</span>
          </div>
        )}
      </div>

      {data &&
        (data.rows?.length > 0 || (Array.isArray(data) && data.length > 0)) && (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    {/* Handle database results with columns */}
                    {data.columns?.map((column) => (
                      <th
                        key={column.key}
                        className="px-4 py-3 text-left text-sm font-semibold text-neutral-700"
                      >
                        {column.header}
                      </th>
                    ))}
                    {/* Handle scraping results - show object keys as headers */}
                    {Array.isArray(data) &&
                      data.length > 0 &&
                      data[0] &&
                      Object.keys(data[0]).map((key) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-left text-sm font-semibold text-neutral-700"
                        >
                          {key.charAt(0).toUpperCase() +
                            key.slice(1).replace(/([A-Z])/g, " $1")}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Handle database results with rows */}
                  {data.rows?.map((row, rowIndex) => {
                    const rowObject = data.columns?.reduce(
                      (acc, col, idx) => {
                        acc[col.key] = row[idx];
                        return acc;
                      },
                      {} as Record<string, any>
                    );

                    return (
                      <tr
                        key={rowIndex}
                        className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors"
                        onClick={() => handleRowClick(rowObject || {})}
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-4 py-3 text-sm text-neutral-800"
                          >
                            {typeof cell === "string" &&
                            cell.startsWith("http") ? (
                              <a
                                href={cell}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {cell}
                              </a>
                            ) : (
                              String(cell || "-")
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {/* Handle scraping results - direct array */}
                  {Array.isArray(data) &&
                    data.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors"
                        onClick={() => handleRowClick(item)}
                      >
                        {Object.values(item).map((value, valueIndex) => (
                          <td
                            key={valueIndex}
                            className="px-4 py-3 text-sm text-neutral-800"
                          >
                            {typeof value === "string" &&
                            value.startsWith("http") ? (
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {value}
                              </a>
                            ) : (
                              String(value || "-")
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}
