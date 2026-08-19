"use client";
// src/modules/ui-v3/instructor-home.tsx — V3 instructor dashboard CONTENT (no shell).
import { V3Card, V3StatCard, V3Badge, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";

export function V3InstructorHomeContent() {
  const { data } = useApi("/api/v2/instructor/home");
  const d = (data as any)?.data ?? data;

  return (
    <>
      <V3PageHeader
        title="Teaching Studio"
        subtitle="Manage your classes and identify learners who need support."
        action={<button className="v3-btn v3-btn-primary">+ Create lesson</button>}
      />

      <div className="v3-grid v3-grid-2">
        <V3Card className="v3-class-session">
          <V3Badge>UP NEXT</V3Badge>
          <h2 style={{ marginTop: 16 }}>{d?.nextClass ?? "No upcoming class"}</h2>
          <p>Today · {d?.nextClassTime ?? "N/A"} · {d?.learnerCount ?? 0} learners</p>
          <div className="v3-session-row">
            <div>
              <small>Lesson</small>
              <strong style={{ display: "block", marginTop: 4 }}>{d?.nextLesson ?? "N/A"}</strong>
            </div>
            <a href="/instructor/students" className="v3-btn">Enter classroom →</a>
          </div>
        </V3Card>

        <V3Card>
          <h3>AI class insight ✦</h3>
          <p>{d?.strugglingCount ?? 0} learners are struggling with the same concept.</p>
          <div className="v3-attention-item">
            <div>
              <strong>Likely misconception</strong>
              <p>{d?.misconception ?? "No data yet"}</p>
            </div>
            <button className="v3-btn">View</button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button className="v3-btn">Generate follow-up quiz</button>
            <button className="v3-btn">Create practice</button>
          </div>
        </V3Card>
      </div>

      <V3SectionTitle title="Teaching overview" />

      <div className="v3-grid v3-grid-4">
        <V3StatCard title="Active learners" value={String(d?.activeLearners ?? 0)} label="Across all classes" />
        <V3StatCard title="Average completion" value={`${d?.avgCompletion ?? 0}%`} label="This month" />
        <V3StatCard title="Needs attention" value={String(d?.needsAttention ?? 0)} label="Learners falling behind" />
        <V3StatCard title="Pending reviews" value={String(d?.pendingReviews ?? 0)} label="Assessments to review" />
      </div>

      <V3SectionTitle title="Needs your attention" />

      <V3Card>
        <div className="v3-attention-item">
          <div>
            <strong>{d?.inactiveCount ?? 0} learners inactive for 7+ days</strong>
            <p>Review and reach out</p>
          </div>
          <a href="/instructor/students" className="v3-btn">Review learners</a>
        </div>
        <div className="v3-attention-item">
          <div>
            <strong>{d?.pendingReviews ?? 0} assessments awaiting feedback</strong>
            <p>Deadline approaching</p>
          </div>
          <a href="/instructor/review" className="v3-btn v3-btn-primary">Review now</a>
        </div>
      </V3Card>
    </>
  );
}
