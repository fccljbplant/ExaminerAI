"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Loader2,
  RefreshCw,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/instructor-portal — I6 Student profile (REDESIGN-P3 §I6, W10 rebuild)
 *
 * Full student picture on the v2 stack (the cutover deleted the v1 UI
 * panels, never the data — this page re-homes the portfolio data):
 * academic (weekly tests, report cards, competencies), project tasks,
 * engagement (daily check-ins, events), certificates with public
 * verify links, and Phase-1-compliant academic attention signals.
 * One-tap nudge intervention (audited).
 */

/* ---------------- payload (mirror GET /api/v2/instructor/students/[id]) -- */

interface StudentProfileData {
  student: { id: string; name: string; email: string; lastLogin: string | null; joinedAt: string };
  courseId: string;
  kpis: { progress: number; tasksDone: string; latestScore: number | null; attentionScore: number };
  attentionReasons: string[];
  weeklyTests: Array<{ week: number; score: number | null; status: string; completedAt: string | null }>;
  reportCards: Array<{ id: string; week: number | null; score: number; grade: string; createdAt: string }>;
  competencies: Array<{ topic: string; level: string }>;
  dailyLogs: Array<{ date: string; confidence: number | null }>;
  tasks: Array<{ id: string; title: string; status: string; week: number }>;
  certificates: Array<{ id: string; courseName: string; grade: string; score: number; issuedAt: string; verifyUrl: string }>;
  recentEvents: Array<{ type: string; at: string }>;
}

type TabKey = "academic" | "project" | "engagement" | "certificates";

const TABS: { key: TabKey; label: string }[] = [
  { key: "academic", label: "Academic" },
  { key: "project", label: "Project" },
  { key: "engagement", label: "Engagement" },
  { key: "certificates", label: "Certificates" },
];

const TASK_TONE: Record<string, string> = {
  completed: "bg-success-subtle text-success-on",
  "in-progress": "bg-info-subtle text-info-on",
  planned: "bg-bg-subtle text-fg-muted",
  blocked: "bg-warning-subtle text-warning-on",
};

