"use client";

import Link from "next/link";
import { AlertTriangle, CalendarCheck, CheckCircle2, ClipboardCheck, Play } from "lucide-react";
import { ListCard, ListCardRow } from "@/modules/ui/list-card";
import { useApi } from "./use-api";

/**
 * modules/learner-portal — L8 Exams schedule (REDESIGN-P3 §L8)
 *
 * Three stacks: due-today check-ins, weekly tests ready to take, and
 * test history with scores. All rows deep-link into the classroom.
 */

/* ---------------- payload types (mirror GET /api/v2/exams) ------------- */

interface SessionRollup {
  status: string;
  questionIndex: number;
  score: number | null;
  href: string;
}

interface DailyDue {
  id: string;
  kind: "daily-test";
  status: string;
  week: number | null;
  courseName: string;
  score: number | null;
  href: string;
  session: SessionRollup | null;
}

interface WeeklyTest {
  id: string;
  kind: "weekly-test";
  status: "in_progress" | "completed" | "ready";
  week: number;
  courseName: string;
  score: number | null;
  completedAt?: string | null;
  href: string;
  session: SessionRollup | null;
}

interface ExamsData {
  dueToday: DailyDue[];
  ready: WeeklyTest[];
  taken: WeeklyTest[];
}

/* ---------------- page --------------------------------------------------- */

export function LearnerExams() {
  const { data, error, isLoading, retry } = useApi<ExamsData>("/api/v2/exams");

  if (isLoading) return <ExamsSkeleton />;
  if (error) return <ExamsError message={error} onRetry={retry} />;
  if (!data) return null;

  const empty = data.dueToday.length === 0 && data.ready.length === 0 && data.taken.length === 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Exams</h1>

      {empty ? (
        <AllClear />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-6 lg:space-y-6">
            {data.dueToday.length > 0 && (
              <ListCard header="Due today">
                {data.dueToday.map((t) => (
                  <ListCardRow
                    key={t.id}
                    href={t.session?.href ?? t.href}
                    leading={<TestIcon tone="warning" />}
                    title="Daily check-in"
                    meta={t.courseName}
                    trailing={
                      t.session?.status === "completed" ? (
                        <ReviewChip score={t.session.score} />
                      ) : t.session?.status === "in_progress" ? (
                        <ResumeChip />
                      ) : (
                        <StatusBadge status={t.status} />
                      )
                    }
                  />
                ))}
              </ListCard>
            )}

            {data.ready.length > 0 && (
              <ListCard header="Ready to take">
                {data.ready.map((t) => (
                  <ListCardRow
                    key={t.id}
                    href={t.session?.href ?? t.href}
                    leading={<TestIcon tone="brand" />}
                    title={`Week ${t.week} test`}
                    meta={t.courseName}
                    trailing={
                      t.session?.status === "in_progress" ? (
                        <ResumeChip />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                          <Play className="h-3.5 w-3.5" aria-hidden />
                          Start
                        </span>
                      )
                    }
                  />
                ))}
              </ListCard>
            )}
          </div>

          <div className="lg:col-span-6">
            {data.taken.length > 0 ? (
              <ListCard header="History">
                {data.taken.map((t) => (
                  <ListCardRow
                    key={t.id}
                    href={t.session?.href ?? t.href}
                    leading={<TestIcon tone={t.status === "completed" ? "success" : "warning"} />}
                    title={`Week ${t.week} test`}
                    meta={`${t.courseName}${t.completedAt ? ` · ${new Date(t.completedAt).toLocaleDateString()}` : ""}`}
                    trailing={
                      t.session?.status === "in_progress" ? (
                        <ResumeChip />
                      ) : t.status === "completed" && t.score !== null ? (
                        <span className="font-semibold text-fg">{t.score}%</span>
                      ) : (
                        <StatusBadge status={t.status} />
                      )
                    }
                  />
                ))}
              </ListCard>
            ) : (
              <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
                No completed tests yet — your history will appear here.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- pieces -------------------------------------------------- */

function TestIcon({ tone }: { tone: "brand" | "warning" | "success" }) {
  const tones = {
    brand: "bg-brand-subtle text-fg",
    warning: "bg-warning-subtle text-warning-on",
    success: "bg-success-subtle text-success-on",
  } as const;
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
      <ClipboardCheck className="h-4 w-4" aria-hidden />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success-on">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Done
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-warning-subtle px-2 py-0.5 text-[11px] font-semibold text-warning-on">
      In progress
    </span>
  );
}

function ResumeChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-[11px] font-semibold text-fg">
      <Play className="h-3 w-3" aria-hidden />
      Resume
    </span>
  );
}

function ReviewChip({ score }: { score: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success-on">
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      Review {score != null ? `· ${Math.round(score)}%` : ""}
    </span>
  );
}

/* ---------------- states ---------------------------------------------------- */

function AllClear() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle text-success-on">
        <CalendarCheck className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold text-fg">Nothing scheduled</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
        Tests appear here once you start a course. Daily check-ins and weekly tests are generated
        as you progress.
      </p>
      <Link
        href="/learner/learn"
        className="mt-5 inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90"
      >
        Browse courses
      </Link>
    </div>
  );
}

function ExamsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-7 w-32 animate-pulse rounded-md bg-bg-subtle" />
      <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="h-40 animate-pulse rounded-xl bg-bg-subtle" />
    </div>
  );
}

function ExamsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load your exams</p>
      <p className="mt-1 text-xs text-fg-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
      >
        Retry
      </button>
    </div>
  );
}
