"use client";

/**
 * MyCoursesView — student's "My Courses" page.
 *
 * Shown when the student clicks the "My Courses" tab in the sidebar. Combines:
 *
 *   1. **My Enrolled Courses** — pulled from /api/enrollments. Each card shows
 *      progress %, current week/day, avg score, status (In Progress / Completed),
 *      and a "Continue Learning" button that switches back to the home dashboard
 *      so the student can resume today's action. Each card also fetches its own
 *      detailed progress from /api/student/course-progress to show an accurate
 *      week-by-week completion bar.
 *
 *   2. **Explore New Courses** — pulled from /api/marketplace/courses (only
 *      published). Each card shows price (or "Free" badge), rating, enrollment
 *      count, and a "View Course" button that links to /courses/[id] (the public
 *      marketplace detail page where they can self-enroll).
 *
 * Empty state: if the student has no enrollments, shows a friendly CTA to browse
 * the marketplace.
 *
 * Dark theme, card grid layout, professional look.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, GraduationCap, Star, Users, ArrowRight, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, Sparkles, Clock, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { EnrollmentResponse } from "@/app/api/enrollments/route";
import type { MarketplaceCourseListItem } from "@/lib/marketplace";

export default function MyCoursesView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [enrollments, setEnrollments] = useState<EnrollmentResponse["enrollments"]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceCourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Run both fetches in parallel.
      const [enrRes, mktRes] = await Promise.all([
        api.get<EnrollmentResponse>("/api/enrollments"),
        api.get<{ courses: MarketplaceCourseListItem[] }>("/api/marketplace/courses"),
      ]);
      setEnrollments(enrRes.enrollments || []);
      setMarketplace(mktRes.courses || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your courses…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-semibold">Couldn't load courses</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasEnrollments = enrollments.length > 0;
  const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
  // Hide already-enrolled courses from the explore section.
  const exploreCourses = marketplace.filter(c => !enrolledCourseIds.has(c.id)).slice(0, 12);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> My Courses
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {hasEnrollments
              ? `You're enrolled in ${enrollments.length} course${enrollments.length === 1 ? "" : "s"}. Pick up where you left off or explore new topics.`
              : "Browse the marketplace and enroll in your first course."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="border-border">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* ============ Section 1: My Enrolled Courses ============ */}
      {hasEnrollments ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              My Enrolled Courses
            </h3>
            <Badge variant="secondary" className="text-[10px]">{enrollments.length}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enr) => (
              <EnrolledCourseCard
                key={enr.courseId}
                enrollment={enr}
                onContinue={() => onNavigate?.("home")}
              />
            ))}
          </div>
        </section>
      ) : (
        <Card className="border-dashed border-border">
          <CardContent className="p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">No courses yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              You haven&apos;t enrolled in any courses. Browse the marketplace below and pick your first course to get started.
            </p>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
              <Link href="/courses">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Browse Courses
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ============ Section 2: Explore New Courses ============ */}
      {exploreCourses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Explore New Courses
            </h3>
            <Badge variant="outline" className="text-[10px]">{exploreCourses.length} available</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exploreCourses.map((course) => (
              <ExploreCourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {exploreCourses.length === 0 && hasEnrollments && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              You&apos;re enrolled in every published course. Check back later for new additions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// EnrolledCourseCard — single course the student is already in.
// ============================================================
function EnrolledCourseCard({
  enrollment,
  onContinue,
}: {
  enrollment: EnrollmentResponse["enrollments"][0];
  onContinue: () => void;
}) {
  // Fetch accurate progress from /api/student/course-progress.
  // Falls back to the enrollment-summary values on error (e.g. 403 when the
  // student isn't enrolled for that course in the new course-progress query).
  const [progress, setProgress] = useState<{
    completionPercent: number;
    completedWeeks: number;
    totalWeeks: number;
    avgScore: number;
    hasCertificate: boolean;
    certificateEligible: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{
        completionPercent: number;
        completedWeeks: number;
        totalWeeks: number;
        avgScore: number;
        hasCertificate: boolean;
        certificateEligible: boolean;
      }>(`/api/student/course-progress?courseId=${encodeURIComponent(enrollment.courseId)}`)
      .then((res) => {
        if (!cancelled) setProgress(res);
      })
      .catch((err: unknown) => {
        // 401 / 403 → just fall back to the enrollment summary below.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
        // Other errors: silent fallback — the card still renders with summary data.
      });
    return () => { cancelled = true; };
  }, [enrollment.courseId]);

  // Use accurate progress when available, fall back to enrollment summary.
  const completedWeeks = progress?.completedWeeks ?? enrollment.currentWeek;
  const totalWeeks = progress?.totalWeeks ?? enrollment.totalWeeks;
  const pct = progress?.completionPercent
    ?? (enrollment.totalWeeks > 0
      ? Math.round((enrollment.currentWeek / enrollment.totalWeeks) * 100)
      : 0);
  const avgScore = progress?.avgScore ?? enrollment.avgScore ?? 0;
  const isCompleted = totalWeeks > 0 && completedWeeks >= totalWeeks;
  const hasCertificate = progress?.hasCertificate ?? false;
  const certificateEligible = progress?.certificateEligible ?? false;

  // Gradient fallback thumbnail — deterministic per course name so different
  // courses get different (but stable) colors.
  const gradient = pickGradient(enrollment.courseId);

  return (
    <Card className="border-border bg-card overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Thumbnail / gradient header */}
      <div className={cn("relative h-28 w-full bg-gradient-to-br", gradient)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <BookOpen className="h-8 w-8 text-white/40" />
        </div>
        <div className="absolute top-2 right-2">
          {hasCertificate ? (
            <Badge className="bg-amber-500 text-white border-transparent text-[10px] gap-1">
              <Trophy className="h-3 w-3" /> Certified
            </Badge>
          ) : isCompleted ? (
            <Badge className="bg-emerald-600 text-white border-transparent text-[10px] gap-1">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </Badge>
          ) : (
            <Badge className="bg-primary text-primary-foreground border-transparent text-[10px] gap-1">
              <Clock className="h-3 w-3" /> In Progress
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4 flex-1 flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
            {enrollment.courseName}
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {completedWeeks} of {totalWeeks} weeks completed · Day {enrollment.currentDay}
          </p>
        </div>

        {/* Progress — accurate week-by-week completion percentage */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Progress</span>
            <span className="font-medium text-foreground">{Math.min(pct, 100)}%</span>
          </div>
          <Progress value={Math.min(pct, 100)} className="h-1.5" />
          {certificateEligible && !hasCertificate && (
            <p className="text-[10px] text-primary font-medium mt-0.5">
              Certificate eligible — claim it on the Credentials tab
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <Stat label="Avg" value={avgScore > 0 ? `${avgScore}%` : "—"} />
          <Stat label="Latest" value={enrollment.latestScore !== null ? `${enrollment.latestScore}%` : "—"} />
          <Stat label="Tasks" value={`${enrollment.progress}%`} />
        </div>

        <Button
          size="sm"
          onClick={onContinue}
          className="bg-primary hover:bg-primary/90 text-primary-foreground w-full mt-auto"
        >
          {hasCertificate ? "Review Course" : isCompleted ? "Review Course" : "Continue Learning"} <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// ExploreCourseCard — published marketplace course the student
// can enroll in. Links to the public detail page.
// ============================================================
function ExploreCourseCard({ course }: { course: MarketplaceCourseListItem }) {
  const isFree = course.price === 0;
  const gradient = pickGradient(course.id);

  return (
    <Card className="border-border bg-card overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className={cn("relative h-32 w-full bg-gradient-to-br", gradient)}>
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailUrl}
            alt={course.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Hide broken images so the gradient shows through.
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-white/40" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          {isFree ? (
            <Badge className="bg-emerald-600 text-white border-transparent text-[10px]">Free</Badge>
          ) : (
            <Badge className="bg-foreground text-background border-transparent text-[10px]">
              {formatPrice(course.price, course.currency)}
            </Badge>
          )}
        </div>
        {course.featured && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-amber-500 text-white border-transparent text-[10px] gap-1">
              <Sparkles className="h-3 w-3" /> Featured
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4 flex-1 flex flex-col gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
            {course.name}
          </h4>
          {course.subtitle && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{course.subtitle}</p>
          )}
        </div>

        {/* Rating + enrollment count */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {course.rating > 0 ? (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="font-medium text-foreground">{course.rating.toFixed(1)}</span>
              <span>({course.reviewCount})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" /> New
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {course.enrollmentCount} enrolled
          </span>
        </div>

        {/* Meta: category + level + duration */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px] capitalize">{course.category.replace(/-/g, " ")}</Badge>
          <Badge variant="outline" className="text-[10px] capitalize">{course.level}</Badge>
          <Badge variant="outline" className="text-[10px]">{course.durationWeeks}w</Badge>
        </div>

        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10 mt-auto"
        >
          <Link href={`/courses/${course.id}`}>
            View Course <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Small stat tile shared by the enrolled card.
// ============================================================
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 py-1.5">
      <div className="text-xs font-bold text-foreground leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

// ============================================================
// Deterministic gradient picker — same courseId always maps to
// the same gradient so cards stay visually stable across reloads.
// ============================================================
const GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
  "from-lime-500 to-emerald-600",
  "from-sky-500 to-indigo-600",
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0; // force to 32-bit int
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
