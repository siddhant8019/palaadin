"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { IPerson } from "@/types/person.types";
import { personService } from "@/services/person.service";

function PersonDetailContent(): JSX.Element {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [person, setPerson] = useState<IPerson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPerson();
  }, [id]);

  const loadPerson = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await personService.getById(id);
      setPerson(result);
    } catch (err) {
      setError("Failed to load person details");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const exportPersonData = (person: IPerson): void => {
    const csvContent = [
      ["Field", "Value"],
      ["Full Name", person.fullName || ""],
      ["First Name", person.firstName || ""],
      ["Last Name", person.lastName || ""],
      ["Email", person.email || ""],
      ["Title", person.title || ""],
      ["Phone", person.phone || ""],
      ["Location", person.location || ""],
      ["LinkedIn", person.linkedinUrl || ""],
      ["Bio", person.bio || ""],
      ["Company", person.company?.name || ""],
      ["Data Source", person.dataSource || ""],
      [
        "Created At",
        person.createdAt ? new Date(person.createdAt).toLocaleString() : "",
      ],
    ]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${person.fullName?.replace(/[^a-zA-Z0-9]/g, "_") || "person"}_data.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const renderValue = (key: string, value: any): JSX.Element => {
    if (value == null || value === "") return <></>;

    if (key === "email") {
      return (
        <a
          href={`mailto:${value}`}
          className="block mt-1 text-blue-600 hover:text-blue-700 hover:underline break-all"
        >
          {String(value)}
        </a>
      );
    }

    if (key === "phone") {
      return (
        <a
          href={`tel:${value}`}
          className="block mt-1 text-blue-600 hover:text-blue-700 hover:underline"
        >
          {String(value)}
        </a>
      );
    }

    if (
      key.toLowerCase().includes("url") ||
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
          <p className="mt-4 text-neutral-600">Loading person details...</p>
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <header className="bg-white border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <button
              onClick={() => router.push("/people")}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
            >
              ← Back to People
            </button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">
              {error || "Person not found"}
            </p>
            <button
              onClick={() => router.push("/people")}
              className="mt-4 btn-primary"
            >
              Back to People
            </button>
          </div>
        </main>
      </div>
    );
  }

  const fullName =
    person.fullName ||
    `${person.firstName || ""} ${person.lastName || ""}`.trim() ||
    "No Name";

  // Exclude system fields
  const excludeFields = [
    "id",
    "isDeleted",
    "createdAt",
    "updatedAt",
    "company",
    "metadata",
    "companyId",
  ];
  const standardFields = Object.entries(person as any).filter(
    ([key, value]) =>
      !excludeFields.includes(key) && value != null && value !== ""
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push("/people")}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-2"
          >
            ← Back to People
          </button>
          <h1 className="text-2xl font-bold text-neutral-800">{fullName}</h1>
          {person.title && (
            <p className="text-neutral-600 mt-1">{person.title}</p>
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
                Complete Profile Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {standardFields.map(([key, value]) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-neutral-600">
                      {formatLabel(key)}
                    </label>
                    {renderValue(key, value)}
                  </div>
                ))}
              </div>
            </div>

            {/* Company Information Card */}
            {person.company && (
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                <h2 className="text-xl font-semibold text-neutral-800 mb-4">
                  Company Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-600">
                      Company Name
                    </label>
                    <p className="mt-1 text-neutral-800 font-medium">
                      {person.company.name}
                    </p>
                  </div>
                  {person.company.industry && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">
                        Industry
                      </label>
                      <p className="mt-1 text-neutral-800">
                        {person.company.industry}
                      </p>
                    </div>
                  )}
                  {person.company.location && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">
                        Location
                      </label>
                      <p className="mt-1 text-neutral-800">
                        {person.company.location}
                      </p>
                    </div>
                  )}
                  {person.company.website && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">
                        Website
                      </label>
                      <p className="mt-1">
                        <a
                          href={person.company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {person.company.website}
                        </a>
                      </p>
                    </div>
                  )}
                  {person.company.linkedinUrl && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">
                        LinkedIn
                      </label>
                      <p className="mt-1">
                        <a
                          href={person.company.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {person.company.linkedinUrl}
                        </a>
                      </p>
                    </div>
                  )}
                  {person.company.description && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-neutral-600">
                        Description
                      </label>
                      <p className="mt-1 text-neutral-800">
                        {person.company.description}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <button
                    onClick={() =>
                      router.push(`/companies/${person.company.id}`)
                    }
                    className="btn-primary text-sm"
                  >
                    View Full Company Profile
                  </button>
                </div>
              </div>
            )}

            {/* Metadata / Additional Fields Card */}
            {person.metadata && Object.keys(person.metadata).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                <h2 className="text-xl font-semibold text-neutral-800 mb-4">
                  Additional Data (Apollo & Other Sources)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(person.metadata).map(([key, value]) => (
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
                    {person.id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-600">
                    Data Source
                  </label>
                  <p className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {person.dataSource}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-600">
                    Added On
                  </label>
                  <p className="mt-1 text-neutral-800">
                    {person.createdAt
                      ? new Date(person.createdAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-600">
                    Last Updated
                  </label>
                  <p className="mt-1 text-neutral-800">
                    {person.updatedAt
                      ? new Date(person.updatedAt).toLocaleString()
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
                  onClick={() => router.push(`/people/${id}/edit`)}
                  className="w-full btn-primary text-sm"
                >
                  Edit Person
                </button>
                {person.companyId && (
                  <button
                    onClick={() =>
                      router.push(`/companies/${person.companyId}`)
                    }
                    className="w-full btn-secondary text-sm"
                  >
                    View Company
                  </button>
                )}
                <button
                  onClick={() => exportPersonData(person)}
                  className="w-full btn-secondary text-sm"
                >
                  Export Data
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(person, null, 2)
                    );
                    alert("Person data copied to clipboard!");
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
                    {person.metadata ? Object.keys(person.metadata).length : 0}{" "}
                    fields
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Contact Info:</span>
                  <span className="font-medium">
                    {
                      [person.email, person.phone, person.linkedinUrl].filter(
                        Boolean
                      ).length
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

export default function PersonDetail(): JSX.Element {
  return (
    <ProtectedRoute>
      <PersonDetailContent />
    </ProtectedRoute>
  );
}
