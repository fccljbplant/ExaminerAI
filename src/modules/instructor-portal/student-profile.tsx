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
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "@/modules/learner-portal/use-api";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useChartColors, tooltipStyle } from "@/lib/chart-theme";

/**
 * modules/instructor-portal — I6 Student profile (REDESIGN-P3 §I6, W10
 * rebuild + W11 audit extensions)
 *
 * Full student picture on the v2 stack (the cutover deleted the v1 UI
 * panels, never the data):
 *   - AI mentor briefing card (v1 StudentBriefing)
 *   - academic (weekly tests with retake/unlock controls, report cards
 *     with generation, competencies)
 *   - project tasks, engagement (daily check-ins, events)
 *   - certificates with public verify links
 *   - comments thread (v1 Comments tab) + direct message composer
 *   - Phase-1-compliant academic attention signals + one-tap nudge
 *
 * Writes go through the surviving RBAC-guarded v1 endpoints (same data
 * model, audited) — the v2 shell is presentation-only.
 */

/* ---------------- payload (mirror GET /api/v2/instructor/students/[id]) -- */

interface CourseOption {
  id: string;
  name: string;
}

interface StudentCourseSelectionData {
  student: { id: string; name: string; email: string; lastLogin: string | null; joinedAt: string };
  courses: CourseOption[];
  courseSelectionRequired: true;
}

interface StudentProfileData {
  courses: CourseOption[];
  courseSelectionRequired?: false;
  student: { id: string; name: string; email: string; lastLogin: string | null; joinedAt: string };
  courseId: string;
  kpis: { progress: number | null; tasksDone: string; latestScore: number | null; attentionScore: number | null };
  attentionReasons: string[];
  weeklyTests: Array<{
    week: number;
    attempt: number;
    score: number | null;
    originalScore: number | null;
    scoreEditedAt: string | null;
    scoreEditedByRole: string | null;
    scoreEditReason: string | null;
    status: string;
    completedAt: string | null;
    plagiarismScore: number | null;
    strengths: string[];
    weaknesses: string[];
    nextAction: string | null;
    retakeAllowed: boolean;
    replies: number;
  }>;
  reportCards: Array<{
    id: string;
    week: number | null;
    score: number | null;
    grade: string | null;
    version: number;
    createdAt: string;
    versions: Array<{
      version: number;
      score: number | null;
      grade: string | null;
      actorRole: string;
      reason: string;
      createdAt: string;
    }>;
  }>;
  competencies: Array<{ topic: string; level: string }>;
  dailyLogs: Array<{ date: string; confidence: number | null }>;
  tasks: Array<{ id: string; title: string; status: string; week: number }>;
  projects: Array<{
    id: string;
    title: string;
    goal: string | null;
    description: string | null;
    objectives: string[];
    durationWeeks: number | null;
    status: string;
    approvalNote: string | null;
    approvedAt: string | null;
    deadline: string | null;
    updatedAt: string;
    kpis: { taskProgress: number | null; tasksDone: string };
  }>;
  certificates: Array<{ id: string; courseName: string; grade: string; score: number; issuedAt: string; verifyUrl: string }>;
  recentEvents: Array<{ type: string; at: string }>;
  psychWeekly: {
    weeks: Array<{
      weekLabel: string;
      confidencePct: number | null;
      actualPct: number | null;
      gap: number | null;
      coherence: number | null;
      days: number;
    }>;
    avgCoherence: number | null;
    calibration: "overconfident" | "underconfident" | "well_calibrated" | "no_data";
  } | null;
}


type StudentProfileResponse = StudentProfileData | StudentCourseSelectionData;
type TabKey = "academic" | "growth" | "psychology" | "project" | "engagement" | "certificates" | "comments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "academic", label: "Academic" },
  { key: "growth", label: "Growth" },
  { key: "psychology", label: "Psychology" },
  { key: "project", label: "Project" },
  { key: "engagement", label: "Engagement" },
  { key: "certificates", label: "Certificates" },
  { key: "comments", label: "Comments" },
];

