"use client";

// src/modules/ui-v3/org-home.tsx — V3 org admin dashboard CONTENT (no shell).
// Field paths aligned to the real /api/v2/org/home response shape:
//   { org: {name,plan,seats}, kpis: {members,seatsUsed,seatsTotal,
//          mentors,pendingInvites}, members[], audit[], auditCursor }

import { V3Card, V3StatCard, V3Badge, V3Progress, V3PageHeader, V3SectionTitle } from "./v3-shell";
import { useApi } from "./use-api";
import { StateError, StateSkeleton, StateSkeletonHero } from "./states";

interface OrgMember {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  lastActive?: string;
}

interface OrgAuditEntry {
  id?: string;
  actorName?: string;
  actorRole?: string;
  action?: string;
  targetType?: string;
  createdAt?: string;
}

interface OrgHomeData {
  org?: { id?: string; name?: string; plan?: string; seats?: number };
  kpis?: {
    members?: number;
    seatsUsed?: number;
    seatsTotal?: number;
    mentors?: number;
    pendingInvites?: number;
  };
  members?: OrgMember[];
  audit?: OrgAuditEntry[];
  auditCursor?: string | null;
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
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  } catch {
    return "—";
  }
}

export function V3OrgHomeContent() {
  const { data, loading, error, retry } = useApi<OrgHomeData>("/api/v2/org/home");

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
  const k = d.kpis ?? {};
  const seatsPct = k.seatsTotal && k.seatsTotal > 0
    ? Math.round(((k.seatsUsed ?? 0) / k.seatsTotal) * 100)
    : 0;

  return (
    <>
      <V3PageHeader
        title="Organization overview"
        subtitle="Monitor learning performance, users and programs."
        action={<a href="/org/people" className="v3-btn v3-btn-primary">+ Invite users</a>}
      />

      <div className="v3-grid v3-grid-4">
        <V3StatCard
          title="Active members"
          value={String(k.members ?? 0)}
          label={`${k.seatsUsed ?? 0} of ${k.seatsTotal ?? 0} seats used`}
        />
        <V3StatCard
          title="Seats used"
          value={`${seatsPct}%`}
          label="Of plan allocation"
        />
        <V3StatCard
          title="Mentors"
          value={String(k.mentors ?? 0)}
          label="Teaching staff"
        />
        <V3StatCard
          title="Pending invites"
          value={String(k.pendingInvites ?? 0)}
          label="Awaiting acceptance"
        />
      </div>

      {d.org?.plan && (
        <V3SectionTitle title={`Plan: ${d.org.plan}`} />
      )}

      <div className="v3-grid v3-grid-2">
        <V3Card>
          <h3>Seat usage</h3>
          <div style={{ marginTop: 24 }}>
            <p>Members · {k.members ?? 0}</p>
            <div style={{ margin: "7px 0 15px" }}><V3Progress value={k.seatsTotal && k.seatsTotal > 0 ? ((k.members ?? 0) / k.seatsTotal) * 100 : 0} /></div>
            <p>Seats used · {k.seatsUsed ?? 0} / {k.seatsTotal ?? 0}</p>
            <div style={{ margin: "7px 0" }}><V3Progress value={seatsPct} /></div>
          </div>
        </V3Card>

        <V3Card>
          <h3>Requires attention</h3>
          <div className="v3-attention-item">
            <div>
              <strong>{k.pendingInvites ?? 0} invitations pending</strong>
              <p>Users have not joined yet</p>
            </div>
            <V3Badge>Pending</V3Badge>
          </div>
          {(k.seatsTotal ?? 0) > 0 && (k.seatsUsed ?? 0) >= (k.seatsTotal ?? 0) && (
            <div className="v3-attention-item">
              <div>
                <strong>Seats exhausted</strong>
                <p>Upgrade plan or remove inactive members</p>
              </div>
              <V3Badge variant="warning">Review</V3Badge>
            </div>
          )}
        </V3Card>
      </div>

      <V3SectionTitle title="Recent members" linkHref="/org/people" linkLabel="View all →" />

      <V3Card className="v3-table-card">
        <table>
          <thead>
            <tr><th>Member</th><th>Role</th><th>Status</th><th>Last active</th></tr>
          </thead>
          <tbody>
            {(d.members ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  No members yet. Invite your first user to get started.
                </td>
              </tr>
            ) : (
              d.members!.map((m, i) => (
                <tr key={m.id ?? i}>
                  <td>
                    <strong>{m.name ?? "Unnamed"}</strong>
                    {m.email && <br />}
                    {m.email && <small style={{ color: "var(--text-muted)" }}>{m.email}</small>}
                  </td>
                  <td>{m.role ?? "—"}</td>
                  <td>
                    <span className={`v3-badge v3-badge-${m.status === "active" ? "success" : "warning"}`}>
                      {m.status ?? "—"}
                    </span>
                  </td>
                  <td>{timeAgo(m.lastActive)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </V3Card>

      <V3SectionTitle title="Recent activity" linkHref="/org/audit" linkLabel="View audit log →" />

      <V3Card>
        {(d.audit ?? []).length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "var(--p-type-sm)" }}>
            No recent activity recorded.
          </p>
        ) : (
          d.audit!.map((a, i) => (
            <div key={a.id ?? i} className="v3-attention-item">
              <div>
                <strong>{a.action ?? "Unknown action"}</strong>
                <p>{a.actorName ?? "Unknown"} · {a.targetType ?? "—"}</p>
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
