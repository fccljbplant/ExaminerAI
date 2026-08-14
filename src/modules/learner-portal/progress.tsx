"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Award,
  CalendarClock,
  ChevronRight,
  Flame,
  GraduationCap,
  Medal,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Kpi, StatStrip } from "@/modules/ui/kpi";
import { RadialProgress } from "@/modules/ui/radial-progress";
import { useApi } from "./use-api";
import { PrivateReports, ClaimCertificate } from "./reports";

/**
 * modules/learner-portal — L11 Progress (REDESIGN-P3 §L11)
 *
 * Per-course rings, streak KPIs, a 14-day XP activity strip, badges,
 * credentials and weak topics — all from GET /api/v2/learner/progress.
 */

/* ---------------- payload types ----------------------------------------- */

interface ProgressData {
  learner: {
    totalXP: number;
    level: string;
    streakCurrent: number;
    streakLongest: number;
  };
  courses: {
    courseId: string;
    courseName: string;
    percent: number;
    position: { week: number; day: number } | null;
    totalWeeks: number;
    totalXP: number;
    streakCurrent: number;
  }[];
  activity: { date: string; xp: number }[];
  badges: {
    id: string;
    awardedAt: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    rarity: string;
  }[];
  certificates: Array<{
    id: string;
    courseName: string;
    grade: string;
    score: number;
    issuedAt: string;
    verifyUrl: string | null;
  }>;
  weakTopics: { topic: string; pillar: string; masteryLevel: string; trend: string }[];
  reportCards: Array<{ id: string; week: number; grade: string; score: number; date: string; progress: string }>;
  weeklyTests: Array<{ week: number; score: number | null }>;
  checkins: Array<{ date: string; confidence: number }>;
}

/* ---------------- page ----------------------------------------------------- */

