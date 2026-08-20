"use client";

// src/modules/ui-v3/review-detail.tsx — V3 Review Detail (full restyle).
// Reimplements v2 ReviewDetail (instructor-portal/review-detail.tsx, 513 lines)
// with v3 design tokens. Same /api/v2/submissions/[id] endpoint + same
// business logic (AI draft, rubric grader, feedback thread, sign-off chain,
// grade history, decision bar with approve/request-changes/sign-off).
//
// Reuses v2 SubmissionRenderer, RubricGrader, FeedbackThread, SignOffCard,
// BottomSheet (complex sub-components — re-implementing would be P5).
// Page chrome + simple sections use v3 tokens.

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Check, Loader2,
  RefreshCw, Sparkles, Undo2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "./use-api";
import { SubmissionRenderer } from "@/modules/ui/submission-renderer";
import { RubricGrader } from "@/modules/ui/rubric-grader";
import { FeedbackThread } from "@/modules/ui/feedback-thread";
import { SignOffCard } from "@/modules/ui/sign-off-card";
import { BottomSheet } from "@/modules/ui/bottom-sheet";
import { V3PageHeader, V3Card, V3Badge } from "./v3-shell";
import { StateError, StateSkeletonHero } from "./states";

interface RubricLevelView { level: number; label: string; score: number; }
interface RubricCriterionView { key: string; label: string; weight: number; aiAssist: boolean; levels: RubricLevelView[]; }
interface PartView {
  id: string; type: string; text: string | null; url: string | null;
  fileName: string | null; mimeType: string | null; sizeBytes: number | null;
  dataUrl: string | null; extractedText: string | null; extractionStatus: string;
  checklist: Array<{ label: string; checked: boolean }> | null;
}
interface ThreadMsgView {
  id: string; authorId: string; authorName: string; authorRole: string;
  kind: "text" | "audio" | "annotation"; body: string; audioUrl: string | null;
  partId: string | null; createdAt: string;
}
interface SignOffView { signerId: string; signerName: string; signerRole: string; order: number; decidedAt: string; }
interface GradeHistoryEntry {
  cycle: number; totalScore: number | null; createdAt: string;
  entries: Array<{ criterionKey: string; score: number; note?: string; aiDraft?: boolean }>;
}

interface ReviewBundle {
  submissionId: string;
  assignment: {
    id: string; title: string; instructions: string; courseId: string;
    courseName: string | null; maxScore: number; milestoneLabel: string | null;
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
    maxCycles: number; cooldownHours: number;
    signOffChain?: Array<{ signerId: string; signerName: string; signerRole: string }>;
  };
  thread: ThreadMsgView[];
  signOffs: SignOffView[];
  gradeHistory: GradeHistoryEntry[];
}

