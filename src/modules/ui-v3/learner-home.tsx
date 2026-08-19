"use client";

// src/modules/ui-v3/learner-home.tsx — V3 learner dashboard CONTENT (no shell).
// The shell (sidebar + topbar) is provided by the layout's V3Shell.
// Render this from /learner/page.tsx when v3 flag is on.

import { V3Card, V3Badge, V3Progress, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";

export function V3LearnerHomeContent() {
  const { data, loading } = useApi("/api/v2/learner/home");
  const d = (data as any)?.data ?? data;

  return (
    <>
      <V3PageHeader
        title={`Good afternoon, ${d?.userName ?? "Learner"} 👋`}
        subtitle="You're making great progress. Let's continue learning."
        action={
          <a href="/learner/learn" className="v3-btn v3-btn-primary">Continue learning →</a>
        }
      />

      <div className="v3-grid v3-grid-2">
        <V3Card className="v3-continue-card">
          <V3Badge>CONTINUE LEARNING</V3Badge>
          <h2>{d?.courseName ?? "Your next lesson"}</h2>
          <p>{d?.lessonTitle ?? "Start your learning journey"}</p>
          <V3Progress value={d?.courseProgress ?? 0} />
          <p>{d?.courseProgress ?? 0}% completed</p>
          <br />
          <a href="/learner/learn" className="v3-btn">Resume lesson →</a>
        </V3Card>

        <V3Card>
          <h3>Today&apos;s learning plan</h3>
          <p>3 small actions to keep you moving forward.</p>
          {(d?.todayPlan ?? [
            { title: "Finish current lesson", meta: "Continue learning", badge: "Next" },
            { title: "AI practice session", meta: "Adaptive questions" },
            { title: "Daily quiz", meta: "3 questions" },
          ]).map((item: any, i: number) => (
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

      <V3SectionTitle title="Learning overview" link="View full progress →" />

      <div className="v3-grid v3-grid-3">
        <V3Card className="v3-today-card">
          <div className="v3-today-icon">◉</div>
          <h3>Next lesson</h3>
          <p>{d?.nextLesson ?? "Start learning"}</p>
        </V3Card>
        <V3Card className="v3-today-card">
          <div className="v3-today-icon">✦</div>
          <h3>Practice</h3>
          <p>{d?.practiceCount ?? 0} recommended questions</p>
        </V3Card>
        <V3Card className="v3-today-card">
          <div className="v3-today-icon">↗</div>
          <h3>Overall progress</h3>
          <p>{d?.courseProgress ?? 0}% · this week</p>
        </V3Card>
      </div>

      <V3SectionTitle title="My courses" link="View all →" />

      <V3Card>
        {(d?.courses ?? [
          { name: "Course 1", lessons: "0 of 0", progress: 0 },
        ]).map((course: any, i: number) => (
          <div key={i} className="v3-course-row">
            <div className="v3-course-icon">∑</div>
            <div className="v3-course-info">
              <strong>{course.name}</strong>
              <small>{course.lessons} lessons completed</small>
            </div>
            <div style={{ width: 160 }}>
              <V3Progress value={course.progress} />
            </div>
            <a href="/learner/learn" className="v3-btn">Resume</a>
          </div>
        ))}
      </V3Card>
    </>
  );
}
