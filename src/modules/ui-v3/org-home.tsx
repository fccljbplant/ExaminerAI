"use client";
// src/modules/ui-v3/org-home.tsx — V3 org admin dashboard CONTENT (no shell).
import { V3Card, V3StatCard, V3Badge, V3Progress, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";

export function V3OrgHomeContent() {
  const { data } = useApi("/api/v2/org/home");
  const d = (data as any)?.data ?? data;

  return (
    <>
      <V3PageHeader
        title="Organization overview"
        subtitle="Monitor learning performance, users and programs."
        action={<button className="v3-btn v3-btn-primary">+ Invite users</button>}
      />

      <div className="v3-grid v3-grid-4">
        <V3StatCard title="Active learners" value={String(d?.activeLearners ?? 0)} label="+12% this month" />
        <V3StatCard title="Completion rate" value={`${d?.completionRate ?? 0}%`} label="Healthy activity" />
        <V3StatCard title="Active courses" value={String(d?.activeCourses ?? 0)} label="Across all programs" />
        <V3StatCard title="Instructors" value={String(d?.instructors ?? 0)} label="Teaching staff" />
      </div>

      <V3SectionTitle title="Organization health" />

      <div className="v3-grid v3-grid-2">
        <V3Card>
          <h3>Learning funnel</h3>
          <div style={{ marginTop: 24 }}>
            <p>Enrolled · {d?.enrolled ?? 0}</p>
            <div style={{ margin: "7px 0 15px" }}><V3Progress value={100} /></div>
            <p>Active · {d?.activeLearners ?? 0}</p>
            <div style={{ margin: "7px 0 15px" }}><V3Progress value={d?.activeRate ?? 82} /></div>
            <p>Completed · {d?.completed ?? 0}</p>
            <div style={{ margin: "7px 0" }}><V3Progress value={d?.completionRate ?? 67} /></div>
          </div>
        </V3Card>

        <V3Card>
          <h3>Requires attention</h3>
          <div className="v3-attention-item">
            <div>
              <strong>{d?.inactiveLearners ?? 0} inactive learners</strong>
              <p>No activity in the last 7 days</p>
            </div>
            <V3Badge variant="warning">Attention</V3Badge>
          </div>
          <div className="v3-attention-item">
            <div>
              <strong>{d?.lowCompletionCourses ?? 0} courses below target</strong>
              <p>Completion below 60%</p>
            </div>
            <V3Badge variant="warning">Review</V3Badge>
          </div>
          <div className="v3-attention-item">
            <div>
              <strong>{d?.pendingInvites ?? 0} invitations pending</strong>
              <p>Users have not joined yet</p>
            </div>
            <V3Badge>Pending</V3Badge>
          </div>
        </V3Card>
      </div>

      <V3SectionTitle title="Recent users" />

      <V3Card className="v3-table-card">
        <table>
          <thead>
            <tr><th>User</th><th>Role</th><th>Program</th><th>Activity</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(d?.recentUsers ?? [
              { name: "No users yet", role: "—", program: "—", activity: "—", status: "—" },
            ]).map((u: any, i: number) => (
              <tr key={i}>
                <td><strong>{u.name}</strong></td>
                <td>{u.role}</td>
                <td>{u.program}</td>
                <td>{u.activity}</td>
                <td><span className={`v3-badge v3-badge-${u.status === "Active" ? "success" : "warning"}`}>{u.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </V3Card>
    </>
  );
}
