"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { MARKETPLACE_CATEGORIES as COURSE_CATEGORIES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { showError, showSuccess } from "@/lib/toast-helpers";
import {
  BookOpen, Loader2, RefreshCw, Edit3, ExternalLink, Star, Users,
  TrendingUp, CheckCircle2, Search,
} from "lucide-react";

/**
 * CourseManagementPanel — admin view for managing every course in the
 * catalogue (published + unpublished). Replaces the older AdminCoursesPanel
 * inside the admin dashboard.
 *
 * Features:
 *   - Table of all courses with name, category, price, published toggle,
 *     featured toggle, enrollment count, rating, and quick actions.
 *   - Stats at the top: total courses, published count, total enrollments,
 *     average rating.
 *   - Search by name + filter by category.
 *   - Publish/Feature toggles call PUT /api/courses/[id] with the new flag.
 *   - "Edit" links into the CoursePlanner (?view=course-planner).
 *   - "View" opens the public marketplace page (/courses/[id]) in a new tab.
 */

// Marketplace categories — imported from the browser-safe constants file
// (src/lib/constants.ts, line 6). The marketplace lib (src/lib/marketplace.ts)
// also has these but it imports Prisma so it can't run client-side.

function categoryLabel(value: string | undefined | null): string {
  if (!value) return "—";
  const found = COURSE_CATEGORIES.find((c) => c.value === value);
  return found ? found.label : value.replace("-", " ");
}

interface AdminCourse {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  domain?: string;
  level?: string;
  category?: string;
  price?: number;
  currency?: string;
  published?: boolean;
  featured?: boolean;
  enrollmentCount?: number;
  rating?: number;
  reviewCount?: number;
  durationWeeks?: number;
  instructorName?: string | null;
  weeks: Array<{ id: string; weekNumber: number; phase: string; _count?: { days: number }; dayCount?: number }>;
}

interface CoursesResponse {
  courses: AdminCourse[];
}

export function CourseManagementPanel() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.get<CoursesResponse>("/api/courses");
      setCourses(res.courses || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load courses";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Patch a single course field via PUT /api/courses/[id]. Used by the
  // Published/Featured toggles. The PUT endpoint only updates fields that
  // are present in the body, so we can send just `{ published: bool }`.
  const patchCourse = useCallback(
    async (id: string, patch: Partial<Pick<AdminCourse, "published" | "featured">>) => {
      setBusyId(id);
      try {
        await api.put(`/api/courses/${id}`, patch);
        // Optimistic local update so the toggle reflects immediately.
        setCourses((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
        );
        const msg =
          patch.published !== undefined
            ? patch.published
              ? "Course published — visible on marketplace."
              : "Course unpublished — hidden from marketplace."
            : patch.featured !== undefined
            ? patch.featured
              ? "Course featured on landing page."
              : "Course unfeatured."
            : "Updated.";
        showSuccess(msg);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to update course";
        showError(msg);
        // Re-fetch to revert optimistic state if the server rejected it.
        void load();
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  // ---- Derived stats + filtered list ---------------------------------------

  const stats = useMemo(() => {
    const total = courses.length;
    const published = courses.filter((c) => c.published).length;
    const totalEnrollments = courses.reduce((sum, c) => sum + (c.enrollmentCount || 0), 0);
    const ratedCourses = courses.filter((c) => (c.rating || 0) > 0);
    const avgRating =
      ratedCourses.length > 0
        ? ratedCourses.reduce((sum, c) => sum + (c.rating || 0), 0) / ratedCourses.length
        : 0;
    return { total, published, totalEnrollments, avgRating };
  }, [courses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (categoryFilter !== "all" && (c.category || "technology") !== categoryFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.instructorName || "").toLowerCase().includes(q)
      );
    });
  }, [courses, search, categoryFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Course Management
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Publish, feature, and manage every course in the catalogue.
              </CardDescription>
            </div>
            <Button onClick={load} variant="outline" size="sm" className="border-border">
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<BookOpen className="h-4 w-4" />}
          label="Total Courses"
          value={stats.total}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Published"
          value={stats.published}
          accent="text-emerald-500"
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-blue-500" />}
          label="Total Enrollments"
          value={stats.totalEnrollments.toLocaleString()}
        />
        <StatCard
          icon={<Star className="h-4 w-4 text-amber-500" />}
          label="Avg Rating"
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
          accent="text-amber-500"
        />
      </div>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, description, or instructor..."
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {COURSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Course table */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No courses match your filters</p>
            <p className="text-xs text-muted-foreground mt-1">
              {courses.length === 0
                ? "Use the Course Planner to create your first course."
                : "Try clearing the search or category filter."}
            </p>
            {courses.length === 0 && (
              <Button asChild variant="outline" size="sm" className="mt-4 border-border">
                <Link href="/app?view=course-planner">Open Course Planner</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs text-muted-foreground">Course</TableHead>
                  <TableHead className="text-xs text-muted-foreground hidden md:table-cell">Category</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Price</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-center">Published</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-center">Featured</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-center hidden sm:table-cell">Enrollments</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-center hidden lg:table-cell">Rating</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const isFree = (c.price || 0) === 0;
                  return (
                    <TableRow key={c.id} className="border-border hover:bg-muted/40">
                      <TableCell className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground line-clamp-1">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {c.weeks.length} week{c.weeks.length === 1 ? "" : "s"}
                            {c.instructorName ? ` · ${c.instructorName}` : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-[9px] capitalize">
                          {categoryLabel(c.category || c.domain)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        {isFree ? (
                          <span className="text-xs font-medium text-emerald-500">Free</span>
                        ) : (
                          <span className="text-xs font-medium">
                            {c.currency || "USD"} {(c.price || 0).toFixed(0)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={!!c.published}
                            disabled={busyId === c.id}
                            onCheckedChange={(v) => patchCourse(c.id, { published: v })}
                            aria-label={`Toggle published for ${c.name}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={!!c.featured}
                            disabled={busyId === c.id || !c.published}
                            onCheckedChange={(v) => patchCourse(c.id, { featured: v })}
                            aria-label={`Toggle featured for ${c.name}`}
                          />
                        </div>
                        {!c.published && (
                          <p className="text-[9px] text-muted-foreground mt-0.5">publish first</p>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {(c.enrollmentCount || 0).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center hidden lg:table-cell">
                        {(c.rating || 0) > 0 ? (
                          <span className="text-xs inline-flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {(c.rating || 0).toFixed(1)}
                            <span className="text-muted-foreground">({c.reviewCount || 0})</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Edit in Course Planner"
                          >
                            <Link href={`/app?view=course-planner`}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="View on marketplace"
                          >
                            <a href={`/courses/${c.id}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Small presentational helper for the stat cards -----------------------

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Card className="border-border bg-card py-0">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`text-lg font-semibold leading-tight ${accent ?? "text-foreground"}`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