export function LearnerProgress() {
  const { data, error, isLoading, retry } = useApi<ProgressData>("/api/v2/learner/progress");

  if (isLoading) return <ProgressSkeleton />;
  if (error) return <ProgressError message={error} onRetry={retry} />;
  if (!data) return null;

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Progress</h1>

      {/* L12 Study-Flow Center entry — keeps the 5-tab rule intact while
          giving the study-flow engine a home reachable from Progress. */}
      <Link
        href="/learner/study"
        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-brand-subtle p-4 transition-colors hover:border-brand focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 shrink-0 text-fg" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-fg">Study Flow Center</span>
            <span className="block text-xs text-fg-secondary">
              A daily plan that fits your time — reviews, catch-ups and quick sessions.
            </span>
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-fg-muted" aria-hidden />
      </Link>

      <StatStrip>
        <Kpi
          label="Level"
          value={data.learner.level}
          icon={<GraduationCap className="h-4 w-4" aria-hidden />}
        />
        <Kpi
          label="Total XP"
          value={data.learner.totalXP.toLocaleString()}
          icon={<Zap className="h-4 w-4" aria-hidden />}
        />
        <Kpi
          label="Current streak"
          value={`${data.learner.streakCurrent}d`}
          icon={<Flame className="h-4 w-4" aria-hidden />}
        />
        <Kpi
          label="Best streak"
          value={`${data.learner.streakLongest}d`}
          icon={<Medal className="h-4 w-4" aria-hidden />}
        />
      </StatStrip>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7 lg:space-y-6">
          <CourseRings courses={data.courses} />
          <ActivityStrip activity={data.activity} />
          <PrivateReports />
        </div>

        <div className="space-y-4 lg:col-span-5 lg:space-y-6">
          <Credentials certificates={data.certificates} courses={data.courses} />
          <WeeklyTests tests={data.weeklyTests} />
          <ReportCards cards={data.reportCards} />
          <CheckinsHeatmap checkins={data.checkins} />
          <Badges badges={data.badges} />
          <WeakTopics topics={data.weakTopics} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- course rings ---------------------------------------------- */

function CourseRings({ courses }: { courses: ProgressData["courses"] }) {
  return (
    <section aria-label="Course progress" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Courses</h2>
      {courses.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
          No enrollments yet —{" "}
          <Link href="/learner/learn" className="font-semibold text-brand hover:underline">
            browse the catalog
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.courseId}>
              <Link
                href={`/learner/courses/${c.courseId}`}
                className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-bg-subtle"
              >
                <RadialProgress value={c.percent} size="md" autoTone label={`${c.courseName} progress`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{c.courseName}</p>
                  {c.position && (
                    <p className="mt-0.5 text-xs text-fg-muted">
                      Week {c.position.week} · Day {c.position.day}
                    </p>
                  )}
                  <p className="mt-1 text-xs tabular-nums text-fg-secondary">{c.totalXP} XP</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- 14-day activity strip -------------------------------------- */

function ActivityStrip({ activity }: { activity: ProgressData["activity"] }) {
  const max = Math.max(1, ...activity.map((d) => d.xp));
  const total = activity.reduce((sum, d) => sum + d.xp, 0);

  return (
    <section aria-label="Activity — last 14 days" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Last 14 days</h2>
        <p className="text-xs tabular-nums text-fg-secondary">{total} XP earned</p>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1.5" role="img" aria-label={`Daily XP for the last 14 days, ${total} total`}>
        {activity.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              title={`${d.date}: ${d.xp} XP`}
              className={
                "w-full rounded-sm " +
                (d.xp > 0 ? "bg-brand" : "bg-bg-subtle")
              }
              style={{ height: `${Math.max(6, Math.round((d.xp / max) * 100))}%` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- credentials --------------------------------------------------- */

function Credentials({
  certificates,
  courses,
}: {
  certificates: ProgressData["certificates"];
  courses: ProgressData["courses"];
}) {
  const completedCourses = courses.filter((c) => c.percent >= 100);
  const claimedNames = new Set(certificates.map((c) => c.courseName));
  const claimable = completedCourses.filter((c) => !claimedNames.has(c.courseName));
  return (
    <section aria-label="Credentials" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Credentials</h2>
      {certificates.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">Complete a course to earn a verified credential.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {certificates.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                <Award className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{c.courseName}</p>
                <p className="mt-0.5 truncate text-xs text-fg-muted">
                  {new Date(c.issuedAt).toLocaleDateString()}
                  {c.grade} · {c.score}%
                </p>
              </div>
              {c.verifyUrl ? (
                <a
                  href={c.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md border border-line bg-bg-subtle px-2 py-1 text-xs font-medium text-fg hover:border-line-strong"
                >
                  Verify
                </a>
              ) : (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">
                  {c.grade}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {claimable.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-line pt-3">
          <p className="text-xs font-medium text-fg-muted">Completed — claim your credential:</p>
          {claimable.map((c) => (
            <ClaimCertificate key={c.courseId} courseId={c.courseId} courseName={c.courseName} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- badges ---------------------------------------------------------- */

function WeeklyTests({ tests }: { tests: ProgressData["weeklyTests"] }) {
  if (tests.length === 0) return null;
  return (
    <section aria-label="Weekly tests" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Weekly tests</h2>
      <div className="mt-3 space-y-2">
        {tests.map((t) => (
          <div key={t.week} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs tabular-nums text-fg-muted">Week {t.week}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
              <div
                className={`h-full rounded-full ${(t.score ?? 0) >= 60 ? "bg-success" : "bg-warning"}`}
                style={{ width: `${t.score ?? 0}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-fg-secondary">
              {t.score != null ? `${t.score}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportCards({ cards }: { cards: ProgressData["reportCards"] }) {
  if (cards.length === 0) return null;
  return (
    <section aria-label="Report cards" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Report cards</h2>
      <div className="mt-3 divide-y divide-line">
        {cards.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">
                Week {r.week} · {r.grade}
              </p>
              <p className="truncate text-xs text-fg-muted">
                {new Date(r.date).toLocaleDateString()} · {r.progress}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-fg-secondary">{r.score}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CheckinsHeatmap({ checkins }: { checkins: ProgressData["checkins"] }) {
  if (checkins.length === 0) return null;
  return (
    <section aria-label="Daily check-ins" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Daily check-ins · last 35 days
      </h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {checkins.map((c) => (
          <span
            key={c.date}
            title={`${c.date} · confidence ${c.confidence}/5`}
            className={`rounded-md px-2 py-1 text-[11px] tabular-nums ${
              c.confidence >= 3 ? "bg-success-subtle text-success-on" : "bg-bg-subtle text-fg-muted"
            }`}
          >
            {c.date.slice(5)}
          </span>
        ))}
      </div>
    </section>
  );
}

function Badges({ badges }: { badges: ProgressData["badges"] }) {
  return (
    <section aria-label="Badges" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Badges</h2>
      {badges.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">Badges appear here as you hit milestones.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {badges.map((b) => (
            <li
              key={b.id}
              title={b.description}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-line bg-bg-subtle/50 p-3 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle text-fg">
                <Medal className="h-5 w-5" aria-hidden />
              </span>
              <p className="line-clamp-1 text-xs font-semibold text-fg">{b.name}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">{b.rarity}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- weak topics ------------------------------------------------------- */

function WeakTopics({ topics }: { topics: ProgressData["weakTopics"] }) {
  return (
    <section aria-label="Topics to strengthen" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">To strengthen</h2>
      {topics.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No weak topics detected — keep going.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {topics.map((t) => (
            <li
              key={t.topic}
              className="flex items-center justify-between gap-2 rounded-lg bg-bg-subtle/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{t.topic}</p>
                <p className="text-xs text-fg-muted">{t.pillar}</p>
              </div>
              {t.trend === "up" ? (
                <TrendingUp className="h-4 w-4 shrink-0 text-success" aria-label="trending up" />
              ) : t.trend === "down" ? (
                <TrendingDown className="h-4 w-4 shrink-0 text-danger" aria-label="trending down" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- states --------------------------------------------------------------- */

function ProgressSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-7 w-36 animate-pulse rounded-md bg-bg-subtle" />
      <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-bg-subtle" />
        <div className="h-64 animate-pulse rounded-xl bg-bg-subtle" />
      </div>
    </div>
  );
}

function ProgressError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load your progress</p>
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
