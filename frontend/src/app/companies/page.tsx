"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  ModernDataTable,
  IModernColumn,
} from "@/components/table/ModernDataTable";
import { ICompany } from "@/types/company.types";
import { companyService } from "@/services/company.service";
import { useAuthStore } from "@/store/auth.store";

function CompaniesContent(): JSX.Element {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState("name");

  useEffect(() => {
    loadCompanies(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        loadCompanies(1, itemsPerPage);
      } else {
        loadCompanies(currentPage, itemsPerPage);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadCompanies = async (page: number, limit: number): Promise<void> => {
    try {
      setIsLoading(true);
      const filters: any = { page, limit };
      if (searchQuery.trim()) {
        // Use general search instead of field-specific search
        filters.search = searchQuery.trim();
      }
      const result = await companyService.getAll(filters);
      setCompanies(result.companies || []);
      setTotal(result.total || 0);
    } catch (error) {
      setCompanies([]);
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
    company: ICompany,
    field: keyof ICompany,
    value: any
  ): Promise<void> => {
    try {
      // Update company in database
      await companyService.updateCompany(company.id, { [field]: value });

      // Update local state
      setCompanies((prev) =>
        prev.map((c) => (c.id === company.id ? { ...c, [field]: value } : c))
      );
    } catch (error) {
      console.error("Failed to update company:", error);
    }
  };

  const handleBulkAction = async (
    action: string,
    selectedCompanies: ICompany[]
  ): Promise<void> => {
    try {
      if (action === "delete") {
        // Delete selected companies
        for (const company of selectedCompanies) {
          await companyService.deleteCompany(company.id);
        }

        // Refresh data
        await loadCompanies(currentPage, itemsPerPage);
      } else if (action === "export") {
        // Export selected companies
        const csvContent = [
          "Name,Industry,Location,Size,Website,Source",
          ...selectedCompanies.map(
            (company) =>
              `"${company.name}","${company.industry || ""}","${company.location || ""}","${company.companySize || ""}","${company.website || ""}","${company.dataSource || ""}"`
          ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `companies-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Bulk action failed:", error);
    }
  };

  const columns: IModernColumn<ICompany>[] = [
    {
      key: "name",
      header: "Company Name",
      width: "20%",
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      key: "industry",
      header: "Industry",
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
      key: "companySize",
      header: "Size",
      width: "10%",
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      key: "website",
      header: "Website",
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
            {value}
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
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {value}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-800">Companies</h1>
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
                All Companies
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                {total} companies found
                {searchQuery && (
                  <span className="ml-2 text-green-600">
                    (searching: "{searchQuery}")
                  </span>
                )}
              </p>
            </div>
            <button className="btn-primary text-sm">Add Company</button>
          </div>

          {/* Search Filter */}
          <div className="mb-6 p-4 bg-neutral-50 rounded-lg">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Search Companies
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, industry, location, description, or website..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Searches across all company fields simultaneously
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
            data={companies}
            columns={columns}
            onRowClick={(company) => router.push(`/companies/${company.id}`)}
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

export default function Companies(): JSX.Element {
  return (
    <ProtectedRoute>
      <CompaniesContent />
    </ProtectedRoute>
  );
}
