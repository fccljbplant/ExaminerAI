"use client";

// src/modules/ui-v3/instructor-home.tsx — V3 instructor dashboard CONTENT (no shell).
// Field paths aligned to the real /api/v2/instructor/home response shape:
//   { queue: {count, preview}, atRisk: {count, items}, studentsTotal }

import { V3Card, V3StatCard, V3Badge, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";
import { StateError, StateSkeleton, StateSkeletonHero } from "./states";

interface QueueItem {
  id?: string;
  learnerName?: string;
  courseName?: string;
  submittedAt?: string;
  status?: string;
}

interface AtRiskStudent {
  id?: string;
  name?: string;
  email?: string;
  courseName?: string;
  reason?: string;
}

interface InstructorHomeData {
  queue?: { count?: number; preview?: QueueItem[] };
  atRisk?: { count?: number; items?: AtRiskStudent[] };
  studentsTotal?: number;
}

function timeAgo(value?: string): string {
  if (!value) return "—";
  try {
    const diff = Date.now() - new Date(value).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch {
    return "—";
  }
}

export function V3InstructorHomeContent() {
  const { data, loading, error, retry } = useApi<InstructorHomeData>("/api/v2/instructor/home");

  if (loading) {
    return (
      <>
        <StateSkeletonHero />
        <StateSkeleton cards={4} />
      </>
    );
  }
  if (error) return <StateError message={error} onRetry={retry} />;

  const d = data ?? {};
  const queueCount = d.queue?.count ?? 0;
  const atRiskCount = d.atRisk?.count ?? 0;

  return (
    <>
      <V3PageHeader
        title="Teaching Studio"
        subtitle="Manage your classes and identify learners who need support."
        action={
          <a href="/instructor/studio" className="v3-btn v3-btn-primary">+ Create lesson</a>
        }
      />

      <div className="v3-grid v3-grid-2">
        <V3Card className="v3-class-session">
          <V3Badge>REVIEW QUEUE</V3Badge>
          <h2 style={{ marginTop: 16 }}>{queueCount} submission{queueCount === 1 ? "" : "s"} awaiting review</h2>
          <p>Across your courses · {d.studentsTotal ?? 0} learner{d.studentsTotal === 1 ? "" : "s"} total</p>
          <div className="v3-session-row">
            <div>
              <small>Action</small>
              <strong style={{ display: "block", marginTop: 4 }}>
                {queueCount > 0 ? "Grade pending work" : "All caught up"}
              </strong>
            </div>
            <a href="/instructor/review" className="v3-btn">
              {queueCount > 0 ? "Open review queue →" : "View queue →"}
            </a>
          </div>
        </V3Card>

        <V3Card>
          <h3>AI class insight ✦</h3>
          <p>{atRiskCount} learner{atRiskCount === 1 ? " is" : "s are"} flagged as at-risk across your classes.</p>
          <div className="v3-attention-item">
            <div>
              <strong>At-risk learners</strong>
              <p>Learners falling behind on assessments or attendance</p>
            </div>
            <V3Badge variant={atRiskCount > 0 ? "warning" : "success"}>
              {atRiskCount > 0 ? "Attention" : "Healthy"}
            </V3Badge>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <a href="/instructor/review" className="v3-btn">Generate follow-up quiz</a>
            <a href="/instructor/studio" className="v3-btn">Create practice</a>
          </div>
        </V3Card>
      </div>

      <V3SectionTitle title="Teaching overview" />

      <div className="v3-grid v3-grid-4">
        <V3StatCard title="Total learners" value={String(d.studentsTotal ?? 0)} label="Across all classes" />
        <V3StatCard title="Pending reviews" value={String(queueCount)} label="Submissions to grade" />
        <V3StatCard title="At-risk learners" value={String(atRiskCount)} label="Need attention" />
        <V3StatCard
          title="Review health"
          value={queueCount > 10 ? "Behind" : queueCount > 0 ? "On track" : "All clear"}
          label="Based on queue size"
        />
      </div>

      <V3SectionTitle title="Needs your attention" />

      <V3Card>
        <h3>At-risk learners</h3>
        <p>Learners flagged for falling behind on assessments or attendance.</p>
        {(d.atRisk?.items ?? []).length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)" }}>
            No at-risk learners right now.
          </p>
        ) : (
          (d.atRisk?.items ?? []).map((s, i) => (
            <div key={s.id ?? i} className="v3-attention-item">
              <div>
                <strong>{s.name ?? "Unnamed learner"}</strong>
                <p>{s.courseName ?? "—"}{s.reason ? ` · ${s.reason}` : ""}</p>
              </div>
              <a href={`/instructor/students/${s.id ?? ""}`} className="v3-btn">View</a>
            </div>
          ))
        )}
      </V3Card>

      <V3SectionTitle title="Recent submissions" linkHref="/instructor/review" linkLabel="View all →" />

      <V3Card className="v3-table-card">
        <table>
          <thead>
            <tr><th>Learner</th><th>Course</th><th>Submitted</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(d.queue?.preview ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  No pending submissions. You&apos;re all caught up!
                </td>
              </tr>
            ) : (
              (d.queue?.preview ?? []).map((q, i) => (
                <tr key={q.id ?? i}>
                  <td><strong>{q.learnerName ?? "Unnamed"}</strong></td>
                  <td>{q.courseName ?? "—"}</td>
                  <td>{timeAgo(q.submittedAt)}</td>
                  <td>
                    <span className={`v3-badge v3-badge-${q.status === "graded" ? "success" : "warning"}`}>
                      {q.status ?? "pending"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </V3Card>
    </>
  );
}
