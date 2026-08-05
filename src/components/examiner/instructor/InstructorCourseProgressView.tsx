"use client";

/**
 * InstructorCourseProgressView — dynamic per-week progress stepper + timeline.
 *
 * HI-8 fix (audit 2026-07-26 FINAL): the previous version hardcoded a 6-week
 * web-dev bootcamp plan (TEACHER_BOOTCAMP_PLAN) with specific phase names like
 * "Planning & Dev Environment" and "APIs, Automation & AI Agents". Every student
 * portfolio opened with these wrong phase names for non-web-dev courses.
 *
 * Now the component derives the week list dynamically from the student's
 * projectDurationWeeks (or the max week in their tasks, or a fallback of 6).
 * Phase names are generic "Week N" since course-specific phases aren't
 * available in the portfolio data. Accent colors cycle through a palette.
 */

import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";
import type { PortfolioData, StudentRow } from "@/components/examiner/instructor/types";

/** Dynamic accent palette — cycles through these for any number of weeks. */
const ACCENT_PALETTE = [
  { text: "text-emerald-600", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
  { text: "text-blue-600",    bg: "bg-blue-500/10",    bar: "bg-blue-500" },
  { text: "text-amber-600",   bg: "bg-amber-500/10",   bar: "bg-amber-500" },
  { text: "text-violet-600",  bg: "bg-violet-500/10",  bar: "bg-violet-500" },
  { text: "text-rose-600",    bg: "bg-rose-500/10",    bar: "bg-rose-500" },
  { text: "text-cyan-600",    bg: "bg-cyan-500/10",    bar: "bg-cyan-500" },
  { text: "text-orange-600",  bg: "bg-orange-500/10",  bar: "bg-orange-500" },
  { text: "text-teal-600",    bg: "bg-teal-500/10",    bar: "bg-teal-500" },
];

export function InstructorCourseProgressView({ portfolio, student }: { portfolio: PortfolioData; student: StudentRow }) {
  // Group tasks by week
  const tasksByWeek = new Map<number, typeof portfolio.tasks>();
  for (const t of portfolio.tasks) {
    if (!tasksByWeek.has(t.week)) tasksByWeek.set(t.week, []);
    tasksByWeek.get(t.week)!.push(t);
  }

  const currentWeek = student.currentWeek;

  // HI-8 fix: derive total weeks dynamically — no hardcoded 6
  const maxTaskWeek = portfolio.tasks.length > 0
    ? Math.max(...portfolio.tasks.map(t => t.week))
    : 0;
  const totalWeeks = portfolio.student.projectDurationWeeks
    || maxTaskWeek
    || 6; // fallback only when no data exists — not a hardcoded assumption

  // Build the week list dynamically
  const weeks = Array.from({ length: totalWeeks }, (_, i) => ({
    week: i + 1,
    phase: `Week ${i + 1}`,
    accent: ACCENT_PALETTE[i % ACCENT_PALETTE.length],
  }));

  return (
    <div className="space-y-4">
      {/* Week stepper — dynamic count */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {weeks.map((plan) => {
          const weekTasks = tasksByWeek.get(plan.week) ?? [];
          const completed = weekTasks.filter(t => t.status === "completed").length;
          const total = weekTasks.length;
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
          const isCurrent = plan.week === currentWeek;
          const isPast = plan.week < currentWeek;
          const acc = plan.accent;
          return (
            <div
              key={plan.week}
              className={`rounded-lg border p-2.5 ${
                isCurrent ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30" :
                isPast ? "border-border bg-muted/30" :
                "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`text-[10px] font-bold ${isCurrent ? "text-primary" : acc.text}`}>W{plan.week}</span>
                {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                {isPast && progress === 100 && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}
              </div>
              <p className="text-[10px] font-medium text-foreground leading-tight mb-1">{plan.phase}</p>
              <Progress value={progress} className="h-1" />
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {total > 0 ? `${completed}/${total} tasks` : "no tasks"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Compact timeline — visual progress per week */}
      <div className="rounded-md border border-border p-3 space-y-1.5">
        <p className="text-xs font-medium text-foreground mb-2">Timeline ({totalWeeks} weeks)</p>
        {weeks.map((plan) => {
          const weekTasks = tasksByWeek.get(plan.week) ?? [];
          const completed = weekTasks.filter(t => t.status === "completed").length;
          const inProgress = weekTasks.filter(t => t.status === "in-progress").length;
          const total = Math.max(weekTasks.length, 1);
          const completedWidth = (completed / total) * 100;
          const inProgressWidth = (inProgress / total) * 100;
          const acc = plan.accent;
          const isCurrent = plan.week === currentWeek;
          return (
            <div key={plan.week} className="grid grid-cols-[120px_1fr] sm:grid-cols-[180px_1fr] gap-2 items-center">
              <div className="min-w-0">
                <span className={`text-[10px] font-bold ${acc.text}`}>W{plan.week}</span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground ml-1 truncate">{plan.phase}</span>
              </div>
              <div className="relative h-4 rounded bg-muted overflow-hidden">
                {completedWidth > 0 && <div className={`absolute inset-y-0 left-0 ${acc.bar} opacity-80`} style={{ width: `${completedWidth}%` }} />}
                {inProgressWidth > 0 && <div className="absolute inset-y-0 bg-blue-500/50" style={{ left: `${completedWidth}%`, width: `${inProgressWidth}%` }} />}
                {isCurrent && <div className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: "50%" }} />}
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-foreground/70">
                  {completed}/{weekTasks.length}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {portfolio.tasks.length === 0 && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700">
          This student hasn&apos;t added any project tasks yet. Consider messaging them to start with the Project Plan tab.
        </div>
      )}
    </div>
  );
}
