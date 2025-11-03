"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  MoreHorizontal,
  Check,
  X,
  ArrowUpDown,
} from "lucide-react";

export interface IModernColumn<T> {
  key: keyof T;
  header: string;
  width?: string;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  cell?: (props: {
    getValue: () => any;
    row: { original: T };
  }) => React.ReactNode;
}

interface IModernDataTableProps<T> {
  data: T[];
  columns: IModernColumn<T>[];
  onRowClick?: (row: T) => void;
  onRowEdit?: (row: T, field: keyof T, value: any) => void;
  onBulkAction?: (action: string, selectedRows: T[]) => void;
  isLoading?: boolean;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  enableSelection?: boolean;
  enableInlineEditing?: boolean;
  enableBulkActions?: boolean;
  enableExport?: boolean;
  enableAdvancedFiltering?: boolean;
  className?: string;
}

export function ModernDataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  onRowEdit,
  onBulkAction,
  isLoading = false,
  totalItems,
  itemsPerPage = 50,
  onPageChange,
  onItemsPerPageChange,
  enableSelection = true,
  enableInlineEditing = true,
  enableBulkActions = true,
  enableExport = true,
  enableAdvancedFiltering = true,
  className = "",
}: IModernDataTableProps<T>): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Create column definitions
  const columnHelper = createColumnHelper<T>();

  const tableColumns: ColumnDef<T>[] = useMemo(() => {
    const cols: ColumnDef<T>[] = [];

    // Add selection column if enabled
    if (enableSelection) {
      cols.push({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="rounded border-gray-300"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-gray-300"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 50,
      });
    }

    // Add data columns
    columns.forEach((col) => {
      cols.push({
        id: String(col.key),
        accessorKey: String(col.key),
        header: ({ column }) => (
          <div className="flex items-center space-x-2">
            <span>{col.header}</span>
            {col.sortable && (
              <button
                onClick={() => column.getToggleSortingHandler()()}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {column.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ArrowUpDown className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        ),
        cell: ({ getValue, row, column }) => {
          const value = getValue();
          const isEditing =
            editingCell?.rowId === row.id &&
            editingCell?.columnId === column.id;

          if (isEditing && enableInlineEditing && col.editable !== false) {
            return (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm"
                  autoFocus
                  onBlur={() => {
                    if (onRowEdit) {
                      onRowEdit(row.original, col.key, editValue);
                    }
                    setEditingCell(null);
                    setEditValue("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (onRowEdit) {
                        onRowEdit(row.original, col.key, editValue);
                      }
                      setEditingCell(null);
                      setEditValue("");
                    } else if (e.key === "Escape") {
                      setEditingCell(null);
                      setEditValue("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (onRowEdit) {
                      onRowEdit(row.original, col.key, editValue);
                    }
                    setEditingCell(null);
                    setEditValue("");
                  }}
                  className="text-green-600 hover:text-green-800"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEditingCell(null);
                    setEditValue("");
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          }

          return (
            <div
              className={`${enableInlineEditing && col.editable !== false ? "cursor-pointer hover:bg-gray-50" : ""}`}
              onDoubleClick={() => {
                if (enableInlineEditing && col.editable !== false) {
                  setEditingCell({ rowId: row.id, columnId: column.id });
                  setEditValue(String(value || ""));
                }
              }}
            >
              {col.render
                ? col.render(value, row.original)
                : col.cell
                  ? col.cell({ getValue, row })
                  : String(value || "-")}
            </div>
          );
        },
        size: col.width ? parseInt(col.width) : 150,
        minSize: col.minWidth || 100,
        maxSize: col.maxWidth || 500,
        enableSorting: col.sortable !== false,
        enableColumnFilter: col.filterable !== false,
      });
    });

    // Add actions column
    cols.push({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onRowClick?.(row.original)}
            className="p-1 text-blue-600 hover:text-blue-800"
            title="View Details"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => onBulkAction?.("delete", [row.original])}
            className="p-1 text-red-600 hover:text-red-800"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      size: 100,
    });

    return cols;
  }, [
    columns,
    enableSelection,
    enableInlineEditing,
    editingCell,
    editValue,
    onRowEdit,
    onRowClick,
    onBulkAction,
  ]);

  // Create table instance
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!totalItems,
    pageCount: totalItems ? Math.ceil(totalItems / itemsPerPage) : -1,
  });

  // Get selected rows
  const selectedRows = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original);

  // Handle bulk actions
  const handleBulkAction = useCallback(
    (action: string) => {
      if (onBulkAction && selectedRows.length > 0) {
        onBulkAction(action, selectedRows);
      }
    },
    [onBulkAction, selectedRows]
  );

  // Handle export
  const handleExport = useCallback(
    (format: "csv" | "excel") => {
      const rows = table.getFilteredRowModel().rows;
      const headers = columns.map((col) => col.header);

      if (format === "csv") {
        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            columns
              .map((col) => {
                const value = row.original[col.key];
                return typeof value === "string" && value.includes(",")
                  ? `"${value}"`
                  : String(value || "");
              })
              .join(",")
          ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [table, columns]
  );

  if (isLoading) {
    return (
      <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-8 text-center text-gray-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          Loading data...
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        {/* Global Search */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search all columns..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {enableAdvancedFiltering && (
            <button className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </button>
          )}
        </div>

        {/* Bulk Actions */}
        {enableBulkActions && selectedRows.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {selectedRows.length} selected
            </span>
            <button
              onClick={() => handleBulkAction("delete")}
              className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              Delete Selected
            </button>
            <button
              onClick={() => handleBulkAction("export")}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Export Selected
            </button>
          </div>
        )}

        {/* Export */}
        {enableExport && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport("csv")}
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50 ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-gray-900"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {table.getRowModel().rows.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <div className="text-lg font-medium mb-2">No data available</div>
            <div className="text-sm">Try adjusting your search or filters</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange?.(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-sm text-gray-700">
            Showing {table.getState().pagination.pageIndex * itemsPerPage + 1}{" "}
            to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * itemsPerPage,
              totalItems || data.length
            )}{" "}
            of {totalItems || data.length} results
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            First
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
