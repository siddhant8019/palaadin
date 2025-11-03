"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  ModernDataTable,
  IModernColumn,
} from "@/components/table/ModernDataTable";
import { IPerson } from "@/types/company.types";
import { personService } from "@/services/person.service";
import { useAuthStore } from "@/store/auth.store";

function PeopleContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuthStore();
  const [people, setPeople] = useState<IPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState("fullName");

  useEffect(() => {
    const company = searchParams.get("company");
    setCompanyId(company);
    loadPeople(currentPage, itemsPerPage, company);
  }, [currentPage, itemsPerPage, searchParams]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        loadPeople(1, itemsPerPage, companyId);
      } else {
        loadPeople(currentPage, itemsPerPage, companyId);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadPeople = async (
    page: number,
    limit: number,
    company?: string | null
  ): Promise<void> => {
    try {
      setIsLoading(true);
      const filters: any = { page, limit };
      if (company) {
        filters.companyId = company;
      }
      if (searchQuery.trim()) {
        // Use general search instead of field-specific search
        filters.search = searchQuery.trim();
      }
      const result = await personService.getAll(filters);
      setPeople(result.people || []);
      setTotal(result.total || 0);
    } catch (error) {
      setPeople([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push("/login");
  };

  const handleRowEdit = async (
    person: IPerson,
    field: keyof IPerson,
    value: any
  ): Promise<void> => {
    try {
      // Update person in database
      await personService.updatePerson(person.id, { [field]: value });

      // Update local state
      setPeople((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, [field]: value } : p))
      );
    } catch (error) {
      console.error("Failed to update person:", error);
    }
  };

  const handleBulkAction = async (
    action: string,
    selectedPeople: IPerson[]
  ): Promise<void> => {
    try {
      if (action === "delete") {
        // Delete selected people
        for (const person of selectedPeople) {
          await personService.deletePerson(person.id);
        }

        // Refresh data
        await loadPeople(currentPage, itemsPerPage);
      } else if (action === "export") {
        // Export selected people
        const csvContent = [
          "Name,Email,Title,Location,LinkedIn,Source",
          ...selectedPeople.map(
            (person) =>
              `"${person.fullName || ""}","${person.email || ""}","${person.title || ""}","${person.location || ""}","${person.linkedinUrl || ""}","${person.dataSource || ""}"`
          ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `people-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Bulk action failed:", error);
    }
  };

  const columns: IModernColumn<IPerson>[] = [
    {
      key: "fullName",
      header: "Name",
      width: "20%",
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      key: "email",
      header: "Email",
      width: "20%",
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      key: "title",
      header: "Title",
      width: "15%",
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      key: "location",
      header: "Location",
      width: "15%",
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      key: "linkedinUrl",
      header: "LinkedIn",
      width: "20%",
      render: (value) =>
        value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View Profile
          </a>
        ) : (
          "-"
        ),
    },
    {
      key: "dataSource",
      header: "Source",
      width: "10%",
      sortable: true,
      filterable: true,
      render: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          {value}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-800">People</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-secondary text-sm"
            >
              Dashboard
            </button>
            <button onClick={handleLogout} className="btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-neutral-800">
                {companyId ? "Company People" : "All People"}
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                {total} people found
                {companyId && (
                  <span className="ml-2 text-blue-600">
                    (filtered by company)
                  </span>
                )}
                {searchQuery && (
                  <span className="ml-2 text-green-600">
                    (searching: "{searchQuery}")
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {companyId && (
                <button
                  onClick={() => router.push("/people")}
                  className="btn-secondary text-sm"
                >
                  Clear Filter
                </button>
              )}
              <button className="btn-primary text-sm">Add Person</button>
            </div>
          </div>

          {/* Search Filter */}
          <div className="mb-6 p-4 bg-neutral-50 rounded-lg">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Search People
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, title, location, or company..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Searches across all person fields and their company names
                </p>
              </div>
              {searchQuery && (
                <div className="flex items-end">
                  <button
                    onClick={() => setSearchQuery("")}
                    className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 border border-neutral-300 rounded-md hover:bg-neutral-50"
                  >
                    Clear Search
                  </button>
                </div>
              )}
            </div>
          </div>

          <ModernDataTable
            data={people}
            columns={columns}
            onRowClick={(person) => router.push(`/people/${person.id}`)}
            onRowEdit={handleRowEdit}
            onBulkAction={handleBulkAction}
            isLoading={isLoading}
            totalItems={total}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={setItemsPerPage}
            enableSelection={true}
            enableInlineEditing={true}
            enableBulkActions={true}
            enableExport={true}
            enableAdvancedFiltering={true}
          />
        </div>
      </main>
    </div>
  );
}

export default function People(): JSX.Element {
  return (
    <ProtectedRoute>
      <PeopleContent />
    </ProtectedRoute>
  );
}
