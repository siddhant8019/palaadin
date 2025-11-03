"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ICompany } from "@/types/company.types";
import { companyService } from "@/services/company.service";

function CompanyDetailContent(): JSX.Element {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [company, setCompany] = useState<ICompany | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompany();
  }, [id]);

  const loadCompany = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await companyService.getById(id);
      setCompany(result);
    } catch (err) {
      setError("Failed to load company details");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const exportCompanyData = (company: ICompany): void => {
    const csvContent = [
      ["Field", "Value"],
      ["Name", company.name || ""],
      ["Industry", company.industry || ""],
      ["Location", company.location || ""],
      ["Website", company.website || ""],
      ["LinkedIn", company.linkedinUrl || ""],
      ["Description", company.description || ""],
      ["Data Source", company.dataSource || ""],
      [
        "Created At",
        company.createdAt ? new Date(company.createdAt).toLocaleString() : "",
      ],
    ]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${company.name?.replace(/[^a-zA-Z0-9]/g, "_") || "company"}_data.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const renderValue = (key: string, value: any): JSX.Element => {
    if (value == null || value === "") return <></>;

    if (
      key.toLowerCase().includes("url") ||
      key.toLowerCase().includes("website") ||
      key.toLowerCase().includes("linkedin") ||
      String(value).startsWith("http")
    ) {
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 text-blue-600 hover:text-blue-700 hover:underline break-all"
        >
          {String(value)}
        </a>
      );
    }

    if (typeof value === "object") {
      return (
        <pre className="mt-1 text-xs text-neutral-800 bg-neutral-50 p-2 rounded overflow-x-auto max-h-40">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    if (typeof value === "boolean") {
      return (
        <span
          className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
        >
          {value ? "Yes" : "No"}
        </span>
      );
    }

    return <p className="mt-1 text-neutral-800 break-words">{String(value)}</p>;
  };

  const formatLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-neutral-600">Loading company details...</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <header className="bg-white border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <button
              onClick={() => router.push("/companies")}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
            >
              ← Back to Companies
            </button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">
              {error || "Company not found"}
            </p>
            <button
              onClick={() => router.push("/companies")}
              className="mt-4 btn-primary"
            >
              Back to Companies
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Exclude system fields
  const excludeFields = [
    "id",
    "isDeleted",
    "createdAt",
    "updatedAt",
    "people",
    "metadata",
  ];
  const standardFields = Object.entries(company as any).filter(
    ([key, value]) =>
      !excludeFields.includes(key) && value != null && value !== ""
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push("/companies")}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-2"
          >
            ← Back to Companies
          </button>
          <h1 className="text-2xl font-bold text-neutral-800">
            {company.name}
          </h1>
          {company.industry && (
            <p className="text-neutral-600 mt-1">{company.industry}</p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* All Available Data Card */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-xl font-semibold text-neutral-800 mb-4">
                Complete Company Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {standardFields.map(([key, value]) => (
                  <div
                    key={key}
                    className={key === "description" ? "md:col-span-2" : ""}
                  >
                    <label className="text-sm font-medium text-neutral-600">
                      {formatLabel(key)}
                    </label>
                    {renderValue(key, value)}
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata / Additional Fields Card */}
            {company.metadata && Object.keys(company.metadata).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                <h2 className="text-xl font-semibold text-neutral-800 mb-4">
                  Additional Data (Apollo & Other Sources)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(company.metadata).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-sm font-medium text-neutral-600">
                        {formatLabel(key)}
                      </label>
                      {renderValue(key, value)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Associated People */}
            {company.people && company.people.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                <h2 className="text-xl font-semibold text-neutral-800 mb-4">
                  Associated People ({company.people.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {company.people.map((person: any) => (
                    <div
                      key={person.id}
                      onClick={() => router.push(`/people/${person.id}`)}
                      className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-neutral-800">
                            {person.fullName ||
                              `${person.firstName} ${person.lastName}`}
                          </p>
                          {person.title && (
                            <p className="text-sm text-neutral-600 mt-1">
                              {person.title}
                            </p>
                          )}
                          {person.email && (
                            <p className="text-sm text-blue-600 mt-1">
                              {person.email}
                            </p>
                          )}
                          {person.phone && (
                            <p className="text-sm text-neutral-500 mt-1">
                              {person.phone}
                            </p>
                          )}
                        </div>
                        <div className="ml-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {person.dataSource || "Unknown"}
                          </span>
                        </div>
                      </div>
                      {person.linkedinUrl && (
                        <div className="mt-2 pt-2 border-t border-neutral-100">
                          <a
                            href={person.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            LinkedIn Profile
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Information Card */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-xl font-semibold text-neutral-800 mb-4">
                System Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-neutral-600">
                    Record ID
                  </label>
                  <p className="mt-1 text-neutral-800 font-mono text-xs">
                    {company.id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-600">
                    Data Source
                  </label>
                  <p className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {company.dataSource}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-600">
                    Added On
                  </label>
                  <p className="mt-1 text-neutral-800">
                    {company.createdAt
                      ? new Date(company.createdAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-600">
                    Last Updated
                  </label>
                  <p className="mt-1 text-neutral-800">
                    {company.updatedAt
                      ? new Date(company.updatedAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-xl font-semibold text-neutral-800 mb-4">
                Quick Actions
              </h2>
              <div className="space-y-2">
                <button
                  onClick={() => router.push(`/companies/${id}/edit`)}
                  className="w-full btn-primary text-sm"
                >
                  Edit Company
                </button>
                <button
                  onClick={() => router.push(`/people?company=${id}`)}
                  className="w-full btn-secondary text-sm"
                >
                  View People
                </button>
                <button
                  onClick={() => exportCompanyData(company)}
                  className="w-full btn-secondary text-sm"
                >
                  Export Data
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(company, null, 2)
                    );
                    alert("Company data copied to clipboard!");
                  }}
                  className="w-full btn-secondary text-sm"
                >
                  Copy as JSON
                </button>
              </div>
            </div>

            {/* Data Summary Card */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <h2 className="text-xl font-semibold text-neutral-800 mb-4">
                Data Summary
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Total Fields:</span>
                  <span className="font-medium">{standardFields.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Additional Data:</span>
                  <span className="font-medium">
                    {company.metadata
                      ? Object.keys(company.metadata).length
                      : 0}{" "}
                    fields
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Associated People:</span>
                  <span className="font-medium">
                    {company.people ? company.people.length : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Contact Info:</span>
                  <span className="font-medium">
                    {
                      [
                        company.website,
                        company.linkedinUrl,
                        company.domain,
                      ].filter(Boolean).length
                    }{" "}
                    available
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CompanyDetail(): JSX.Element {
  return (
    <ProtectedRoute>
      <CompanyDetailContent />
    </ProtectedRoute>
  );
}
