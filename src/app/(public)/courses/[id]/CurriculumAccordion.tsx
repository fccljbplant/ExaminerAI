"use client";

/**
 * CurriculumAccordion — weekly-only curriculum viewer for the PUBLIC
 * course detail page (2026-08-15).
 *
 * The marketplace shows the course at WEEK granularity (phase, week
 * number, lesson count, milestone). The day-by-day syllabus is reserved
 * for enrolled learners in their dashboard (L3 syllabus tab), so the
 * free outline stays a teaser instead of giving the whole course away.
 *
 * Rows are read-only (no expansion) and end with an enroll CTA.
 */

import { Lock, BookOpen } from "lucide-react";
import { Badge } from "@/modules/ui/badge";
import Link from "next/link";

export interface CurriculumWeek {
  id: string;
  weekNumber: number;
  phase: string;
  milestone: string;
  dayCount: number;
}

interface Props {
  weeks: CurriculumWeek[];
  totalDays: number;
  enrollHref?: string;
}

export default function CurriculumAccordion({ weeks, totalDays, enrollHref = "/register" }: Props) {
  return (
    <div className="space-y-1.5">
      {weeks.map((week) => (
        <div
          key={week.id}
          className="flex items-center gap-2 rounded-md border border-line bg-surface/40 px-3 py-2"
        >
          <Badge variant="outline" className="text-[10px] text-brand border-brand/30 flex-shrink-0">
            W{week.weekNumber}
          </Badge>
          <span className="font-medium text-sm text-fg truncate flex-1">{week.phase}</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-fg-muted flex-shrink-0">
            <BookOpen className="h-3 w-3" aria-hidden />
            {week.dayCount} {week.dayCount === 1 ? "lesson" : "lessons"}
          </span>
          {week.milestone && (
            <Badge variant="outline" className="text-[10px] hidden sm:inline-flex flex-shrink-0">
              {week.milestone}
            </Badge>
          )}
          <Lock className="h-3.5 w-3.5 text-fg-muted/60 flex-shrink-0" aria-hidden />
        </div>
      ))}

      {/* Enroll CTA — full outline lives in the learner dashboard */}
      <div className="mt-3 flex flex-col items-start gap-2 rounded-md border border-dashed border-line bg-bg-subtle/40 p-3 sm:flex-row sm:items-center">
        <p className="text-xs text-fg-muted">
          <span className="font-semibold text-fg">{totalDays} lessons</span> across {weeks.length}{" "}
          {weeks.length === 1 ? "week" : "weeks"} — enroll to unlock the full day-by-day
          syllabus, AI tutor, tests and your certificate.
        </p>
        <Link
          href={enrollHref}
          className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover sm:ml-auto"
        >
          Enroll to see full syllabus
        </Link>
      </div>
    </div>
  );
}
