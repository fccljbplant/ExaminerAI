"use client";

// src/modules/ui-v3/learner-home.tsx — V3 learner dashboard CONTENT (no shell).
// The shell (sidebar + topbar) is provided by the layout's V3Shell.
// Uses useApi() which auto-unwraps the { ok, data } envelope, so the
// /api/v2/learner/home payload arrives here as the real shape, not
// wrapped. Loading/empty/error states use the shared State* components.

import { V3Card, V3Badge, V3Progress, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";
import { StateError, StateSkeleton, StateSkeletonHero } from "./states";

/** Shape mirrored from GET /api/v2/learner/home */
interface LearnerHomeData {
  userName?: string;
  courseName?: string;
  lessonTitle?: string;
  courseProgress?: number;
  nextLesson?: string;
  practiceCount?: number;
  todayPlan?: Array<{ title: string; meta: string; badge?: string }>;
  courses?: Array<{ id?: string; name: string; lessons: string; progress: number }>;
}

function greeting(): string {
  // Local time-of-day greeting — fixes audit finding "always says 'Good afternoon'".
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
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
  if (error) {
    return <StateError message={error} onRetry={retry} />;
  }

  const d = data ?? {};
  const hasContinue = Boolean(d.courseName);

  return (
    <>
      <V3PageHeader
        title={`${greeting()}, ${d.userName ?? "Learner"} 👋`}
        subtitle="You're making great progress. Let's continue learning."
        action={
          <a href="/learner/learn" className="v3-btn v3-btn-primary">Continue learning →</a>
        }
      />

      <div className="v3-grid v3-grid-2">
        <V3Card className="v3-continue-card">
          <V3Badge>CONTINUE LEARNING</V3Badge>
          <h2>{d.courseName ?? "Your next lesson"}</h2>
          <p>{d.lessonTitle ?? "Start your learning journey"}</p>
          <V3Progress value={d.courseProgress ?? 0} />
          <p>{d.courseProgress ?? 0}% completed</p>
          <br />
          <a href="/learner/learn" className="v3-btn">
            {hasContinue ? "Resume lesson →" : "Browse courses →"}
          </a>
        </V3Card>

        <V3Card>
          <h3>Today&apos;s learning plan</h3>
          <p>3 small actions to keep you moving forward.</p>
          {(d.todayPlan ?? []).length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)" }}>
              Nothing scheduled for today — pick a course and start fresh.
            </p>
          ) : null}
          {(d.todayPlan ?? []).map((item, i) => (
            <div key={i} className="v3-course-row">
              <div className="v3-course-icon">{item.badge ? "▶" : "✦"}</div>
              <div className="v3-course-info">
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </div>
              {item.badge && <V3Badge>{item.badge}</V3Badge>}
            </div>
          ))}
        </V3Card>
      </div>

      <V3SectionTitle
        title="Learning overview"
        linkHref="/learner/progress"
        linkLabel="View full progress →"
      />

      <div className="v3-grid v3-grid-3">
        <V3Card className="v3-today-card">
          <div className="v3-today-icon" aria-hidden>◉</div>
          <h3>Next lesson</h3>
          <p>{d.nextLesson ?? "Start learning"}</p>
        </V3Card>
        <V3Card className="v3-today-card">
          <div className="v3-today-icon" aria-hidden>✦</div>
          <h3>Practice</h3>
          <p>{d.practiceCount ?? 0} recommended questions</p>
        </V3Card>
        <V3Card className="v3-today-card">
          <div className="v3-today-icon" aria-hidden>↗</div>
          <h3>Overall progress</h3>
          <p>{d.courseProgress ?? 0}% · this week</p>
        </V3Card>
      </div>

      <V3SectionTitle
        title="My courses"
        linkHref="/learner/courses"
        linkLabel="View all →"
      />

      <V3Card>
        {(d.courses ?? []).length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)" }}>
            You&apos;re not enrolled in any courses yet.{" "}
            <a href="/learner/learn" style={{ color: "var(--brand)", fontWeight: 600 }}>
              Browse the catalog →
            </a>
          </p>
        ) : (
          d.courses!.map((course, i) => (
            <div key={course.id ?? i} className="v3-course-row">
              <div className="v3-course-icon" aria-hidden>∑</div>
              <div className="v3-course-info">
                <strong>{course.name}</strong>
                <small>{course.lessons} lessons completed</small>
              </div>
              <div style={{ width: 160 }}>
                <V3Progress value={course.progress} />
              </div>
              <a href="/learner/learn" className="v3-btn">Resume</a>
            </div>
          ))
        )}
      </V3Card>
    </>
  );
}
