"use client";

import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Inbox } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Button } from "./button";
import { Skeleton } from "./skeleton";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";

/**
 * modules/ui — DataTable (REDESIGN-P2 §1.4, P2 §5 tables column)
 *
 * TanStack Table wrapper with the breakpoint contract baked in:
 *   xs        → renderListRow() stacked rows (ListCard pattern)
 *   md..lg    → compact table, horizontal scroll affordance
 *   lg+       → optional sticky first column
 * Sorting is header-tap; pagination shows only when needed.
 */

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  /** Shown when data is empty and not loading. */
  empty?: ReactNode;
  /** xs degradation — REQUIRED for any table shown to mobile users. */
  renderListRow?: (row: TData, index: number) => ReactNode;
  stickyFirstColumn?: boolean;
  pageSize?: number;
  className?: string;
}

function SortIndicator({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="h-3 w-3" aria-hidden />;
  if (sorted === "desc") return <ArrowDown className="h-3 w-3" aria-hidden />;
  return <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden />;
}

export function DataTable<TData>({
  columns,
  data,
  loading,
  empty,
  renderListRow,
  stickyFirstColumn,
  pageSize = 20,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const sticky = stickyFirstColumn ? "sticky left-0 z-[1] bg-surface" : undefined;

  if (loading) {
    return (
      <div className={cn("space-y-2 rounded-xl border border-line bg-surface p-4", className)} aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={className}>
        {empty ?? <EmptyState icon={Inbox} title="Nothing here yet" description="Data will appear once there's activity." />}
      </div>
    );
  }

  const needsPagination = table.getPageCount() > 1;
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const rangeStart = pageIndex * pageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div data-slot="data-table" className={cn("space-y-3", className)}>
      {/* xs — stacked rows via the ListCard pattern */}
      {renderListRow && <div className="md:hidden">{rows.map((row, i) => renderListRow(row.original, i))}</div>}

      {/* md+ — real table with h-scroll affordance */}
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-line hover:bg-transparent">
                {headerGroup.headers.map((header, colIndex) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap text-2xs font-semibold uppercase tracking-wide text-fg-muted",
                        colIndex === 0 && sticky,
                        canSort && "cursor-pointer select-none"
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={
                        header.column.getIsSorted()
                          ? header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1 py-2.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && <SortIndicator sorted={header.column.getIsSorted()} />}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="border-b border-line/60 last:border-b-0 hover:bg-bg-subtle/60">
                {row.getVisibleCells().map((cell, colIndex) => (
                  <TableCell
                    key={cell.id}
                    className={cn("whitespace-nowrap py-3 text-sm text-fg", colIndex === 0 && sticky)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {needsPagination && (
        <div className="flex items-center justify-between gap-2 text-xs text-fg-muted">
          <span className="tabular-nums">
            {rangeStart}–{rangeEnd} of {totalRows}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-w-9"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-w-9"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
