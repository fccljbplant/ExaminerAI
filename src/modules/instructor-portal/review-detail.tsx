"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Undo2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "@/modules/learner-portal/use-api";
import { SubmissionRenderer } from "@/modules/ui/submission-renderer";
import { RubricGrader } from "@/modules/ui/rubric-grader";
import { FeedbackThread } from "@/modules/ui/feedback-thread";
import { SignOffCard } from "@/modules/ui/sign-off-card";
import { BottomSheet } from "@/modules/ui/bottom-sheet";

/**
 * modules/instructor-portal — I4 Review detail (REDESIGN-P3 §I4, W4 review side)
 *
 * Submission preview per part (text-only AI law: extracted text for
 * files, artifacts for the human reviewer) + editable RubricGrader with
 * the "AI draft — verify" flow (aiAssist criteria only) + feedback
 * thread composer + ordered sign-off chain + decision bar (approve /
 * request changes / sign off). Grade history per cycle at the bottom.
 */

/* ---------------- payload types (mirror GET /api/v2/submissions/[id]) --- */

interface RubricLevelView {
  level: number;
  label: string;
  score: number;
}
interface RubricCriterionView {
  key: string;
  label: string;
  weight: number;
  aiAssist: boolean;
  levels: RubricLevelView[];
}
interface PartView {
  id: string;
  type: string;
  text: string | null;
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  dataUrl: string | null;
  extractedText: string | null;
  extractionStatus: string;
  checklist: Array<{ label: string; checked: boolean }> | null;
}
interface ThreadMsgView {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  kind: "text" | "audio" | "annotation";
  body: string;
  audioUrl: string | null;
  partId: string | null;
  createdAt: string;
}
interface SignOffView {
  signerId: string;
  signerName: string;
  signerRole: string;
  order: number;
  decidedAt: string;
}
interface GradeHistoryEntry {
  cycle: number;
  totalScore: number | null;
  createdAt: string;
  entries: Array<{ criterionKey: string; score: number; note?: string; aiDraft?: boolean }>;
}

interface ReviewBundle {
  submissionId: string;
  assignment: {
    id: string;
    title: string;
    instructions: string;
    courseId: string;
    courseName: string | null;
    maxScore: number;
    milestoneLabel: string | null;
  };
  learner: { id: string; name: string };
  status: string;
  cycle: number;
  score: number | null;
  learnerSummary: string;
  submittedAt: string | null;
  decidedAt: string | null;
  parts: PartView[];
  rubric: { id: string; title: string; criteria: RubricCriterionView[] } | null;
  policy: {
    maxCycles: number;
    cooldownHours: number;
    signOffChain?: Array<{ signerId: string; signerName: string; signerRole: string }>;
  };
  thread: ThreadMsgView[];
  signOffs: SignOffView[];
  gradeHistory: GradeHistoryEntry[];
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  submitted: { label: "Submitted", tone: "bg-info-subtle text-info-on" },
  in_review: { label: "In review", tone: "bg-info-subtle text-info-on" },
  resubmitted: { label: "Resubmitted", tone: "bg-info-subtle text-info-on" },
  changes_requested: { label: "Returned", tone: "bg-warning-subtle text-warning-on" },
  approved: { label: "Approved", tone: "bg-success-subtle text-success-on" },
  signed_off: { label: "Signed off", tone: "bg-success-subtle text-success-on" },
};

const PART_LABELS: Record<string, string> = {
  text: "Written answer",
  photo: "Photo evidence",
  video: "Video evidence",
  link: "Live artifact link",
  checklist: "Checklist",
  file: "Document",
};

