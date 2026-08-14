"use client";
// src/components/examiner/course/CompactCourseHeader.tsx
// Replaces the oversized course hero. Everything essential stays visible;
// the rest lives one click away in the meta drawer.
// Direct fix for the "course heading fills 60% of page" bug.
import { useState } from "react";
import PageHeader from "@/modules/ui/PageHeader";

export interface CourseHeaderData {
  courseTitle: string;
  trackName?: string;
  week: number;
  totalWeeks: number;
  progress: number; // 0-100
  instructorName?: string;
  durationHours?: number;
  rating?: number;
  nextDeadline?: string; // e.g. "Weekly test · Fri"
}

export default function CompactCourseHeader({
  data,
  onResume,
}: {
  data: CourseHeaderData;
  onResume?: () => void;
}) {
  const [metaOpen, setMetaOpen] = useState(false);

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: "Learn", href: "/learn" },
          { label: data.trackName ?? "Track" },
          { label: data.courseTitle },
        ]}
        title={data.courseTitle}
        subtitle={`Week ${data.week} of ${data.totalWeeks}`}
        progress={data.progress}
        chips={
          <div className="hidden sm:flex items-center gap-1.5">
            {data.nextDeadline && (
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-growth-amber">
                ⏰ {data.nextDeadline}
              </span>
            )}
            <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
              {data.progress}% complete
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMetaOpen(!metaOpen)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:border-foreground/40 transition"
              aria-expanded={metaOpen}
            >
              Details
            </button>
            {onResume && (
              <button
                type="button"
                onClick={onResume}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-extrabold text-primary-foreground hover:brightness-110 transition"
              >
                Resume →
              </button>
            )}
          </div>
        }
      />

      {metaOpen && (
        <div className="border-b border-border bg-muted/40">
          <div className="mx-auto flex max-w-5xl flex-wrap gap-x-8 gap-y-2 px-4 py-3 text-[11px] text-muted-foreground">
            {data.instructorName && (
              <span>
                👤 Instructor · <b className="text-foreground">{data.instructorName}</b>
              </span>
            )}
            {typeof data.durationHours === "number" && (
              <span>
                ⏱ Duration · <b className="text-foreground">{data.durationHours}h</b>
              </span>
            )}
            {typeof data.rating === "number" && (
              <span>
                ★ Rating · <b className="text-foreground">{data.rating.toFixed(1)}</b>
              </span>
            )}
            <span>🎯 Level-paced · AI examines · Mentor on flag</span>
          </div>
        </div>
      )}
    </div>
  );
}
