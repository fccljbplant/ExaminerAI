"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderKanban,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/instructor-portal — Project approval queue (v2 project flow).
 *
 * New learner projects start as pending_approval — task generation stays
 * locked until an instructor approves the proposal here. The decided
 * list keeps a record of approvals/rejections.
 */

interface QueueProject {
  id: string;
  title: string;
  goal: string | null;
  description: string | null;
  objectives: string[];
  durationWeeks: number | null;
  status: string;
  approvalNote: string | null;
  approvedAt: string | null;
  deadline: string | null;
  updatedAt: string;
  learner: { id: string; name: string; email: string };
  course: { id: string; name: string };
  kpis: { taskProgress: number; tasksDone: string };
}

interface QueueData {
  pending: QueueProject[];
  decided: QueueProject[];
  kpis: { pendingCount: number; totalCount: number };
}

export function ProjectQueue() {
  const { data, error, isLoading, retry } = useApi<QueueData>("/api/v2/instructor/projects");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(projectId: string, decision: "approve" | "reject") {
    setBusyId(projectId);
    try {
      await api.post(`/api/v2/projects/${projectId}/approve`, {
        decision,
        note: decision === "reject" ? note : undefined,
      });
      toast.success(decision === "approve" ? "Project approved" : "Proposal sent back");
      setNoteFor(null);
      setNote("");
      retry();
    } catch (e) {
      toast.error("Couldn't update the project", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <QueueSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load the project queue</p>
        <p className="mt-1 text-xs text-fg-muted">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg hover:bg-bg-subtle"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <FolderKanban className="h-5 w-5 text-brand" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold text-fg md:text-xl">Projects</h1>
          <p className="text-xs text-fg-muted">
            {data.kpis.pendingCount} awaiting approval · {data.kpis.totalCount} total
          </p>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Awaiting approval
        </h2>
        {data.pending.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-success" aria-hidden />
            <p className="mt-2 text-sm font-medium text-fg">Queue clear</p>
            <p className="mt-1 text-xs text-fg-muted">No proposals are waiting on you.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.pending.map((p) => (
              <div key={p.id} className="space-y-2 rounded-xl border border-warning/30 bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg">{p.title}</p>
                    <Link
                      href={`/instructor/students/${p.learner.id}`}
                      className="text-xs text-brand hover:underline"
                    >
                      {p.learner.name}
                    </Link>
                    <span className="text-xs text-fg-muted"> · {p.course.name}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2.5 py-0.5 text-[11px] font-medium text-warning-on">
                    <Clock className="h-3 w-3" aria-hidden />
                    Awaiting approval
                  </span>
                </div>
                {p.goal && <p className="text-xs text-fg-secondary">{p.goal}</p>}
                {p.description && (
                  <p className="text-xs leading-relaxed text-fg-muted">{p.description}</p>
                )}
                {p.objectives.length > 0 && (
                  <ul className="space-y-0.5">
                    {p.objectives.map((o, i) => (
                      <li key={i} className="text-xs text-fg-muted">• {o}</li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-fg-muted">
                  {p.durationWeeks ? `${p.durationWeeks}-week timeline` : ""}
                  {p.deadline ? ` · due ${new Date(p.deadline).toLocaleDateString()}` : ""}
                </p>
                {noteFor === p.id && (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Feedback for the learner (shown with the decision)"
                    aria-label="Approval note"
                    className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs text-fg placeholder:text-fg-muted"
                  />
                )}
                <div className="flex flex-wrap gap-2 border-t border-line pt-2.5">
                  <button
                    type="button"
                    onClick={() => decide(p.id, "approve")}
                    disabled={busyId === p.id}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
                  >
                    {busyId === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Approve
                  </button>
                  {noteFor === p.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => decide(p.id, "reject")}
                        disabled={busyId === p.id || !note.trim()}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 text-xs font-semibold text-danger disabled:opacity-50"
                      >
                        Send back with note
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNoteFor(null);
                          setNote("");
                        }}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium text-fg-muted hover:text-fg"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNoteFor(p.id)}
                      disabled={busyId === p.id}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fg hover:border-line-strong disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Send back…
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.decided.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Decided
          </h2>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.decided.map((p) => (
              <div key={p.id} className="flex min-h-12 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{p.title}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {p.learner.name} · {p.course.name} · {p.kpis.tasksDone} tasks
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                    p.status === "approved" && "bg-success-subtle text-success-on",
                    p.status === "rejected" && "bg-danger/10 text-danger",
                    p.status === "active" && "bg-info-subtle text-info-on",
                  )}
                >
                  {p.status === "approved" ? "Approved" : p.status === "rejected" ? "Needs changes" : "In progress"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-8 w-40 rounded-md bg-bg-subtle" />
      <div className="h-40 rounded-xl bg-bg-subtle" />
      <div className="h-40 rounded-xl bg-bg-subtle" />
    </div>
  );
}
