"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BellRing, CheckCircle2, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/org-portal — Compliance (B2B enterprise ops, 2026-08-17)
 *
 * Assignment-expiry status matrix: one block per course with
 * compliant / due-soon / expired counts, member lists for the at-risk
 * buckets (expired rows highlighted) and a per-member Nudge action.
 */

type ComplianceStatus = "compliant" | "due_soon" | "expired";

interface ComplianceMember {
  userId: string;
  name: string;
  email: string;
  expiresAt: string | null;
  retakeAfterDays: number | null;
  status: ComplianceStatus;
}

interface ComplianceCourse {
  courseId: string;
  courseName: string;
  counts: { compliant: number; dueSoon: number; expired: number };
  members: ComplianceMember[];
}

interface ComplianceData {
  courses: ComplianceCourse[];
  totals: { compliant: number; dueSoon: number; expired: number };
}

export function OrgCompliance() {
  const { data, error, isLoading, retry } = useApi<ComplianceData>("/api/v2/org/compliance");
  const [nudging, setNudging] = useState<string | null>(null);

  async function nudge(member: ComplianceMember, course: ComplianceCourse) {
    setNudging(`${course.courseId}:${member.userId}`);
    try {
      await api.post("/api/v2/org/compliance/nudge", {
        userId: member.userId,
        courseId: course.courseId,
      });
      toast.success("Nudge sent", { description: `${member.name} · ${course.courseName}` });
    } catch (err) {
      toast.error("Couldn't send nudge", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setNudging(null);
    }
  }

  if (isLoading) return <ComplianceSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load compliance</p>
        <p className="mt-1 text-xs text-fg-muted">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">Compliance</h1>
      </div>

      {/* summary chips */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <StatusChip
          label="Compliant"
          count={data.totals.compliant}
          icon={CheckCircle2}
          tone="bg-success-subtle text-success-on"
        />
        <StatusChip
          label="Due soon"
          count={data.totals.dueSoon}
          icon={Clock}
          tone="bg-warning-subtle text-warning-on"
        />
        <StatusChip
          label="Expired"
          count={data.totals.expired}
          icon={AlertTriangle}
          tone="bg-danger-subtle text-danger-on"
        />
      </div>

      {data.courses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <ShieldCheck className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">No compliance data yet</p>
          <p className="max-w-sm text-xs text-fg-muted">
            Assign a course with an expiry (People → Assign courses) and due dates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.courses.map((course) => (
            <CourseBlock
              key={course.courseId}
              course={course}
              nudging={nudging}
              onNudge={nudge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseBlock({
  course,
  nudging,
  onNudge,
}: {
  course: ComplianceCourse;
  nudging: string | null;
  onNudge: (member: ComplianceMember, course: ComplianceCourse) => void;
}) {
  const dueSoon = course.members.filter((m) => m.status === "due_soon");
  const expired = course.members.filter((m) => m.status === "expired");
  const hasExpired = expired.length > 0;

  return (
    <section
      className={
        hasExpired
          ? "rounded-xl border border-danger/40 bg-surface p-4"
          : "rounded-xl border border-line bg-surface p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{course.courseName}</h2>
        <div className="flex items-center gap-2 text-xs tabular-nums">
          <span className="rounded-md bg-success-subtle px-2 py-0.5 font-medium text-success-on">
            {course.counts.compliant} compliant
          </span>
          <span className="rounded-md bg-warning-subtle px-2 py-0.5 font-medium text-warning-on">
            {course.counts.dueSoon} due soon
          </span>
          <span className="rounded-md bg-danger-subtle px-2 py-0.5 font-medium text-danger-on">
            {course.counts.expired} expired
          </span>
        </div>
      </div>

      {expired.length > 0 && (
        <MemberList
          title="Expired"
          members={expired}
          tone="border-danger/40 bg-danger-subtle/40"
          onNudge={(m) => onNudge(m, course)}
          nudging={nudging}
          busyKey={(m) => `${course.courseId}:${m.userId}`}
        />
      )}
      {dueSoon.length > 0 && (
        <MemberList
          title="Due soon"
          members={dueSoon}
          tone="border-warning/40 bg-warning-subtle/40"
          onNudge={(m) => onNudge(m, course)}
          nudging={nudging}
          busyKey={(m) => `${course.courseId}:${m.userId}`}
        />
      )}
      {dueSoon.length === 0 && expired.length === 0 && (
        <p className="mt-2 text-xs text-fg-muted">Everyone in this course is compliant.</p>
      )}
    </section>
  );
}

function MemberList({
  title,
  members,
  tone,
  onNudge,
  nudging,
  busyKey,
}: {
  title: string;
  members: ComplianceMember[];
  tone: string;
  onNudge: (member: ComplianceMember) => void;
  nudging: string | null;
  busyKey: (member: ComplianceMember) => string;
}) {
  return (
    <div className={`mt-3 rounded-lg border ${tone} divide-y divide-line overflow-hidden`}>
      <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
        {title}
      </p>
      {members.map((m) => (
        <div key={m.userId} className="flex min-h-11 items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{m.name}</p>
            <p className="truncate text-xs text-fg-muted">
              {m.expiresAt ? `expires ${new Date(m.expiresAt).toLocaleDateString()}` : "no expiry"}
              {m.retakeAfterDays ? ` · retake after ${m.retakeAfterDays}d` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={nudging === busyKey(m)}
            onClick={() => onNudge(m)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-fg-secondary transition-colors hover:border-line-strong disabled:opacity-50"
          >
            <BellRing className="h-3.5 w-3.5" aria-hidden />
            {nudging === busyKey(m) ? "Sending…" : "Nudge"}
          </button>
        </div>
      ))}
    </div>
  );
}

function StatusChip({
  label,
  count,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  icon: typeof CheckCircle2;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{count}</p>
    </div>
  );
}

function ComplianceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-40 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-bg-subtle" />
    </div>
  );
}