export function StudentProfile({ studentId }: { studentId: string }) {
  const { data, error, isLoading, retry } = useApi<StudentProfileData>(
    `/api/v2/instructor/students/${studentId}`,
  );
  const [tab, setTab] = useState<TabKey>("academic");
  const [nudging, setNudging] = useState(false);

  async function nudge() {
    setNudging(true);
    try {
      await api.post(`/api/v2/instructor/students/${studentId}/nudge`, {});
      toast.success("Nudge sent", {
        description: `${data?.student.name} will see a notification on their dashboard.`,
      });
    } catch (e) {
      toast.error("Couldn't send nudge", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setNudging(false);
    }
  }

  if (isLoading) return <ProfileSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load this student</p>
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

  const atRisk = data.kpis.attentionScore >= 30;

  return (
    <div className="space-y-4">
      {/* header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-fg-muted">
            <Link href="/instructor/students" className="hover:text-fg">
              Students
            </Link>{" "}
            · {data.student.email}
          </p>
          <h1 className="truncate text-lg font-semibold text-fg md:text-xl">{data.student.name}</h1>
          <p className="mt-0.5 text-xs text-fg-muted">
            Joined {new Date(data.student.joinedAt).toLocaleDateString()}
            {data.student.lastLogin
              ? ` · last login ${new Date(data.student.lastLogin).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={nudge}
          disabled={nudging}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {nudging ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Bell className="h-4 w-4" aria-hidden />
          )}
          Nudge
        </button>
      </header>

      {/* risk banner */}
      {atRisk && (
        <div className="rounded-xl border border-warning-subtle bg-warning-subtle px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-warning-on">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Needs attention
          </p>
          <p className="mt-1 text-xs text-warning-on/90">
            {data.attentionReasons.join(" · ") || "Review their activity below."}
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label="Progress" value={`${data.kpis.progress}%`} icon={TrendingUp} tone="brand" />
        <Kpi label="Tasks done" value={data.kpis.tasksDone} icon={ClipboardCheck} tone="info" />
        <Kpi
          label="Latest test"
          value={data.kpis.latestScore != null ? `${data.kpis.latestScore}%` : "—"}
          icon={Zap}
          tone={data.kpis.latestScore != null && data.kpis.latestScore < 60 ? "warning" : "muted"}
        />
        <Kpi
          label="Attention"
          value={data.kpis.attentionScore}
          icon={Flame}
          tone={atRisk ? "warning" : "success"}
        />
      </div>

      {/* tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={
              tab === t.key
                ? "shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-on-brand"
                : "shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-secondary hover:border-line-strong"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "academic" && <AcademicTab data={data} />}
      {tab === "project" && <ProjectTab data={data} />}
      {tab === "engagement" && <EngagementTab data={data} />}
      {tab === "certificates" && <CertificatesTab data={data} />}

      <Link
        href="/instructor/students"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to students
      </Link>
    </div>
  );
}

/* ---------------- tabs ------------------------------------------------ */

function AcademicTab({ data }: { data: StudentProfileData }) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Weekly tests
        </h2>
        {data.weeklyTests.length === 0 ? (
          <Empty label="No weekly tests yet." />
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.weeklyTests.map((t) => (
              <div key={t.week} className="flex items-center gap-3 px-4 py-3">
                <span className="w-16 shrink-0 text-xs tabular-nums text-fg-muted">Week {t.week}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
                  <div
                    className={cn(
                      "h-full rounded-full",
                      (t.score ?? 0) >= 60 ? "bg-success" : "bg-warning"
                    )}
                    style={{ width: `${t.score ?? 0}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-fg-secondary">
                  {t.score != null ? `${t.score}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Report cards
        </h2>
        {data.reportCards.length === 0 ? (
          <Empty label="No report cards yet." />
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.reportCards.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    Week {r.week ?? "—"} · {r.grade}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-fg-secondary">
                  {r.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Competencies
        </h2>
        {data.competencies.length === 0 ? (
          <Empty label="No competency data yet." />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {data.competencies.map((c) => (
              <span
                key={c.topic}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg-secondary"
              >
                {c.topic}
                <span className="ml-1 text-fg-muted">· {c.level}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectTab({ data }: { data: StudentProfileData }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Project tasks
      </h2>
      {data.tasks.length === 0 ? (
        <Empty label="No project tasks yet." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.tasks.map((t) => (
            <div key={t.id} className="flex min-h-12 items-center gap-3 px-4 py-3">
              <CheckCircle2
                className={cn(
                  "h-4 w-4 shrink-0",
                  t.status === "completed" ? "text-success" : "text-fg-muted"
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{t.title}</p>
                <p className="text-xs text-fg-muted">Week {t.week}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                  TASK_TONE[t.status] ?? "bg-bg-subtle text-fg-muted"
                )}
              >
                {t.status.replace("-", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EngagementTab({ data }: { data: StudentProfileData }) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Daily check-ins · last 14 days
        </h2>
        {data.dailyLogs.length === 0 ? (
          <Empty label="No check-ins recorded yet." />
        ) : (
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap gap-1.5">
              {data.dailyLogs.map((l) => (
                <span
                  key={l.date}
                  title={`${l.date}${l.confidence != null ? ` · confidence ${l.confidence}/5` : ""}`}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] tabular-nums",
                    l.confidence != null && l.confidence >= 3
                      ? "bg-success-subtle text-success-on"
                      : "bg-bg-subtle text-fg-muted"
                  )}
                >
                  {l.date.slice(5)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Recent activity
        </h2>
        {data.recentEvents.length === 0 ? (
          <Empty label="No recent activity." />
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.recentEvents.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{e.type}</p>
                <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                  {new Date(e.at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CertificatesTab({ data }: { data: StudentProfileData }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Certificates
      </h2>
      {data.certificates.length === 0 ? (
        <Empty label="No certificates issued yet." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.certificates.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                <Award className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{c.courseName}</p>
                <p className="truncate text-xs text-fg-muted">
                  {c.grade} · {c.score} · {new Date(c.issuedAt).toLocaleDateString()}
                </p>
              </div>
              <Link
                href={c.verifyUrl}
                target="_blank"
                className="shrink-0 rounded-md border border-line bg-bg-subtle px-2 py-1 text-xs font-medium text-fg hover:border-line-strong"
              >
                Verify
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- pieces ------------------------------------------------ */

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof UserRound;
  tone: "brand" | "info" | "warning" | "success" | "muted";
}) {
  const tones = {
    brand: "bg-brand-subtle text-fg",
    info: "bg-info-subtle text-info-on",
    warning: "bg-warning-subtle text-warning-on",
    success: "bg-success-subtle text-success-on",
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
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-surface p-5 text-center text-sm text-fg-muted">
      {label}
    </p>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-8 w-1/2 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