const TASK_TONE: Record<string, string> = {
  completed: "bg-success-subtle text-success-on",
  "in-progress": "bg-info-subtle text-info-on",
  planned: "bg-bg-subtle text-fg-muted",
  blocked: "bg-warning-subtle text-warning-on",
};

export function StudentProfile({ studentId }: { studentId: string }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const requestPath = selectedCourseId
    ? `/api/v2/instructor/students/${studentId}?courseId=${encodeURIComponent(selectedCourseId)}`
    : `/api/v2/instructor/students/${studentId}`;
  const { data, error, isLoading, retry } = useApi<StudentProfileResponse>(requestPath);
  const [tab, setTab] = useState<TabKey>("academic");
  const [nudging, setNudging] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [messageText, setMessageText] = useState("");
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

  async function sendMessage() {
    if (!messageText.trim()) return;
    setMessaging(true);
    try {
      await api.post("/api/messages", {
        toId: studentId,
        subject: "Message from your instructor",
        body: messageText.trim(),
      });
      toast.success("Message sent");
      setMessageText("");
    } catch (e) {
      toast.error("Couldn't send message", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setMessaging(false);
    }
  }

  if (isLoading) return <ProfileSkeleton />;
  if (!error && selectedCourseId && data && (!("courseId" in data) || data.courseId !== selectedCourseId)) {
    return <ProfileSkeleton />;
  }

  if (data && "courseSelectionRequired" in data && data.courseSelectionRequired) {
    return (
      <section className="mx-auto w-full max-w-xl space-y-3 rounded-xl border border-line bg-surface p-5">
        <div>
          <h1 className="text-lg font-semibold text-fg">Choose a course</h1>
          <p className="mt-1 text-sm text-fg-muted">
            This learner is enrolled in more than one course you can access. Choose one to view its records.
          </p>
        </div>
        <label htmlFor="student-course-selection" className="block text-sm font-medium text-fg">
          Course
        </label>
        <select
          id="student-course-selection"
          value={selectedCourseId ?? ""}
          onChange={(event) => setSelectedCourseId(event.target.value || null)}
          className="min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <option value="">Select a course</option>
          {data.courses.map((course) => (
            <option key={course.id} value={course.id}>{course.name}</option>
          ))}
        </select>
        <Link href="/instructor/students" className="inline-flex min-h-11 items-center text-sm text-brand hover:text-fg">
          Back to students
        </Link>
      </section>
    );
  }

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

  const atRisk = data.kpis.attentionScore != null && data.kpis.attentionScore >= 30;

  return (
    <div className="space-y-4">
      {data.courses.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <label htmlFor="student-course-view" className="text-sm font-medium text-fg">
            Course view
          </label>
          <select
            id="student-course-view"
            value={data.courseId}
            onChange={(event) => setSelectedCourseId(event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {data.courses.map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </div>
      )}
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
            Course: {data.courses.find((course) => course.id === data.courseId)?.name ?? "Selected course"}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Joined {new Date(data.student.joinedAt).toLocaleDateString()}
            {data.student.lastLogin
              ? ` · last login ${new Date(data.student.lastLogin).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMessaging((v) => !v)}
            aria-pressed={messaging}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
              messaging
                ? "border-brand bg-brand-subtle text-fg"
                : "border-line bg-surface text-fg hover:border-line-strong"
            )}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Message
          </button>
          <button
            type="button"
            onClick={nudge}
            disabled={nudging}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {nudging ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Bell className="h-4 w-4" aria-hidden />
            )}
            Nudge
          </button>
        </div>
      </header>

      {/* message composer */}
      {messaging && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <label htmlFor="instructor-message" className="text-xs font-medium text-fg-muted">
            Message to {data.student.name}
          </label>
          <div className="mt-1.5 flex gap-2">
            <textarea
              id="instructor-message"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={2}
              placeholder="Write a personal message…"
              className="min-h-20 flex-1 resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={messaging || !messageText.trim()}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
            >
              {messaging ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Send
            </button>
          </div>
        </div>
      )}

      <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-fg-muted">
        This view is scoped to the selected course. Learner-wide summaries and unassigned comments are not included here.
      </p>

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
        <Kpi label="Progress" value={data.kpis.progress != null ? `${data.kpis.progress}%` : "—"} icon={TrendingUp} tone={data.kpis.progress != null ? "brand" : "muted"} />
        <Kpi label="Tasks done" value={data.kpis.tasksDone} icon={ClipboardCheck} tone="info" />
        <Kpi
          label="Latest test"
          value={data.kpis.latestScore != null ? `${data.kpis.latestScore}%` : "—"}
          icon={Zap}
          tone={data.kpis.latestScore != null && data.kpis.latestScore < 60 ? "warning" : "muted"}
        />
        <Kpi
          label="Attention"
          value={data.kpis.attentionScore ?? "—"}
          icon={Flame}
          tone={atRisk ? "warning" : data.kpis.attentionScore == null ? "muted" : "success"}
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
      {/* Growth is course-scoped; comment writing remains unavailable until activity-linked. */}
      {tab === "growth" && <GrowthTab data={data} studentId={studentId} />}
      {tab === "psychology" && <PsychologyTab data={data} />}
      {tab === "project" && <ProjectTab data={data} onChanged={retry} />}
      {tab === "engagement" && <EngagementTab data={data} />}
      {tab === "certificates" && <CertificatesTab data={data} />}
      {tab === "comments" && (
        <Empty label="Comment posting is temporarily unavailable here until the composer can attach comments to an activity in this course." />
      )}

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
        <p className="px-1 text-xs text-fg-muted">
          Attempts are kept separately within this selected course. A permitted retake creates a new attempt and preserves the earlier result.
        </p>
        {data.weeklyTests.length === 0 ? (
          <Empty label="No weekly tests yet." />
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.weeklyTests.map((t) => (
              <div key={`${t.week}-${t.attempt}`} className="flex items-center gap-3 px-4 py-3">
                <span className="w-32 shrink-0 truncate text-xs tabular-nums text-fg-muted">Week {t.week} · Attempt {t.attempt}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  {t.score !== null ? (
                    <div className="h-2 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
                      <div
                        className={cn(
                          "h-full rounded-full",
                          t.score >= 60 ? "bg-success" : "bg-warning"
                        )}
                        style={{ width: `${t.score}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-fg-muted">Score unavailable</p>
                  )}
                  {t.scoreEditedAt ? (
                    <p className="text-xs text-fg-muted">
                      Reviewed by {t.scoreEditedByRole ?? "staff"}
                      {t.originalScore !== null ? ` · AI score ${t.originalScore}%` : ""}
                      {t.scoreEditReason ? ` · ${t.scoreEditReason}` : ""}
                    </p>
                  ) : null}
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-fg-secondary">
                  {t.score !== null ? `${t.score}%` : "—"}
                </span>

              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="space-y-1 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Report cards</h2>
          <p className="text-xs text-fg-muted">
            Report cards use evidence from this selected course only. Missing evidence remains unavailable, and new corrections are retained in version history with their reason; older legacy records may have no history.
          </p>
        </div>
        {data.reportCards.length === 0 ? (
          <Empty label="No report cards yet." />
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.reportCards.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    Week {r.week ?? "—"} · {r.grade ?? "Not graded"}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    Version {r.version} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-fg-secondary">
                  {r.score === null ? "—" : `${r.score}%`}
                </span>
                {r.versions.length > 1 ? (
                  <details className="max-w-full text-xs text-fg-muted">
                    <summary className="min-h-11 cursor-pointer rounded-md px-2 py-2 text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                      History ({r.versions.length})
                    </summary>
                    <ol className="mt-2 space-y-2 border-l border-line pl-3">
                      {r.versions.map((version) => (
                        <li key={version.version}>
                          <p className="font-medium text-fg">
                            Version {version.version}{version.version === r.version ? " · Current" : ""}
                            {" · "}{version.score === null ? "Ungraded" : `${version.score}%`}
                            {version.grade ? ` (${version.grade})` : ""}
                          </p>
                          <p>{new Date(version.createdAt).toLocaleDateString()} · {version.actorRole}</p>
                          <p>{version.reason}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Learner-level competencies
        </h2>
        <p className="px-1 text-xs text-fg-muted">
          These records are not attributed to a specific course and are shown separately from course results.
        </p>
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

function parseReportList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [value];
  }
}

function GrowthTab({ data, studentId }: { data: StudentProfileData; studentId: string }) {
  const [report, setReport] = useState<{
    overview?: string;
    strengths?: string[];
    growthAreas?: string[];
    recommendations?: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/growth-reports/${studentId}?courseId=${encodeURIComponent(data.courseId)}`);
      const payload = (await res.json().catch(() => ({}))) as {
        report?: {
          overview?: string;
          strengths?: string | string[];
          growthAreas?: string | string[];
          recommendations?: string | string[];
        };
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Growth report unavailable");
      setReport(payload.report ? {
        ...payload.report,
        strengths: parseReportList(payload.report.strengths),
        growthAreas: parseReportList(payload.report.growthAreas),
        recommendations: parseReportList(payload.report.recommendations),
      } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Growth report unavailable");
    } finally {
      setLoading(false);
    }
  }

  const scored = data.weeklyTests.filter((t): t is (typeof data.weeklyTests)[number] & { score: number } => t.score !== null);

  return (
    <div className="space-y-4">
      {/* score trend */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Score trend
        </h2>
        {scored.length === 0 ? (
          <Empty label="No scored tests yet." />
        ) : (
          <div className="flex h-28 items-end gap-2 rounded-xl border border-line bg-surface p-4">
            {scored.map((t) => (
              <div key={t.week} className="flex min-w-8 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-fg-muted">{t.score}%</span>
                <div
                  className={cn(
                    "w-full rounded-t-md",
                    t.score >= 60 ? "bg-success" : "bg-warning"
                  )}
                  style={{ height: `${Math.max(8, t.score)}%` }}
                  title={`Week ${t.week}: ${t.score}%`}
                />
                <span className="text-[10px] tabular-nums text-fg-muted">W{t.week}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* private growth report (v1 GrowthReportPanel) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Growth report
          </h2>
          {!report && !loading && (
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-fg hover:border-line-strong"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Generate
            </button>
          )}
          {report && (
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-fg hover:border-line-strong"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </button>
          )}
        </div>
        {loading ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-xs text-fg-muted" aria-busy="true">
            <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" aria-hidden />
            Writing the growth report…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-line bg-surface p-4 text-xs font-medium text-danger">
            {error}
          </p>
        ) : report ? (
          <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
            {report.overview && <p className="text-sm leading-relaxed text-fg">{report.overview}</p>}
            {report.strengths && report.strengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-success-on">Strengths</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-fg">
                  {report.strengths.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.growthAreas && report.growthAreas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-warning-on">Growth areas</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-fg">
                  {report.growthAreas.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.recommendations && report.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-fg-secondary">Recommendations</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-fg">
                  {report.recommendations.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <Empty label="No growth report yet — generate one from the test data." />
        )}
      </section>

      {/* competencies */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Learner-level competencies
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

function PsychologyTab({ data }: { data: StudentProfileData }) {
  const completed = data.weeklyTests.filter((t) => t.status === "completed");
  const psych = data.psychWeekly;
  const dkPoints = (psych?.weeks ?? [])
    .filter((w) => w.confidencePct !== null && w.actualPct !== null)
    .map((w) => ({
      confidence: w.confidencePct as number,
      actual: w.actualPct as number,
      week: w.weekLabel,
      gap: w.gap,
    }));

  if (completed.length === 0 && !psych)
    return <Empty label="No psychology data yet — signals appear after the first check-ins and tests." />;

  return (
    <div className="space-y-4">
      {/* Dunning-Kruger calibration — confidence vs actual, weekly averages */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Calibration (Dunning-Kruger)
        </h2>
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          {dkPoints.length === 0 ? (
            <p className="py-6 text-center text-xs text-fg-muted">
              No calibration data yet — needs daily check-in confidence alongside daily test scores.
            </p>
          ) : (
            <DunningKrugerChart points={dkPoints} />
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-fg-secondary">Weekly coherence:</span>
            {psych?.avgCoherence != null ? (
              <>
                <span className="font-semibold tabular-nums text-fg">{psych.avgCoherence}%</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    psych.calibration === "overconfident" && "bg-warning-subtle text-warning-on",
                    psych.calibration === "underconfident" && "bg-info-subtle text-info-on",
                    psych.calibration === "well_calibrated" && "bg-success-subtle text-success-on",
                    psych.calibration === "no_data" && "bg-bg-subtle text-fg-muted",
                  )}
                >
                  {psych.calibration === "overconfident"
                    ? "Overconfident"
                    : psych.calibration === "underconfident"
                      ? "Underconfident"
                      : psych.calibration === "well_calibrated"
                        ? "Well calibrated"
                        : "No data"}
                </span>
              </>
            ) : (
              <span className="text-fg-muted">no calibration weeks yet</span>
            )}
          </div>
          {(psych?.weeks ?? []).filter((w) => w.coherence !== null).length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(psych?.weeks ?? [])
                .filter((w) => w.coherence !== null)
                .slice(-6)
                .reverse()
                .map((w) => (
                  <li key={w.weekLabel} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="w-12 shrink-0 font-medium text-fg-secondary">{w.weekLabel}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${w.coherence}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right tabular-nums text-fg">{w.coherence}%</span>
                    {w.gap !== null && (
                      <span
                        className={cn(
                          "w-24 shrink-0 text-right text-[10px] font-medium",
                          w.gap > 20 && "text-warning-on",
                          w.gap < -20 && "text-info-on",
                          w.gap >= -20 && w.gap <= 20 && "text-success-on",
                        )}
                      >
                        {w.gap > 20 ? "overconfident" : w.gap < -20 ? "underconfident" : "on point"}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      <p className="px-1 text-xs leading-relaxed text-fg-muted">
        Derived from the Socratic examiner&apos;s per-test analysis: plagiarism flags,
        strengths and weaknesses, the recommended next action, and reply engagement.
      </p>
      {completed.map((t) => (
        <div key={t.week} className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-fg">Week {t.week}</p>
            <div className="flex items-center gap-1.5">
              {t.plagiarismScore != null && t.plagiarismScore > 40 && (
                <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-[10px] font-semibold text-danger-on">
                  plagiarism {t.plagiarismScore}%
                </span>
              )}
              <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold tabular-nums text-fg-muted">
                {t.replies} replies
              </span>
              {t.retakeAllowed && (
                <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold text-warning-on">
                  retake allowed
                </span>
              )}
            </div>
          </div>
          {t.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-success-on">Strengths</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-fg">
                {t.strengths.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {t.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-warning-on">Weaknesses</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-fg">
                {t.weaknesses.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {t.nextAction && (
            <p className="text-sm leading-relaxed text-fg">
              <span className="text-xs font-semibold text-fg-secondary">Next action: </span>
              {t.nextAction}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}


function ProjectTab({ data, onChanged }: { data: StudentProfileData; onChanged?: () => void }) {
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(projectId: string, decision: "approve" | "reject") {
    setBusyId(projectId);
    try {
      await api.post(`/api/v2/projects/${projectId}/approve`, {
        decision,
        note: decision === "reject" ? note : undefined,
      });
      toast.success(
        decision === "approve"
          ? "Project approved — the learner can now generate their timeline"
          : "Proposal sent back for changes",
      );
      setNoteFor(null);
      setNote("");
      onChanged?.();
    } catch (e) {
      toast.error("Couldn't update the project", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Projects
      </h2>
      {data.projects.length === 0 ? (
        <Empty label="No projects yet." />
      ) : (
        <div className="space-y-3">
          {data.projects.map((p) => (
            <div key={p.id} className="space-y-2 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-fg">{p.title}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                    p.status === "pending_approval" && "bg-warning-subtle text-warning-on",
                    p.status === "approved" && "bg-success-subtle text-success-on",
                    p.status === "rejected" && "bg-danger/10 text-danger",
                    p.status === "active" && "bg-info-subtle text-info-on",
                  )}
                >
                  {p.status === "pending_approval"
                    ? "Awaiting approval"
                    : p.status === "rejected"
                      ? "Needs changes"
                      : p.status === "approved"
                        ? "Approved"
                        : p.status.replace("_", " ")}
                </span>
              </div>
              {p.goal && <p className="text-xs text-fg-secondary">{p.goal}</p>}
              {p.description && (
                <p className="text-xs leading-relaxed text-fg-muted">{p.description}</p>
              )}
              {p.objectives.length > 0 && (
                <ul className="space-y-0.5">
                  {p.objectives.map((o, i) => (
                    <li key={i} className="text-xs text-fg-muted">• {o}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
                {p.durationWeeks ? <span>{p.durationWeeks}-week timeline</span> : null}
                {p.deadline ? <span>Due {new Date(p.deadline).toLocaleDateString()}</span> : null}
                <span>{p.kpis.tasksDone} tasks</span>
                {p.approvedAt ? <span>Decided {new Date(p.approvedAt).toLocaleDateString()}</span> : null}
              </div>
              {(p.status === "approved" || p.status === "rejected") && p.approvalNote && (
                <p className="text-xs italic text-fg-muted">&ldquo;{p.approvalNote}&rdquo;</p>
              )}
              {p.status === "pending_approval" && (
                <div className="space-y-2 border-t border-line pt-3">
                  {noteFor === p.id && (
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Feedback for the learner (shown with the decision)"
                      aria-label="Approval note"
                      className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs text-fg placeholder:text-fg-muted"
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => decide(p.id, "approve")}
                      disabled={busyId === p.id}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
                    >
                      {busyId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Approve
                    </button>
                    {noteFor === p.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => decide(p.id, "reject")}
                          disabled={busyId === p.id || !note.trim()}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 text-xs font-semibold text-danger disabled:opacity-50"
                        >
                          Send back with note
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNoteFor(null);
                            setNote("");
                          }}
                          className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium text-fg-muted hover:text-fg"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNoteFor(p.id)}
                        disabled={busyId === p.id}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fg hover:border-line-strong disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Send back…
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Task activity
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

function DunningKrugerChart({
  points,
}: {
  points: Array<{ confidence: number; actual: number; week: string; gap: number | null }>;
}) {
  const c = useChartColors();
  return (
    <div className="h-60 w-full" aria-label="Calibration scatter: self-rated confidence vs actual score">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
          <XAxis
            type="number"
            dataKey="confidence"
            name="Confidence"
            domain={[0, 100]}
            stroke={c.axis}
            tick={{ fontSize: 11 }}
            label={{ value: "Confidence %", position: "insideBottom", offset: -10, fontSize: 11, fill: c.axis }}
          />
          <YAxis
            type="number"
            dataKey="actual"
            name="Actual"
            domain={[0, 100]}
            stroke={c.axis}
            tick={{ fontSize: 11 }}
            label={{ value: "Actual %", angle: -90, position: "insideLeft", fontSize: 11, fill: c.axis }}
          />
          <ZAxis type="number" range={[80, 80]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={tooltipStyle(c)}
            formatter={(value: number | string, name: string) => [`${value}%`, name]}
            labelFormatter={() => ""}
          />
          {/* Diagonal = perfectly calibrated; below-right = overconfident */}
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke={c.chart3} strokeDasharray="4 4" />
          <Scatter data={points} fill={c.chart1} />
        </ScatterChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[10px] text-fg-muted">
        One point per week (daily averages rolled up). Diagonal = perfectly calibrated; below-right = overconfident.
      </p>
    </div>
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
