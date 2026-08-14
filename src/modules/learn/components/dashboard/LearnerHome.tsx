"use client";

// src/modules/learn/components/dashboard/LearnerHome.tsx — Learner dashboard (Star Admin style).
// The student "Today" landing: stat tiles, continue-learning CTA, assignments
// table, project progress, course coverage, and an activity feed.
// Data comes from the already-fetched student stats + enrollments — no new
// API surface. All widgets handle empty states inline.

import {
  ArrowRight, BookOpen, CalendarCheck, ClipboardList, Flame, GraduationCap,
  PlayCircle, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { WidgetCard } from "@/components/shared/widget-card";
import { StatStrip } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/ui/states";
import type { StatsResponse, Task } from "@/components/examiner/student/types";
import type { EnrollmentResponse } from "@/app/api/enrollments/route";

interface LearnerHomeProps {
  stats: StatsResponse;
  enrollments?: EnrollmentResponse["enrollments"];
  activeCourseId?: string;
  /** Switch dashboard view (StudentDashboard owns the view state). */
  onNavigate: (view: string) => void;
  /** Refetch stats — used after switching the active course. */
  onReload: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

type PillTone = "sage" | "amber" | "muted";

function taskStatusPill(status: string): { label: string; tone: PillTone } {
  const s = status.toLowerCase();
  if (s === "completed" || s === "done" || s === "complete") return { label: "Done", tone: "sage" };
  if (s === "in_progress" || s === "in-progress" || s === "started") return { label: "In progress", tone: "amber" };
  return { label: "To do", tone: "muted" };
}

/** Average of scored weekly tests, plus the delta between the last two. */
function weeklyTestSummary(stats: StatsResponse): { avg: number | null; delta: number | null } {
  const scored = (stats.weeklyTests ?? []).filter(t => typeof t.score === "number") as { score: number }[];
  if (scored.length === 0) return { avg: null, delta: null };
  const avg = Math.round(scored.reduce((sum, t) => sum + t.score, 0) / scored.length);
  const delta = scored.length >= 2
    ? Math.round(scored[scored.length - 1].score - scored[scored.length - 2].score)
    : null;
  return { avg, delta };
}

// ── Component ──────────────────────────────────────────────────────

export function LearnerHome({ stats, enrollments, activeCourseId, onNavigate, onReload }: LearnerHomeProps) {
  const s = stats.stats;
  const tasks = stats.tasks ?? [];
  const testSummary = weeklyTestSummary(stats);
  const activeEnrollment = enrollments?.find(e => e.courseId === activeCourseId) ?? enrollments?.[0] ?? null;
  const learnCourseId = activeCourseId ?? activeEnrollment?.courseId ?? stats.projectConfig?.courseId ?? null;

  const coveragePct = activeEnrollment
    ? Math.min(100, Math.round(((activeEnrollment.currentWeek ?? 0) / Math.max(1, activeEnrollment.totalWeeks ?? 1)) * 100))
    : s.progress;

  const openTasks = tasks.filter(t => taskStatusPill(t.status).tone !== "sage");
  const nextMilestone = tasks.find(t => t.isMilestone && taskStatusPill(t.status).tone !== "sage") ?? null;

  // Activity feed — mentor comments + report cards + completed tests,
  // merged and sorted newest first (Star Admin "Activities" pattern).
  const activity: { id: string; date: string; text: string }[] = [
    ...(stats.comments ?? []).map(c => ({
      id: `c-${c.id}`,
      date: c.createdAt,
      text: `${c.instructor.name}: ${(c.body ?? "").slice(0, 80)}${(c.body ?? "").length > 80 ? "…" : ""}`,
    })),
    ...(stats.reportCards ?? []).map(r => ({
      id: `r-${r.week}`,
      date: r.date,
      text: `Week ${r.week} report card — ${r.score}% (${r.grade})`,
    })),
    ...(stats.weeklyTests ?? [])
      .filter(t => t.completedAt)
      .map(t => ({
        id: `t-${t.week}`,
        date: t.completedAt as string,
        text: `Week ${t.week} weekly test${t.score !== null ? ` — ${t.score}%` : " completed"}`,
      })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  function switchCourse(courseId: string) {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("courseId", courseId);
      window.history.replaceState({}, "", `?${params.toString()}`);
    }
    onReload();
  }

  return (
    <div className="space-y-4">
      {/* ── Stat tiles (Star Admin row) ──────────────────────────── */}
      <StatStrip
        stats={[
          {
            icon: Flame,
            label: "Streak",
            value: `${s.streak}d`,
            tone: s.streak > 0 ? "warning" : "default",
            hint: s.streak > 0 ? "Keep it alive today" : "Start today",
          },
          {
            icon: GraduationCap,
            label: "Course coverage",
            value: `${coveragePct}%`,
            progress: coveragePct,
            hint: activeEnrollment ? `Week ${activeEnrollment.currentWeek} of ${activeEnrollment.totalWeeks}` : `Week ${s.currentWeek}`,
          },
          {
            icon: ClipboardList,
            label: "Test average",
            value: testSummary.avg !== null ? `${testSummary.avg}%` : "—",
            delta: testSummary.delta !== null
              ? { value: `${testSummary.delta >= 0 ? "+" : ""}${testSummary.delta}%`, direction: testSummary.delta >= 0 ? "up" : "down" }
              : undefined,
            hint: testSummary.avg === null ? "No tests scored yet" : "vs previous test",
          },
          {
            icon: CalendarCheck,
            label: "Tasks this week",
            value: `${s.completedTasksThisWeek}/${s.tasksThisWeek}`,
            progress: s.tasksThisWeek > 0 ? Math.round((s.completedTasksThisWeek / s.tasksThisWeek) * 100) : 0,
            hint: openTasks.length > 0 ? `${openTasks.length} still open` : "All caught up",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Continue learning CTA ──────────────────────────────── */}
        {learnCourseId && (
          <section className="surface-card flex flex-col justify-between gap-4 p-5 lg:col-span-2">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
                Continue learning
              </div>
              <h3 className="mt-2 text-lg font-semibold leading-snug">
                {activeEnrollment?.courseName ?? stats.projectConfig?.courseName ?? "Your course"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Step into your classroom — your AI teacher has today&apos;s lesson ready, with video,
                slides, and voice Q&amp;A.
              </p>
            </div>
            <div>
              <a
                href={`/learn/${learnCourseId}`}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <PlayCircle className="h-4 w-4" aria-hidden />
                Enter classroom
              </a>
            </div>
          </section>
        )}

        {/* ── Project progress ───────────────────────────────────── */}
        <WidgetCard
          title="Project progress"
          subtitle={nextMilestone ? `Next: ${nextMilestone.description.slice(0, 40)}` : "Capstone status"}
          actions={
            <button
              type="button"
              onClick={() => onNavigate("project")}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
            >
              Open <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          }
        >
          {tasks.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">
                  {s.tasksThisWeek > 0 ? Math.round((s.completedTasksThisWeek / s.tasksThisWeek) * 100) : 0}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.completedTasksThisWeek} of {s.tasksThisWeek} tasks
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={s.tasksThisWeek > 0 ? Math.round((s.completedTasksThisWeek / s.tasksThisWeek) * 100) : 0}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${s.tasksThisWeek > 0 ? Math.round((s.completedTasksThisWeek / s.tasksThisWeek) * 100) : 0}%` }}
                />
              </div>
              {nextMilestone && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-growth-amber" aria-hidden />
                  Milestone due week {nextMilestone.week}
                </p>
              )}
            </div>
          ) : stats.projectConfig?.projectEnabled ? (
            <EmptyState
              icon="🎯"
              title="Set up your capstone"
              hint="Define your project to get AI-generated weekly tasks and milestones."
              action={
                <button
                  type="button"
                  onClick={() => onNavigate("project")}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Set up project
                </button>
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">No project tasks this week yet.</p>
          )}
        </WidgetCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Assignments (interactive table) ────────────────────── */}
        <WidgetCard
          title="Assignments"
          subtitle={`${openTasks.length} open`}
          className="lg:col-span-2"
          flush
          menu={[{ label: "View all in Project", onSelect: () => onNavigate("project") }]}
        >
          {tasks.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState
                icon="🌱"
                title="No assignments yet"
                hint="Your weekly tasks will appear here once your course plan kicks in."
                action={
                  <button
                    type="button"
                    onClick={() => onNavigate("study")}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Go to Study
                  </button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th className="pl-4">Assignment</th>
                    <th>Week</th>
                    <th>Due</th>
                    <th className="pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 6).map((t: Task) => {
                    const pill = taskStatusPill(t.status);
                    return (
                      <tr
                        key={t.id}
                        onClick={() => onNavigate("project")}
                        className="cursor-pointer"
                        title="Open in Project view"
                      >
                        <td className="max-w-[280px] truncate pl-4 font-medium">
                          {t.isMilestone && <Target className="mr-1 inline h-3 w-3 text-growth-amber" aria-hidden />}
                          {t.description}
                        </td>
                        <td className="text-muted-foreground">W{t.week}</td>
                        <td className="text-muted-foreground">
                          {t.dueDate ? formatRelativeTime(t.dueDate) : "—"}
                        </td>
                        <td className="pr-4">
                          <span className={cn("badge-pill", `badge-pill-${pill.tone}`)}>{pill.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </WidgetCard>

        {/* ── Activity feed ──────────────────────────────────────── */}
        <WidgetCard title="Activity" subtitle="Latest feedback & results">
          {activity.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Nothing yet"
              hint="Mentor feedback, test results, and report cards land here."
            />
          ) : (
            <ul className="space-y-3">
              {activity.map(a => (
                <li key={a.id} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate">{a.text}</p>
                    <p className="text-[10px] text-muted-foreground">{formatRelativeTime(a.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      </div>

      {/* ── Course coverage ──────────────────────────────────────── */}
      {enrollments && enrollments.length > 0 && (
        <WidgetCard title="Course coverage" subtitle="Progress across your enrollments">
          <ul className="space-y-4">
            {enrollments.map(enr => {
              const pct = Math.min(100, Math.round(((enr.currentWeek ?? 0) / Math.max(1, enr.totalWeeks ?? 1)) * 100));
              const isActive = enr.courseId === (activeCourseId ?? activeEnrollment?.courseId);
              return (
                <li key={enr.courseId}>
                  <button
                    type="button"
                    onClick={() => switchCourse(enr.courseId)}
                    className="block w-full text-left"
                    title={isActive ? "Current course" : "Switch to this course"}
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm font-medium", isActive && "text-primary")}>
                        {enr.courseName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Week {enr.currentWeek}/{enr.totalWeeks} · {pct}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${enr.courseName} coverage`}
                    >
                      <div
                        className={cn("h-full rounded-full transition-all", isActive ? "bg-primary" : "bg-primary/50")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </WidgetCard>
      )}
    </div>
  );
}
