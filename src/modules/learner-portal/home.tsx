"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Flame,
  GraduationCap,
  Play,
  RefreshCw,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Kpi, StatStrip } from "@/modules/ui/kpi";
import { ListCard, ListCardRow } from "@/modules/ui/list-card";
import { useApi } from "./use-api";
import { CheckInCard } from "./checkin-card";

/**
 * modules/learner-portal — L1 Home (REDESIGN-P3 §L1)
 *
 * FoF = ContinueCard with time-budget chips. Then learner KPIs,
 * due-today and announcements. One endpoint feeds the whole page.
 * md: 2-col (continue+kpi | due+announcements). lg/xl: 12-col dense.
 */

/* ---------------- payload types (mirror GET /api/v2/learner/home) ---- */

interface ContinueInfo {
  courseId: string;
  courseName: string;
  nextLesson: string;
  kind: "start" | "learn" | "review" | "done";
  href: string;
}

interface DueItem {
  id: string;
  kind: "daily-test";
  title: string;
  meta: string;
  href: string;
}

interface Announcement {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  courseName: string | null;
  taskProgress: number;
  tasksDone: string;
}

interface HomeData {
  learner: {
    totalXP: number;
    level: string;
    streakCurrent: number;
    enrolledCount: number;
  };
  continue: ContinueInfo | null;
  dueToday: DueItem[];
  announcements: Announcement[];
  projects: ProjectRow[];
}

/* ---------------- time budget chips (15m / 30m / 1h / open) ---------- */

const BUDGETS: { label: string; minutes: number | null }[] = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "∞", minutes: null },
];

/* ---------------- page ------------------------------------------------ */

