"use client";

// src/modules/ui-v3/learner-home.tsx — V3 learner dashboard CONTENT (no shell).
// Field paths aligned to the real /api/v2/learner/home response shape:
//   { learner: {totalXP,level,streakCurrent,enrolledCount}, continue: {...}|null,
//     dueToday: [...], announcements: [...], projects: [...] }

import { V3Card, V3Badge, V3Progress, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";
import { StateError, StateSkeleton, StateSkeletonHero } from "./states";

interface LearnerSummary {
  totalXP?: number;
  level?: string;
  streakCurrent?: number;
  enrolledCount?: number;
}

interface ContinueInfo {
  courseId?: string;
  courseName?: string;
  nextLesson?: string;
  kind?: "learn" | "review" | "done";
  href?: string;
}

interface DueItem {
  id?: string;
  kind?: string;
  title?: string;
  meta?: string;
  href?: string;
}

interface Announcement {
  id?: string;
  type?: string;
  title?: string;
  body?: string | null;
  link?: string | null;
  read?: boolean;
  createdAt?: string;
}

interface ProjectRow {
  id?: string;
  title?: string;
  status?: string;
  courseName?: string | null;
  taskProgress?: number;
  tasksDone?: string;
}

interface LearnerHomeData {
  learner?: LearnerSummary;
  continue?: ContinueInfo | null;
  dueToday?: DueItem[];
  announcements?: Announcement[];
  projects?: ProjectRow[];
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(value?: string): string {
  if (!value) return "";
  try {
    const diff = Date.now() - new Date(value).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch {
    return "";
  }
}

export function V3LearnerHomeContent() {
  const { data, loading, error, retry } = useApi<LearnerHomeData>("/api/v2/learner/home");

  if (loading) {
    return (
      <>
        <StateSkeletonHero />
        <StateSkeleton cards={3} />
      </>
    );
  }
  if (error) return <StateError message={error} onRetry={retry} />;

  const d = data ?? {};
  const learner = d.learner ?? {};
  const continueInfo = d.continue;
  const dueToday = d.dueToday ?? [];
  const announcements = d.announcements ?? [];
  const projects = d.projects ?? [];

  return (
    <>
      <V3PageHeader
        title={`${greeting()} 👋`}
        subtitle="Here's what's waiting for you today."
        action={
          continueInfo?.href ? (
            <a href={continueInfo.href} className="v3-btn v3-btn-primary">Continue learning →</a>
          ) : (
            <a href="/learner/learn" className="v3-btn v3-btn-primary">Browse courses →</a>
          )
        }
      />

      {/* Hero stat strip — learner KPIs */}
      <div className="v3-grid v3-grid-4" style={{ marginBottom: "var(--p-space-5)" }}>
        <V3Card className="v3-today-card">
          <h3>Total XP</h3>
          <div className="v3-stat-number">{learner.totalXP ?? 0}</div>
        </V3Card>
        <V3Card className="v3-today-card">
          <h3>Level</h3>
          <div className="v3-stat-number" style={{ fontSize: "var(--p-type-lg)", marginTop: "var(--p-space-4)" }}>
            {learner.level ?? "Rookie"}
          </div>
        </V3Card>
        <V3Card className="v3-today-card">
          <h3>Streak</h3>
          <div className="v3-stat-number">{learner.streakCurrent ?? 0}</div>
          <div className="v3-stat-label">days in a row</div>
        </V3Card>
        <V3Card className="v3-today-card">
          <h3>Enrolled</h3>
          <div className="v3-stat-number">{learner.enrolledCount ?? 0}</div>
          <div className="v3-stat-label">courses</div>
        </V3Card>
      </div>

      <div className="v3-grid v3-grid-2">
        {/* Continue Learning hero card */}
        <V3Card className="v3-continue-card">
          <V3Badge>CONTINUE LEARNING</V3Badge>
          {continueInfo ? (
            <>
              <h2>{continueInfo.courseName ?? "Your course"}</h2>
              <p>{continueInfo.nextLesson ?? "Pick up where you left off"}</p>
              <br />
              <a href={continueInfo.href ?? "/learner/learn"} className="v3-btn">
                {continueInfo.kind === "done" ? "Review lesson →" : "Resume lesson →"}
              </a>
            </>
          ) : (
            <>
              <h2>Ready to start learning</h2>
              <p>Pick a course below to begin. Your AI tutor will guide you through every topic.</p>
              <br />
              <a href="/learner/learn" className="v3-btn">Browse courses →</a>
            </>
          )}
        </V3Card>

        {/* Today's plan — real dueToday items from API */}
        <V3Card>
          <h3>Today&apos;s learning plan</h3>
          <p>{dueToday.length === 0
            ? "Nothing scheduled for today — pick a course and start fresh."
            : `${dueToday.length} item${dueToday.length === 1 ? "" : "s"} to keep you moving forward.`}</p>
          {dueToday.length > 0 && dueToday.map((item, i) => (
            <a
              key={item.id ?? i}
              href={item.href ?? "#"}
              className="v3-course-row"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="v3-course-icon" aria-hidden>
                {item.kind === "daily-test" ? "✓" : "▶"}
              </div>
              <div className="v3-course-info">
                <strong>{item.title ?? "Untitled"}</strong>
                <small>{item.meta ?? ""}</small>
              </div>
              {i === 0 && <V3Badge>Next</V3Badge>}
            </a>
          ))}
        </V3Card>
      </div>

      <V3SectionTitle
        title="Projects"
        linkHref="/learner/projects"
        linkLabel="View all →"
      />

      <V3Card>
        {projects.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)" }}>
            No active projects. Projects appear here once you start a capstone.
          </p>
        ) : (
          projects.map((p, i) => (
            <div key={p.id ?? i} className="v3-course-row">
              <div className="v3-course-icon" aria-hidden>📁</div>
              <div className="v3-course-info">
                <strong>{p.title ?? "Untitled project"}</strong>
                <small>
                  {p.courseName ? `${p.courseName} · ` : ""}{p.tasksDone ?? "0/0"} tasks · {p.status ?? "—"}
                </small>
              </div>
              <div style={{ width: 160 }}>
                <V3Progress value={p.taskProgress ?? 0} />
              </div>
              <a href={`/learner/projects/${p.id ?? ""}`} className="v3-btn">Open</a>
            </div>
          ))
        )}
      </V3Card>

      <V3SectionTitle
        title="Announcements"
        linkHref="/learner/messages"
        linkLabel="View all →"
      />

      <V3Card>
        {announcements.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)" }}>
            No announcements right now.
          </p>
        ) : (
          announcements.map((a, i) => (
            <div key={a.id ?? i} className="v3-attention-item">
              <div>
                <strong>{a.title ?? "Untitled"}</strong>
                {a.body && <p>{a.body}</p>}
              </div>
              <small style={{ color: "var(--text-muted)", fontSize: "var(--p-type-xs)" }}>
                {timeAgo(a.createdAt)}
              </small>
            </div>
          ))
        )}
      </V3Card>
    </>
  );
}