const STATUS_BADGES: Record<string, { label: string; variant: "primary" | "success" | "warning" | undefined }> = {
  submitted: { label: "Submitted", variant: "primary" },
  in_review: { label: "In review", variant: "primary" },
  resubmitted: { label: "Resubmitted", variant: "primary" },
  changes_requested: { label: "Returned", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  signed_off: { label: "Signed off", variant: "success" },
};

const PART_LABELS: Record<string, string> = {
  text: "Written answer",
  photo: "Photo evidence",
  video: "Video evidence",
  link: "Live artifact link",
  checklist: "Checklist",
  file: "Document",
};

export function V3ReviewDetail({ submissionId }: { submissionId: string }) {
  const { data, error, loading, retry } = useApi<ReviewBundle>(`/api/v2/submissions/${submissionId}`);

  const [entries, setEntries] = useState<Array<{ criterionKey: string; score: number; aiDraft?: boolean }>>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeMsg, setGradeMsg] = useState<string | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [changeSheet, setChangeSheet] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return (
      <>
        <StateSkeletonHero />
        <StateSkeletonHero />
      </>
    );
  }
  if (error || !data) {
    return <StateError message={error ?? "Submission not found."} onRetry={retry} />;
  }

  const badge = STATUS_BADGES[data.status] ?? STATUS_BADGES.submitted;
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
    <>
      <V3PageHeader
        title={data.assignment.title}
        subtitle={`${data.learner.name}${data.cycle > 1 ? ` · cycle ${data.cycle}` : ""} · ${data.assignment.courseName ?? "Course"}`}
        action={
          <Link href="/instructor/review" className="v3-btn">
            <ArrowLeft size={14} aria-hidden /> Back to queue
          </Link>
        }
      />

      <div style={{ marginBottom: "var(--p-space-5)", display: "flex", justifyContent: "flex-end" }}>
        {badge.variant
          ? <V3Badge variant={badge.variant}>{badge.label}</V3Badge>
          : <V3Badge>{badge.label}</V3Badge>}
      </div>

      {/* Learner summary */}
      <V3Card style={{ marginBottom: "var(--p-space-5)" }}>
        <h3>Learner summary</h3>
        <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-secondary)" }}>
          {data.learnerSummary || <span style={{ color: "var(--text-muted)" }}>(none provided)</span>}
        </p>
      </V3Card>

      {/* Submission parts */}
      {data.parts.map((p, i) => (
        <section key={`${p.id}-${i}`} style={{ marginBottom: "var(--p-space-5)" }}>
          <p style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "var(--p-space-2)" }}>
            {PART_LABELS[p.type] ?? p.type}
          </p>
          <V3Card>
            <SubmissionRenderer part={p} />
          </V3Card>
        </section>
      ))}

      {/* Rubric grader + AI draft */}
      {data.rubric && (
        <section style={{ marginBottom: "var(--p-space-5)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--p-space-3)" }}>
            <h3 style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", margin: 0 }}>
              Rubric
            </h3>
            <button
              type="button"
              onClick={runAiDraft}
              disabled={aiBusy || !activeReview}
              className="v3-btn"
              style={{ fontSize: "var(--p-type-xs)" }}
            >
              {aiBusy ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <Sparkles size={12} aria-hidden style={{ color: "var(--info-on)" }} />
              )}
              AI draft
            </button>
          </div>
          <V3Card>
            <RubricGrader
              rubric={data.rubric}
              entries={entries}
              totalScore={data.score ?? undefined}
              maxScore={data.assignment.maxScore}
              onChange={setEntries}
            />
          </V3Card>
          {aiNotice && (
            <p role="status" style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)", margin: "var(--p-space-2) 0" }}>
              {aiNotice}
            </p>
          )}
          {activeReview && (
            <button
              type="button"
              onClick={saveGrade}
              disabled={savingGrade || entries.length === 0}
              className="v3-btn v3-btn-primary"
              style={{ width: "100%", marginTop: "var(--p-space-3)" }}
            >
              {savingGrade ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Check size={14} aria-hidden />
              )}
              Save grade
            </button>
          )}
          {gradeMsg && (
            <p role="status" style={{ fontSize: "var(--p-type-sm)", color: "var(--text-secondary)", margin: "var(--p-space-2) 0 0" }}>
              {gradeMsg}
            </p>
          )}
        </section>
      )}

      {/* Feedback thread */}
      <section style={{ marginBottom: "var(--p-space-5)" }}>
        <h3 style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "var(--p-space-3)" }}>
          Feedback
        </h3>
        <V3Card>
          <FeedbackThread
            messages={data.thread.map((m) => ({
              id: m.id, kind: m.kind, body: m.body, audioUrl: m.audioUrl,
              partId: m.partId, authorName: m.authorName, authorRole: m.authorRole, createdAt: m.createdAt,
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
        </V3Card>
      </section>

      {/* Sign-off chain */}
      {(data.policy.signOffChain?.length || data.signOffs.length > 0) && (
        <section style={{ marginBottom: "var(--p-space-5)" }}>
          <V3Card>
            <SignOffCard
              milestoneLabel={data.assignment.milestoneLabel ?? data.assignment.title}
              chain={data.policy.signOffChain ?? data.signOffs.map((s) => ({
                signerId: s.signerId, signerName: s.signerName, signerRole: s.signerRole,
              }))}
              done={data.signOffs.map((s) => ({ signerId: s.signerId, order: s.order }))}
              status={data.status}
            />
          </V3Card>
        </section>
      )}

      {/* Grade history */}
      {data.gradeHistory.length > 0 && (
        <section style={{ marginBottom: "var(--p-space-5)" }}>
          <h3 style={{ fontSize: "var(--p-type-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "var(--p-space-3)" }}>
            Grade history
          </h3>
          <V3Card style={{ padding: 0 }}>
            {data.gradeHistory.map((g) => (
              <div key={g.cycle} className="v3-course-row" style={{ paddingInline: "var(--p-space-5)" }}>
                <div className="v3-course-info">
                  <strong>Cycle {g.cycle}</strong>
                  <small>{new Date(g.createdAt).toLocaleDateString()}</small>
                </div>
                <span style={{ fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                  {g.totalScore != null ? `${g.totalScore}/${data.assignment.maxScore}` : "—"}
                </span>
              </div>
            ))}
          </V3Card>
        </section>
      )}

      {/* Action error */}
      {actionError && (
        <V3Card className="v3-empty" role="alert" style={{ marginBottom: "var(--p-space-5)", background: "var(--danger-subtle)", borderColor: "var(--danger)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-3)" }}>
            <AlertTriangle size={16} aria-hidden style={{ color: "var(--danger-on)" }} />
            <span style={{ color: "var(--danger-on)", fontSize: "var(--p-type-sm)" }}>{actionError}</span>
          </div>
        </V3Card>
      )}

      {/* Decision bar */}
      {activeReview && (
        <div style={{
          position: "fixed", insetInline: 0,
          bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
          zIndex: 10,
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "var(--p-space-3)",
        }}>
          <div style={{ display: "flex", gap: "var(--p-space-2)", maxWidth: 896, margin: "0 auto" }}>
            <button
              type="button"
              onClick={() => decide("approve")}
              disabled={decisionBusy}
              className="v3-btn v3-btn-success"
              style={{ flex: 1 }}
            >
              {decisionBusy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <BadgeCheck size={14} aria-hidden />
              )}
              Approve
            </button>
            <button
              type="button"
              onClick={() => setChangeSheet(true)}
              disabled={decisionBusy}
              className="v3-btn"
              style={{ flex: 1, background: "var(--warning-subtle)", color: "var(--warning-on)", borderColor: "var(--warning)" }}
            >
              <Undo2 size={14} aria-hidden />
              Request changes
            </button>
            {(data.policy.signOffChain?.length || data.signOffs.length > 0) && (
              <button
                type="button"
                onClick={() => decide("signoff")}
                disabled={decisionBusy}
                className="v3-btn v3-btn-primary"
                style={{ flex: 1 }}
              >
                Sign off
              </button>
            )}
          </div>
        </div>
      )}

      {/* Request-changes sheet */}
      <BottomSheet
        open={changeSheet}
        onOpenChange={setChangeSheet}
        title="Request changes"
        description="Explain what needs fixing — the learner sees this in their thread."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--p-space-3)" }}>
          <textarea
            value={changeText}
            onChange={(e) => setChangeText(e.target.value)}
            rows={4}
            placeholder="What should the learner change, and why?"
            aria-label="Feedback for the learner"
            style={{
              width: "100%", resize: "vertical",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              padding: "var(--p-space-3)",
              fontSize: "var(--p-type-sm)",
              color: "var(--text)",
            }}
          />
          <button
            type="button"
            onClick={() => decide("request_changes")}
            disabled={decisionBusy || !changeText.trim()}
            className="v3-btn"
            style={{ width: "100%", background: "var(--warning-subtle)", color: "var(--warning-on)", borderColor: "var(--warning)" }}
          >
            {decisionBusy ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Undo2 size={14} aria-hidden />
            )}
            Send request
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
