"use client";

/**
 * StudentsRoster — unified student roster.
 *
 * One roster. Click a row, get a detail panel — no tab-switching to
 * piece a student together.
 *
 * MVP:
 * - Columns: name, current week, last active, progress, attention flags
 * - Filters: struggling academically / overdue / on-track
 * - Click row → opens StudentDetailPanel (existing StudentPortfolioPage)
 */

import { useState, useMemo } from "react";
import type { TeacherStats } from "@/lib/api-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentRow } from "@/components/examiner/instructor/types";

type FilterType = "all" | "struggling_academic" | "overdue" | "ontrack";

interface StudentsRosterProps {
  students: StudentRow[];
  stats?: TeacherStats | null;
  onStudentClick: (student: StudentRow) => void;
}

const FILTER_LABELS: Record<FilterType, string> = {
  all: "All",
  struggling_academic: "Struggling academically",
  overdue: "Overdue for contact",
  ontrack: "On track",
};

export function StudentsRoster({ students, stats, onStudentClick }: StudentsRosterProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const filtered = useMemo(() => {
    let result = students;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }

    // Filter
    switch (filter) {
      case "struggling_academic":
        result = result.filter(s => (s.progress || 0) < 50);
        break;
      case "overdue":
        result = result.filter(s => {
          if (!s.lastActive) return true;
          const days = (Date.now() - new Date(s.lastActive).getTime()) / (1000 * 60 * 60 * 24);
          return days > 3;
        });
        break;
      case "ontrack":
        result = result.filter(s => (s.progress || 0) >= 50);
        break;
    }

    return result;
  }, [students, search, filter]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const hasMore = (page + 1) * pageSize < filtered.length;

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name or email..."
            className="pl-9 bg-background border-border"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(Object.keys(FILTER_LABELS) as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Roster table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No students match this filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Header row */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <div className="col-span-5">Name</div>
                <div className="col-span-2">Week</div>
                <div className="col-span-3">Last Active</div>
                <div className="col-span-2 text-right">Progress</div>
              </div>

              {/* Student rows */}
              {paginated.map(s => (
                <button
                  key={s.id}
                  onClick={() => onStudentClick(s)}
                  className="w-full grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/50 transition-colors text-left items-center"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Week {s.currentWeek}</span>
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <span className="text-xs text-muted-foreground">
                      {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  <div className="col-span-4 sm:col-span-2 flex items-center justify-end gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {s.progress || 0}%
                    </Badge>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              variant="outline"
              size="sm"
              className="border-border"
            >
              Previous
            </Button>
            <Button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              variant="outline"
              size="sm"
              className="border-border"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