export function LearnerHome() {
  const { data, error, isLoading, retry } = useApi<HomeData>("/api/v2/learner/home");

  if (isLoading) return <HomeSkeleton />;
  if (error) return <HomeError message={error} onRetry={retry} />;
  if (!data) return null;

  // No enrollments → catalog CTA card (spec empty state).
  if (data.learner.enrolledCount === 0) return <NoEnrollment />;

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            Your learning space
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg md:text-2xl">
            {greeting()}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-fg-secondary">
            Pick up where you left off, or take one small step forward.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-fg">
          <Trophy className="h-3.5 w-3.5 text-brand" aria-hidden />
          {data.learner.level}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7 lg:space-y-6">
          {data.continue && <ContinueCard info={data.continue} />}
          <StatStrip>
            <Kpi
              label="Streak"
              value={`${data.learner.streakCurrent}d`}
              icon={<Flame className="h-4 w-4" aria-hidden />}
            />
            <Kpi
              label="Total XP"
              value={data.learner.totalXP.toLocaleString()}
              icon={<Zap className="h-4 w-4" aria-hidden />}
            />
            <Kpi
              label="Ready to practice"
              value={data.dueToday.length}
              icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
            />
            <Kpi
              label="Courses"
              value={data.learner.enrolledCount}
              icon={<BookOpen className="h-4 w-4" aria-hidden />}
            />
          </StatStrip>
          <CheckInCard courseId={data.continue?.courseId} />
        </div>

        <div className="space-y-4 lg:col-span-5 lg:space-y-6">
          <DueToday items={data.dueToday} />
          {data.projects.length > 0 && <Projects items={data.projects} />}
          <Announcements items={data.announcements} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- continue card --------------------------------------- */

function ContinueCard({ info }: { info: ContinueInfo }) {
  const ctaLabel =
    info.kind === "start"
      ? "Start learning"
      : info.kind === "done"
        ? "Revisit course"
        : info.kind === "review"
          ? "Review today"
          : "Resume lesson";
  const statusLabel =
    info.kind === "start"
      ? "New course"
      : info.kind === "done"
        ? "Course complete"
        : info.kind === "review"
          ? "Ready to review"
          : "In progress";

  return (
    <section
      aria-label="Your next learning step"
      className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-subtle via-surface to-bg-subtle p-5 shadow-sm md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted">
          Your next step
        </p>
        <span className="rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] font-semibold text-fg-secondary">
          {statusLabel}
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-fg md:text-2xl">
        {info.courseName}
      </h2>
      <p className="mt-1 text-sm text-fg-secondary">{info.nextLesson}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={info.href}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90"
        >
          <Play className="h-4 w-4" aria-hidden />
          {ctaLabel}
        </Link>
        {info.kind !== "done" && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Start a timed session">
            <span className="mr-0.5 text-xs text-fg-muted">Session:</span>
            {BUDGETS.map((b) => (
              <Link
                key={b.label}
                href={b.minutes ? `${info.href}?budget=${b.minutes}` : info.href}
                aria-label={`Start ${b.minutes ? `${b.minutes} minute` : "open-ended"} session`}
                className="inline-flex h-9 min-w-11 items-center justify-center rounded-full border border-line px-3 text-xs font-semibold text-fg-secondary transition-colors hover:border-brand hover:bg-brand-subtle hover:text-fg"
              >
                {b.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- due today ------------------------------------------- */

function DueToday({ items }: { items: DueItem[] }) {
  return (
    <ListCard
      header={
        <span>
          Ready to practice <span className="normal-case text-fg-muted">({items.length})</span>
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-fg-muted">
          No daily test ready yet. Study a lesson to unlock your next practice.
        </p>
      ) : (
        items.map((item) => (
          <ListCardRow
            key={item.id}
            href={item.href}
            leading={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-subtle text-warning-on">
                <ClipboardCheck className="h-4 w-4" aria-hidden />
              </span>
            }
            title="Daily test"
            meta={item.meta}
            trailing={<ChevronRight className="h-4 w-4 text-fg-muted" aria-hidden />}
          />
        ))
      )}
    </ListCard>
  );
}

/* ---------------- projects (v2 flow) ------------------------------------ */

const PROJECT_STATUS_LABEL: Record<string, string> = {
  pending_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Needs changes",
  active: "In progress",
};

function Projects({ items }: { items: ProjectRow[] }) {
  return (
    <ListCard
      header={
        <span className="flex items-center justify-between">
          Projects
          <Link href="/learner/projects" className="text-xs font-medium text-brand hover:underline">
            See all
          </Link>
        </span>
      }
    >
      {items.map((p) => (
        <ListCardRow
          key={p.id}
          href={`/learner/projects/${p.id}`}
          leading={
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-subtle text-fg">
              <Target className="h-4 w-4" aria-hidden />
            </span>
          }
          title={p.title}
          meta={`${p.courseName ?? "Project"} · ${PROJECT_STATUS_LABEL[p.status] ?? p.status} · ${p.tasksDone} tasks`}
          trailing={<ChevronRight className="h-4 w-4 text-fg-muted" aria-hidden />}
        />
      ))}
    </ListCard>
  );
}

/* ---------------- announcements ---------------------------------------- */

function Announcements({ items }: { items: Announcement[] }) {
  return (
    <ListCard header="Announcements">
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-fg-muted">No announcements yet.</p>
      ) : (
        items.map((a) => (
          <ListCardRow
            key={a.id}
            href={a.link ?? undefined}
            leading={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
                <Bell className="h-4 w-4" aria-hidden />
              </span>
            }
            title={
              <span className="flex items-center gap-1.5">
                {!a.read && <span aria-label="unread" className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                {a.title}
              </span>
            }
            meta={`${timeAgo(a.createdAt)}${a.body ? ` — ${a.body}` : ""}`}
          />
        ))
      )}
    </ListCard>
  );
}

/* ---------------- states ----------------------------------------------- */

function HomeSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true">
      <div className="h-7 w-48 animate-pulse rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7 lg:space-y-6">
          <div className="h-44 animate-pulse rounded-xl bg-bg-subtle" />
          <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" />
        </div>
        <div className="space-y-4 lg:col-span-5 lg:space-y-6">
          <div className="h-32 animate-pulse rounded-xl bg-bg-subtle" />
          <div className="h-32 animate-pulse rounded-xl bg-bg-subtle" />
        </div>
      </div>
    </div>
  );
}

function HomeError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load your home feed</p>
      <p className="mt-1 text-xs text-fg-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry
      </button>
    </div>
  );
}

function NoEnrollment() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-subtle text-fg">
          <GraduationCap className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-semibold text-fg">Start your first course</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
          Choose a course to build your learning path and study at your own pace.
        </p>
        <Link
          href="/learner/learn"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand/90"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          Browse courses
        </Link>
      </div>

      {/* onboarding guide (v1 OnboardingGuide) */}
      <OnboardingGuide />
    </div>
  );
}

function OnboardingGuide() {
  const STEPS = [
    { n: 1, label: "Enroll in a course", href: "/learner/learn", desc: "Pick a course from the catalog to start your journey." },
    { n: 2, label: "Open your first lesson", href: "/learner/learn", desc: "The classroom has slides, video and an AI tutor on stage." },
    { n: 3, label: "Practice with the AI examiner", href: "/learner/practice", desc: "Have a Socratic conversation — the examiner probes your understanding." },
    { n: 4, label: "Take the weekly test", href: "/learner/exams/weekly", desc: "10 concept questions, graded on reasoning — not word count." },
    { n: 5, label: "Claim your certificate", href: "/learner/progress", desc: "Finish all weekly tests to earn a verified credential." },
  ] as const;
  return (
    <section aria-label="Getting started" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Getting started
      </h2>
      <ol className="mt-3 space-y-2">
        {STEPS.map((s) => (
          <li key={s.n}>
            <Link
              href={s.href}
              className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-bg-subtle"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[11px] font-semibold text-fg">
                {s.n}
              </span>
              <span>
                <span className="block text-sm font-medium text-fg">{s.label}</span>
                <span className="block text-xs text-fg-muted">{s.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------- helpers ----------------------------------------------- */

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}
