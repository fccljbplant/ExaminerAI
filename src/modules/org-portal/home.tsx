"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Megaphone,
  RefreshCw,
  ScrollText,
  Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/org-portal — O1 Command Center (REDESIGN-P3 §O1, W7)
 *
 * Mobile order: members + seat KPIs first, then the recent audit feed.
 * One aggregate endpoint (GET /api/v2/org/home) feeds the whole fold.
 * B2B enterprise ops (2026-08-17): announcements card (post + recent
 * list) hangs below the fold — additive, no changes to the O1 API.
 */

interface OrgMemberRow {
  id: string;
  role: string;
  status: string;
  seat: boolean;
  user: { id: string; name: string; email: string; lastLogin: string | null };
}

interface AuditRow {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  createdAt: string;
}

interface OrgHomeData {
  org: { id: string; name: string; plan: string; seats: number };
  kpis: { members: number; seatsUsed: number; seatsTotal: number; mentors: number; pendingInvites: number };
  members: OrgMemberRow[];
  audit: AuditRow[];
}

export function OrgHome() {
  const { data, error, isLoading, retry } = useApi<OrgHomeData>("/api/v2/org/home");

  if (isLoading) return <HomeSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load your org</p>
        <p className="mt-1 text-xs text-fg-muted">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  const seatsPct =
    data.org.seats > 0 ? Math.round((data.kpis.seatsUsed / data.org.seats) * 100) : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">{data.org.name}</h1>

      {/* KPI row — members + seats above the fold (O1) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label="Members" value={data.kpis.members} hint="active" icon={Users} tone="brand" />
        <Kpi
          label="Seats used"
          value={`${data.kpis.seatsUsed}/${data.kpis.seatsTotal}`}
          hint={`${seatsPct}% of plan`}
          icon={Users}
          tone={seatsPct >= 90 ? "warning" : "muted"}
        />
        <Kpi label="Mentors" value={data.kpis.mentors} hint="coaching" icon={Users} tone="info" />
        <Kpi
          label="Pending invites"
          value={data.kpis.pendingInvites}
          hint="not yet joined"
          icon={ScrollText}
          tone={data.kpis.pendingInvites > 0 ? "warning" : "muted"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
        {/* recent members */}
        <section className="space-y-2 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Members
            </h2>
            <Link
              href="/org/people"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-fg"
            >
              Manage people
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.members.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-secondary">
                  <Users className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{m.user.name}</p>
                  <p className="truncate text-xs text-fg-muted">{m.user.email}</p>
                </div>
                <span className="shrink-0 rounded-md bg-bg-subtle px-2 py-0.5 text-xs font-medium capitalize text-fg-secondary">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* recent audit feed */}
        <section className="space-y-2 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Recent activity
            </h2>
            <Link
              href="/org/audit"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-fg"
            >
              Full audit
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {data.audit.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
              No audited actions yet.
            </p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {data.audit.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{a.action}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {a.actorName} · {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* announcements (B2B enterprise ops) */}
      <OrgAnnouncements />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: typeof Users;
  tone: "brand" | "warning" | "info" | "muted";
}) {
  const tones = {
    brand: "bg-brand-subtle text-fg",
    warning: "bg-warning-subtle text-warning-on",
    info: "bg-info-subtle text-info-on",
    muted: "bg-bg-subtle text-fg-muted",
  } as const;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      <p className="text-[11px] text-fg-muted">{hint}</p>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-40 rounded-md bg-bg-subtle" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}

// ── Announcements (B2B enterprise ops, 2026-08-17) ──────────────────────

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
}

interface AnnouncementsData {
  announcements: AnnouncementRow[];
}

/** Compact post form + recent list. Own data (GET /api/v2/org/announcements)
 *  so the O1 aggregate endpoint stays untouched. */
function OrgAnnouncements() {
  const { data, error, isLoading, retry } =
    useApi<AnnouncementsData>("/api/v2/org/announcements");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    try {
      const envelope = await api.post<{ ok: boolean; data: { notified: number } }>(
        "/api/v2/org/announcements",
        { title: title.trim(), body: body.trim() },
      );
      toast.success("Announcement posted", {
        description: `Notified ${envelope.data?.notified ?? 0} member(s).`,
      });
      setTitle("");
      setBody("");
      retry();
    } catch (err) {
      toast.error("Couldn't post announcement", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setPosting(false);
    }
  }

  const announcements = data?.announcements ?? [];

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <Megaphone className="h-3.5 w-3.5" aria-hidden />
        Announcements
      </h2>

      <form
        onSubmit={post}
        className="space-y-2 rounded-xl border border-line bg-surface p-4"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={140}
          aria-label="Announcement title"
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share something with the team…"
          maxLength={2000}
          rows={2}
          aria-label="Announcement body"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-fg-muted">
            Everyone in the org gets an in-app notification.
          </p>
          <button
            type="submit"
            disabled={posting || !title.trim() || !body.trim()}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {posting ? "Posting…" : "Post announcement"}
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-xl border border-line bg-surface" aria-busy="true" />
      ) : error ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-xs text-danger-on">Couldn&apos;t load announcements — {error}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-fg-secondary hover:border-line-strong"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Retry
          </button>
        </div>
      ) : announcements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-sm text-fg-muted">
          No announcements yet — post the first one above.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {announcements.slice(0, 5).map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-fg">{a.title}</p>
                <p className="shrink-0 text-[11px] text-fg-muted">
                  {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-fg-secondary">{a.body}</p>
              <p className="mt-1 text-[11px] text-fg-muted">{a.authorName}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
