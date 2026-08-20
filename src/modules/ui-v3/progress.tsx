"use client";

// src/modules/ui-v3/progress.tsx — V3 Learner Progress content.
// Reimplements the v2 LearnerProgress (learner-portal/progress.tsx, 440 lines)
// with v3 design tokens. Same API endpoint (GET /api/v2/learner/progress),
// same data shape — restyled to match v3 dark-sidebar + indigo shell.
//
// Sections: KPI strip, course progress, 14-day activity, credentials,
// weekly tests, badges, weak topics.

import Link from "next/link";
import { useApi } from "./use-api";
import { V3Card, V3StatCard, V3Progress, V3Badge, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { StateError, StateSkeleton, StateSkeletonHero } from "./states";
// Reuse the working v2 claim-certificate modal — complex enough that
// re-implementing just for style isn't worth it in P1b.
import { PrivateReports, ClaimCertificate } from "@/modules/learner-portal/reports";

interface ProgressData {
  learner: {
    totalXP: number;
    level: string;
    streakCurrent: number;
    streakLongest: number;
  };
  courses: Array<{
    courseId: string;
    courseName: string;
    percent: number;
    position: { week: number; day: number } | null;
    totalWeeks: number;
    totalXP: number;
    streakCurrent: number;
  }>;
  activity: Array<{ date: string; xp: number }>;
  badges: Array<{
    id: string;
    awardedAt: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    rarity: string;
  }>;
  certificates: Array<{
    id: string;
    courseName: string;
    grade: string;
    score: number;
    issuedAt: string;
    verifyUrl: string | null;
  }>;
  weakTopics: Array<{ topic: string; pillar: string; masteryLevel: string; trend: string }>;
  reportCards: Array<{ id: string; week: number; grade: string; score: number; date: string; progress: string }>;
  weeklyTests: Array<{ week: number; score: number | null }>;
  checkins: Array<{ date: string; confidence: number }>;
}

export function V3LearnerProgress() {
  const { data, loading, error, retry } = useApi<ProgressData>("/api/v2/learner/progress");

  if (loading) {
    return (
      <>
        <StateSkeletonHero />
        <StateSkeleton cards={4} />
      </>
    );
  }
  if (error) return <StateError message={error} onRetry={retry} />;
  if (!data) return null;

  return (
    <>
      <V3PageHeader
        title="Progress"
        subtitle="Your XP, streak, course progress, badges and credentials."
        action={
          <Link href="/learner/study" className="v3-btn v3-btn-primary">
            Open Study Flow →
          </Link>
        }
      />

      {/* KPI strip — 4 cards */}
      <div className="v3-grid v3-grid-4" style={{ marginBottom: "var(--p-space-5)" }}>
        <V3StatCard title="Level" value={data.learner.level} label="Current rank" />
        <V3StatCard title="Total XP" value={data.learner.totalXP.toLocaleString()} label="All-time" />
        <V3StatCard title="Current streak" value={`${data.learner.streakCurrent}d`} label="Days in a row" />
        <V3StatCard title="Best streak" value={`${data.learner.streakLongest}d`} label="Personal record" />
      </div>

      <div className="v3-grid v3-grid-2">
        {/* Left column: courses + activity + reports */}
        <V3Card>
          <h3>Courses</h3>
          {data.courses.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)", margin: "var(--p-space-3) 0 0" }}>
              No enrollments yet —{" "}
              <Link href="/learner/learn" style={{ color: "var(--brand)", fontWeight: 600 }}>
                browse the catalog
              </Link>
              .
            </p>
          ) : (
            <div style={{ marginTop: "var(--p-space-4)" }}>
              {data.courses.map((c) => (
                <Link
                  key={c.courseId}
                  href={`/learner/courses/${c.courseId}`}
                  className="v3-course-row"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="v3-course-info">
                    <strong>{c.courseName}</strong>
                    <small>
                      {c.position ? `Week ${c.position.week} · Day ${c.position.day} · ` : ""}
                      {c.totalXP} XP · {c.percent}% complete
                    </small>
                  </div>
                  <div style={{ width: 160 }}>
                    <V3Progress value={c.percent} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </V3Card>

        <V3Card>
          <h3>Last 14 days</h3>
          <ActivityStrip activity={data.activity} />
        </V3Card>
      </div>

      <V3SectionTitle title="Credentials & tests" />

      <div className="v3-grid v3-grid-2">
        <V3Card>
          <h3>Certificates</h3>
          {data.certificates.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)", margin: "var(--p-space-3) 0 0" }}>
              Complete a course to earn a verified credential.
            </p>
          ) : (
            <div style={{ marginTop: "var(--p-space-4)" }}>
              {data.certificates.map((c) => (
                <div key={c.id} className="v3-attention-item">
                  <div>
                    <strong>{c.courseName}</strong>
                    <p>
                      {new Date(c.issuedAt).toLocaleDateString()} · {c.grade} · {c.score}%
                    </p>
                  </div>
                  {c.verifyUrl ? (
                    <a href={c.verifyUrl} target="_blank" rel="noopener noreferrer" className="v3-btn">
                      Verify
                    </a>
                  ) : (
                    <V3Badge variant="success">{c.grade}</V3Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Claim certificate for completed but unclaimed courses */}
          {data.courses.some(c => c.percent >= 100 && !data.certificates.some(cert => cert.courseName === c.courseName)) && (
            <div style={{ marginTop: "var(--p-space-3)", paddingTop: "var(--p-space-3)", borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", margin: "0 0 var(--p-space-2)" }}>
                Completed — claim your credential:
              </p>
              {data.courses
                .filter(c => c.percent >= 100 && !data.certificates.some(cert => cert.courseName === c.courseName))
                .map(c => (
                  <ClaimCertificate key={c.courseId} courseId={c.courseId} courseName={c.courseName} />
                ))}
            </div>
          )}
        </V3Card>

        <V3Card>
          <h3>Weekly tests</h3>
          {data.weeklyTests.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)", margin: "var(--p-space-3) 0 0" }}>
              No weekly test scores yet.
            </p>
          ) : (
            <div style={{ marginTop: "var(--p-space-4)", display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}>
              {data.weeklyTests.map((t) => (
                <div key={t.week} style={{ display: "flex", alignItems: "center", gap: "var(--p-space-3)" }}>
                  <span style={{ width: 64, flexShrink: 0, fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>
                    Week {t.week}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <V3Progress value={t.score ?? 0} />
                  </div>
                  <span style={{ width: 48, flexShrink: 0, textAlign: "right", fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    {t.score != null ? `${t.score}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </V3Card>
      </div>

      <V3SectionTitle title="Badges & weak topics" />

      <div className="v3-grid v3-grid-2">
        <V3Card>
          <h3>Badges</h3>
          {data.badges.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)", margin: "var(--p-space-3) 0 0" }}>
              Badges appear here as you hit milestones.
            </p>
          ) : (
            <div style={{ marginTop: "var(--p-space-4)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "var(--p-space-3)" }}>
              {data.badges.map((b) => (
                <div
                  key={b.id}
                  title={b.description}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "var(--p-space-2)",
                    padding: "var(--p-space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle)",
                    textAlign: "center",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--brand-subtle)",
                      color: "var(--brand)",
                      fontSize: "var(--p-type-lg)",
                    }}
                  >
                    {b.icon}
                  </span>
                  <p style={{ margin: 0, fontSize: "var(--p-type-sm)", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                    {b.name}
                  </p>
                  <p style={{ margin: 0, fontSize: "var(--p-type-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                    {b.rarity}
                  </p>
                </div>
              ))}
            </div>
          )}
        </V3Card>

        <V3Card>
          <h3>To strengthen</h3>
          {data.weakTopics.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)", margin: "var(--p-space-3) 0 0" }}>
              No weak topics detected — keep going.
            </p>
          ) : (
            <div style={{ marginTop: "var(--p-space-4)", display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}>
              {data.weakTopics.map((t) => (
                <div
                  key={t.topic}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--p-space-2)",
                    padding: "var(--p-space-2) var(--p-space-3)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.topic}
                    </p>
                    <p style={{ margin: 0, fontSize: "var(--p-type-xs)", color: "var(--text-muted)" }}>
                      {t.pillar}
                    </p>
                  </div>
                  {t.trend === "up" && <span aria-label="trending up" style={{ color: "var(--success-on)" }}>↑</span>}
                  {t.trend === "down" && <span aria-label="trending down" style={{ color: "var(--danger-on)" }}>↓</span>}
                </div>
              ))}
            </div>
          )}
        </V3Card>
      </div>

      {/* Delegate private reports to the v2 component (complex modal logic) */}
      <V3SectionTitle title="Reports" />
      <PrivateReports />
    </>
  );
}

/* ---------------- 14-day activity strip (v3-styled) ---------- */

function ActivityStrip({ activity }: { activity: ProgressData["activity"] }) {
  const max = Math.max(1, ...activity.map((d) => d.xp));
  const total = activity.reduce((sum, d) => sum + d.xp, 0);

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--p-space-4)" }}>
        <span style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
          Daily XP
        </span>
        <span style={{ fontSize: "var(--p-type-sm)", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          {total} XP earned
        </span>
      </div>
      <div
        style={{ display: "flex", height: 96, alignItems: "flex-end", gap: "var(--p-space-1)" }}
        role="img"
        aria-label={`Daily XP for the last 14 days, ${total} total`}
      >
        {activity.map((d) => (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--p-space-1)" }}>
            <div
              title={`${d.date}: ${d.xp} XP`}
              style={{
                width: "100%",
                height: `${Math.max(6, Math.round((d.xp / max) * 100))}%`,
                borderRadius: "var(--radius-xs)",
                background: d.xp > 0 ? "var(--brand)" : "var(--bg-subtle)",
                transition: "height var(--p-dur-med) var(--ease-standard)",
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