export function ReviewDetail({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const { data, error, isLoading, retry } = useApi<ReviewBundle>(
    `/api/v2/submissions/${submissionId}`,
  );

  const [entries, setEntries] = useState<
    Array<{ criterionKey: string; score: number; aiDraft?: boolean }>
  >([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeMsg, setGradeMsg] = useState<string | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [changeSheet, setChangeSheet] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-4 py-10 text-center">
        <AlertTriangle className="h-6 w-6 text-danger" aria-hidden />
        <p className="text-sm text-fg-secondary">{error ?? "Submission not found."}</p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-bg-subtle px-4 text-sm font-medium text-fg hover:border-line-strong"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  const meta = STATUS_META[data.status] ?? STATUS_META.submitted;
  const activeReview = ["submitted", "in_review", "resubmitted"].includes(data.status);

  async function runAiDraft() {
    setAiBusy(true);
    setAiNotice(null);
    try {
      const res = await api.post<{
        ok: boolean;
        data: { entries: Array<{ criterionKey: string; score: number; note?: string; aiDraft: boolean }>; generated: boolean; label: string };
      }>(`/api/v2/submissions/${submissionId}/ai-draft`, {});
      const draftEntries = res.data.entries;
      setEntries((prev) => {
        const next = [...prev];
        for (const d of draftEntries) {
          const i = next.findIndex((e) => e.criterionKey === d.criterionKey);
          const entry = { criterionKey: d.criterionKey, score: d.score, aiDraft: true };
          if (i === -1) next.push(entry);
          else next[i] = entry;
        }
        return next;
      });
      setAiNotice(
        draftEntries.length > 0
          ? `${res.data.label} — ${draftEntries.length} criteria drafted. Verify before approving.`
          : "No draft produced — nothing readable to ground scores on. Grade manually.",
      );
    } catch (e) {
      setAiNotice(e instanceof Error ? e.message : "AI draft unavailable — grade manually.");
    } finally {
      setAiBusy(false);
    }
  }

  async function saveGrade() {
    if (!data?.rubric) return;
    setSavingGrade(true);
    setGradeMsg(null);
    try {
      const res = await api.post<{ ok: boolean; data: { totalScore: number; coverage: number; aiDraftCount: number } }>(
        `/api/v2/submissions/${submissionId}/grade`,
        { entries },
      );
      setGradeMsg(
        `Grade saved — ${res.data.totalScore}/${data.assignment.maxScore}${
          res.data.aiDraftCount > 0 ? ` (${res.data.aiDraftCount} machine-drafted entries pending human confirmation)` : ""
        }.`,
      );
      retry();
    } catch (e) {
      setGradeMsg(e instanceof Error ? e.message : "Could not save the grade.");
    } finally {
      setSavingGrade(false);
    }
  }

  async function decide(decision: "approve" | "request_changes" | "signoff") {
    if (decision === "request_changes" && !changeText.trim()) return;
    setDecisionBusy(true);
    setActionError(null);
    try {
      await api.post<{ ok: boolean; data: { status: string; signOffRecorded: boolean } }>(
        `/api/v2/submissions/${submissionId}/decision`,
        {
          decision,
          ...(decision === "request_changes" ? { feedbackText: changeText.trim() } : {}),
        },
      );
      setChangeSheet(false);
      setChangeText("");
      retry();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setDecisionBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-28 md:pb-8">
      {/* header */}
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-fg-muted">
              <Link href="/instructor/review" className="hover:text-fg">
                Review
              </Link>{" "}
              · {data.assignment.courseName ?? "Course"}
            </p>
            <h1 className="truncate text-lg font-semibold text-fg md:text-xl">
              {data.assignment.title}
            </h1>
            <p className="mt-0.5 text-sm text-fg-secondary">
              {data.learner.name}
              {data.cycle > 1 ? ` · cycle ${data.cycle}` : ""}
            </p>
          </div>
          <span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-medium", meta.tone)}>
            {meta.label}
          </span>
        </div>
      </header>

      {/* learner summary + parts */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Learner summary</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-secondary">
          {data.learnerSummary || <span className="text-fg-muted">(none provided)</span>}
        </p>
      </section>

      {data.parts.map((p, i) => (
        <section key={`${p.id}-${i}`} className="space-y-1.5">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {PART_LABELS[p.type] ?? p.type}
          </p>
          <SubmissionRenderer part={p} />
        </section>
      ))}

      {/* rubric grader + AI draft */}
      {data.rubric && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Rubric
            </h2>
            <button
              type="button"
              onClick={runAiDraft}
              disabled={aiBusy || !activeReview}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-bg-subtle px-3 text-xs font-medium text-fg hover:border-line-strong disabled:opacity-50"
            >
              {aiBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-info" aria-hidden />
              )}
              AI draft
            </button>
          </div>
          <RubricGrader
            rubric={data.rubric}
            entries={entries}
            totalScore={data.score ?? undefined}
            maxScore={data.assignment.maxScore}
            onChange={setEntries}
          />
          {aiNotice && (
            <p role="status" className="px-1 text-xs text-fg-muted">
              {aiNotice}
            </p>
          )}
          {activeReview && (
            <button
              type="button"
              onClick={saveGrade}
              disabled={savingGrade || entries.length === 0}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {savingGrade ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
              Save grade
            </button>
          )}
          {gradeMsg && (
            <p role="status" className="px-1 text-xs text-fg-secondary">
              {gradeMsg}
            </p>
          )}
        </section>
      )}

      {/* feedback thread */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Feedback
        </h2>
        <FeedbackThread
          messages={data.thread.map((m) => ({
            id: m.id,
            kind: m.kind,
            body: m.body,
            audioUrl: m.audioUrl,
            partId: m.partId,
            authorName: m.authorName,
            authorRole: m.authorRole,
            createdAt: m.createdAt,
          }))}
          readOnly={!activeReview}
          emptyLabel="No feedback yet — post a note for the learner."
          onPost={async (body) => {
            try {
              await api.post(`/api/v2/submissions/${submissionId}/feedback`, { body });
              retry();
            } catch (e) {
              setActionError(e instanceof Error ? e.message : "Could not post feedback.");
            }
          }}
        />
      </section>

      {/* sign-off chain */}
      {(data.policy.signOffChain?.length || data.signOffs.length > 0) && (
        <SignOffCard
          milestoneLabel={data.assignment.milestoneLabel ?? data.assignment.title}
          chain={data.policy.signOffChain ?? data.signOffs.map((s) => ({
            signerId: s.signerId,
            signerName: s.signerName,
            signerRole: s.signerRole,
          }))}
          done={data.signOffs.map((s) => ({ signerId: s.signerId, order: s.order }))}
          status={data.status}
        />
      )}

      {/* grade history */}
      {data.gradeHistory.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Grade history
          </h2>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {data.gradeHistory.map((g) => (
              <div key={g.cycle} className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm text-fg">
                  Cycle {g.cycle}
                  <span className="ml-2 text-xs text-fg-muted">
                    {new Date(g.createdAt).toLocaleDateString()}
                  </span>
                </p>
                <p className="text-sm font-medium tabular-nums text-fg-secondary">
                  {g.totalScore != null ? `${g.totalScore}/${data.assignment.maxScore}` : "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {actionError && (
        <div role="alert" className="rounded-xl border border-danger-subtle bg-danger-subtle px-4 py-3 text-sm text-danger-on">
          {actionError}
        </div>
      )}

      {/* decision bar */}
      {activeReview && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-[var(--p-z-raised)] border-t border-line bg-surface p-3 md:static md:bottom-auto md:z-auto md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto flex max-w-4xl items-center gap-2">
            <button
              type="button"
              onClick={() => decide("approve")}
              disabled={decisionBusy}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-success px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {decisionBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <BadgeCheck className="h-4 w-4" aria-hidden />
              )}
              Approve
            </button>
            <button
              type="button"
              onClick={() => setChangeSheet(true)}
              disabled={decisionBusy}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-warning px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Undo2 className="h-4 w-4" aria-hidden />
              Request changes
            </button>
            {(data.policy.signOffChain?.length || data.signOffs.length > 0) && (
              <button
                type="button"
                onClick={() => decide("signoff")}
                disabled={decisionBusy}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
              >
                {data.signOffs.length > 0 ? "Sign off" : "Sign off"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* request-changes sheet — feedback text required (P3 I4) */}
      <BottomSheet
        open={changeSheet}
        onOpenChange={setChangeSheet}
        title="Request changes"
        description="Explain what needs fixing — the learner sees this in their thread."
      >
        <div className="space-y-3">
          <textarea
            value={changeText}
            onChange={(e) => setChangeText(e.target.value)}
            rows={4}
            placeholder="What should the learner change, and why?"
            aria-label="Feedback for the learner"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={() => decide("request_changes")}
            disabled={decisionBusy || !changeText.trim()}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-warning px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {decisionBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="h-4 w-4" aria-hidden />
            )}
            Send request
          </button>
        </div>
      </BottomSheet>

      <Link
        href="/instructor/review"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to queue
      </Link>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-4 pb-28">
      <div className="h-6 w-1/2 rounded bg-bg-subtle" />
      <div className="h-24 rounded-xl bg-bg-subtle" />
      <div className="h-64 rounded-xl bg-bg-subtle" />
      <div className="h-32 rounded-xl bg-bg-subtle" />
    </div>
  );
}
