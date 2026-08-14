"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Clock,
  Play,
  Star,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ActionBar } from "@/modules/shell";
import { RadialProgress } from "@/modules/ui/radial-progress";
import { useApi } from "./use-api";

/**
 * modules/learner-portal — L3 Course detail (REDESIGN-P3 §L3)
 *
 * Compact header (title, chips, ring, primary Continue/Enroll) +
 * scrollable tab row: Overview / Syllabus. Syllabus fetches lazily
 * on first open. xs gets a sticky BottomActionBar CTA.
 */

/* ---------------- payload types --------------------------------------- */

interface OverviewData {
  course: {
    id: string;
    name: string;
    subtitle: string | null;
    description: string;
    category: string;
    level: string;
    durationWeeks: number;
    rating: number;
    reviewCount: number;
    enrollmentCount: number;
    thumbnailUrl: string | null;
    skillsVerified: string[];
    whatYouWillLearn: string[];
    prerequisites: string[];
    toolsUsed: string[];
    weekCount: number;
    instructorName: string | null;
  };
  enrollment:
    | {
        enrolled: true;
        totalXP: number;
        streakCurrent: number;
        position: { week: number; day: number } | null;
        nextLesson: string | null;
      }
    | { enrolled: false };
}

interface SyllabusDay {
  id: string;
  day: number;
  title: string;
  objective: string;
  activity: string;
  deliverable: string;
  status: "completed" | "current" | "upcoming";
}

interface SyllabusData {
  course: { id: string; name: string };
  current: { week: number; day: number } | null;
  weeks: { week: number; phase: string; milestone: string; days: SyllabusDay[] }[];
}

/* ---------------- page -------------------------------------------------- */

export function CourseDetail({ courseId }: { courseId: string }) {
  const [tab, setTab] = useState<"overview" | "syllabus">("overview");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const overview = useApi<OverviewData>(`/api/v2/courses/${courseId}/overview`);
  // Tab-lazy: syllabus only fetched once the tab is opened.
  const syllabus = useApi<SyllabusData>(
    tab === "syllabus" ? `/api/v2/courses/${courseId}/syllabus` : null
  );

  if (overview.isLoading) return <DetailSkeleton />;
  if (overview.error || !overview.data) {
    return (
      <StatePanel
        message={overview.error ?? "Course not found"}
        onRetry={overview.error ? overview.retry : undefined}
      />
    );
  }

  const { course, enrollment } = overview.data;
  const enrolled = enrollment.enrolled;

  async function enroll() {
    setEnrolling(true);
    setEnrollError(null);
    try {
      await api.post("/api/learn/enroll", { courseId });
      overview.retry(); // refetch — enrollment flips the CTA to Continue
    } catch (e) {
      setEnrollError(e instanceof Error ? e.message : "Enrollment failed");
      setEnrolling(false);
    }
  }

  const ringPercent =
    enrolled && enrollment.position && course.weekCount > 0
      ? Math.min(100, Math.round(((enrollment.position.week - 1) / course.weekCount) * 100))
      : 0;

  const cta = enrolled ? (
    <Link
      href={`/learn/${courseId}`}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90"
    >
      <Play className="h-4 w-4" aria-hidden />
      Continue
    </Link>
  ) : (
    <button
      type="button"
      onClick={enroll}
      disabled={enrolling}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-60"
    >
      {enrolling ? "Enrolling…" : "Enroll"}
    </button>
  );

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* compact header */}
      <header className="rounded-xl border border-line bg-surface p-4 md:p-5">
        <Link
          href="/learner/learn"
          className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Courses
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-snug text-fg md:text-xl">{course.name}</h1>
            {course.subtitle && <p className="mt-1 text-sm text-fg-secondary">{course.subtitle}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-fg-muted">
              <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 font-medium capitalize">{course.category}</span>
              <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 font-medium capitalize">{course.level}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                {course.durationWeeks} weeks
              </span>
              {course.rating > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star className="h-3 w-3" aria-hidden />
                  {course.rating.toFixed(1)} ({course.reviewCount})
                </span>
              )}
            </div>

            {enrolled && enrollment.nextLesson && (
              <p className="mt-3 text-xs text-fg-secondary">Next: {enrollment.nextLesson}</p>
            )}
            {enrollError && (
              <p role="alert" className="mt-2 text-xs font-medium text-danger">{enrollError}</p>
            )}
          </div>

          {enrolled && (
            <div className="hidden shrink-0 sm:block">
              <RadialProgress value={ringPercent} size="sm" label={`${ringPercent}% complete`} />
            </div>
          )}
        </div>

        <div className="mt-4 hidden md:block">{cta}</div>
      </header>

      {/* tab row */}
      <nav aria-label="Course sections" className="flex gap-1 border-b border-line">
        {(["overview", "syllabus"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-11 items-center border-b-2 px-4 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "border-brand text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <OverviewTab data={overview.data} />
      ) : syllabus.isLoading ? (
        <DetailSkeleton />
      ) : syllabus.error ? (
        <StatePanel message={syllabus.error} onRetry={syllabus.retry} />
      ) : syllabus.data ? (
        <SyllabusTab data={syllabus.data} />
      ) : null}

      {/* xs sticky CTA */}
      <div className="md:hidden">
        <ActionBar>{cta}</ActionBar>
      </div>
    </div>
  );
}

