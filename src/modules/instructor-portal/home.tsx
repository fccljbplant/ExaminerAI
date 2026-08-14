"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  RefreshCw,
  UserRound,
  Wallet,
} from "lucide-react";
import { useApi } from "@/modules/learner-portal/use-api";
import { AIAssistantBox } from "./assistant-box";
import { INSTRUCTOR_MORE } from "./portal-shell";

/**
 * modules/instructor-portal — I1 Home (REDESIGN-P3 §I1, W6)
 *
 * Above the fold: grading-queue KPI + at-risk KPI, then the queue
 * preview and the at-risk roster. One aggregate endpoint
 * (GET /api/v2/instructor/home) feeds the whole fold — queue and
 * at-risk both scoped to the courses the instructor teaches.
 */

interface QueuePreviewItem {
  submissionId: string;
  learnerName: string;
  assignmentTitle: string;
  courseName: string | null;
  status: string;
  cycle: number;
}

interface AtRiskItem {
  id: string;
  name: string;
  attentionScore: number;
  attentionReasons: string[];
}

interface HomeData {
  queue: { count: number; preview: QueuePreviewItem[] };
  atRisk: { count: number; items: AtRiskItem[] };
  studentsTotal: number;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  resubmitted: "Resubmitted",
  changes_requested: "Returned",
};

export function InstructorHome() {
  const { data, error, isLoading, retry } = useApi<HomeData>("/api/v2/instructor/home");

  if (isLoading) return <HomeSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load your dashboard</p>
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

  const queueItems = data.queue.preview;
  const atRisk = data.atRisk.items;
  const inReview = queueItems.filter((i) => i.status !== "changes_requested").length;

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Instructor home</h1>

      {/* KPI strip (P3 I1: queue + at-risk above the fold) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi
          label="In queue"
          value={queueItems.length}
          hint="awaiting review"
          tone="info"
          icon={ClipboardCheck}
        />
        <Kpi
          label="At risk"
          value={atRisk.length}
          hint="need intervention"
          tone={atRisk.length > 0 ? "warning" : "success"}
          icon={AlertTriangle}
        />
        <Kpi label="Students" value={data.studentsTotal} hint="enrolled" tone="brand" icon={UserRound} />
        <Kpi label="In review" value={inReview} hint="being graded" tone="muted" icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
        {/* grading queue preview */}
        <section className="space-y-2 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Grading queue
            </h2>
            <Link
              href="/instructor/review"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-fg"
            >
              Open queue
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {queueItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              Queue is clear — new submissions will appear here.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {queueItems.slice(0, 5).map((i) => (
                <Link
                  key={i.submissionId}
                  href={`/instructor/review/${i.submissionId}`}
                  className="flex min-h-12 items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{i.learnerName}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {i.assignmentTitle}
                      {i.cycle > 1 ? ` · cycle ${i.cycle}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-info-subtle px-2 py-0.5 text-xs font-medium text-info-on">
                    {STATUS_LABEL[i.status] ?? i.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* at-risk roster */}
        <section className="space-y-2 lg:col-span-5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Needs attention
          </h2>
          {atRisk.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              No students need attention right now.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {atRisk.slice(0, 5).map((s) => (
                <Link
                  key={s.id}
                  href={`/instructor/students/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{s.name}</p>
                    <p className="truncate text-xs text-fg-muted">{s.attentionReasons[0]}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-on">
                    {s.attentionScore} pts
                  </span>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/instructor/students"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-fg"
          >
            View all students
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>
      </div>

      {/* AI assistant (v1 AIAssistantBox) */}
      <AIAssistantBox />

      {/* More destinations */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {INSTRUCTOR_MORE.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.id}
              href={m.href}
              className="flex min-h-14 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong"
            >
              {Icon && <Icon className="h-4 w-4 text-fg-muted" aria-hidden />}
              {m.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "info" | "warning" | "success" | "brand" | "muted";
  icon: typeof UserRound;
}) {
  const tones = {
    info: "bg-info-subtle text-info-on",
    warning: "bg-warning-subtle text-warning-on",
    success: "bg-success-subtle text-success-on",
    brand: "bg-brand-subtle text-fg",
    muted: "bg-bg-subtle text-fg-muted",
  } as const;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      <p className="text-[11px] text-fg-muted">{hint}</p>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-40 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