/* ---------------- tabs --------------------------------------------------- */

function OverviewTab({ data }: { data: OverviewData }) {
  const { course } = data;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {course.whatYouWillLearn.length > 0 && (
        <Section title="What you'll learn">
          <ul className="space-y-2">
            {course.whatYouWillLearn.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-fg-secondary">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="About this course">
        <p className="whitespace-pre-line text-sm leading-relaxed text-fg-secondary">
          {course.description || "No description yet."}
        </p>
        {course.instructorName && (
          <p className="mt-3 text-xs text-fg-muted">Taught by {course.instructorName}</p>
        )}
      </Section>

      <div className="space-y-4">
        {course.prerequisites.length > 0 && (
          <Section title="Prerequisites">
            <ul className="list-inside list-disc space-y-1 text-sm text-fg-secondary">
              {course.prerequisites.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Section>
        )}

        {(course.skillsVerified.length > 0 || course.toolsUsed.length > 0) && (
          <Section title="Skills & tools">
            <div className="flex flex-wrap gap-1.5">
              {course.skillsVerified.map((s) => (
                <span key={s} className="rounded-full bg-brand-subtle px-2.5 py-1 text-xs font-medium text-fg">
                  {s}
                </span>
              ))}
              {course.toolsUsed.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-bg-subtle px-2.5 py-1 text-xs font-medium text-fg-secondary"
                >
                  <Wrench className="h-3 w-3" aria-hidden />
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function SyllabusTab({ data }: { data: SyllabusData }) {
  if (data.weeks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-fg-muted">
        The syllabus for this course hasn&apos;t been published yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {data.weeks.map((w) => (
        <section key={w.week} className="overflow-hidden rounded-xl border border-line bg-surface">
          <header className="flex items-center justify-between gap-2 border-b border-line bg-bg-subtle px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-fg">
                Week {w.week} <span className="font-normal text-fg-muted">· {w.phase}</span>
              </h2>
              {w.milestone && <p className="mt-0.5 truncate text-xs text-fg-muted">{w.milestone}</p>}
            </div>
          </header>
          <ul className="divide-y divide-line">
            {w.days.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <StatusDot status={d.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    Day {d.day} — {d.title}
                  </p>
                  {d.objective && <p className="mt-0.5 truncate text-xs text-fg-muted">{d.objective}</p>}
                </div>
                {d.deliverable && (
                  <span className="hidden shrink-0 rounded-full bg-bg-subtle px-2.5 py-0.5 text-[11px] font-medium text-fg-muted sm:inline">
                    {d.deliverable}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: SyllabusDay["status"] }) {
  return (
    <span
      aria-label={status}
      title={status}
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        status === "completed" && "bg-success",
        status === "current" && "bg-brand ring-2 ring-brand-subtle",
        status === "upcoming" && "border border-line-strong bg-bg-subtle"
      )}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ---------------- states -------------------------------------------------- */

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-44 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="h-10 w-56 animate-pulse rounded-lg bg-bg-subtle" />
      <div className="h-64 animate-pulse rounded-xl bg-bg-subtle" />
    </div>
  );
}

function StatePanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load this course</p>
      <p className="mt-1 text-xs text-fg-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
        >
          Retry
        </button>
      )}
    </div>
  );
}
