"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  CloudUpload,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useApi } from "./use-api";
import { MediaCapture } from "@/modules/ui/media-capture";
import { SubmissionRenderer } from "@/modules/ui/submission-renderer";
import { FeedbackThread } from "@/modules/ui/feedback-thread";
import { SignOffCard } from "@/modules/ui/sign-off-card";

/**
 * modules/learner-portal — L6 Submission flow (REDESIGN-P3 §L6)
 *
 * Stepper: Instructions → Your work → Review → Submitted. Draft autosave
 * (debounced), client-side required-part validation mirroring the server,
 * resubmission from changes_requested with cycle/cooldown errors inline.
 * Every AI surface is text-only: the learnerSummary textarea feeds the
 * AiContextPacket; documents are extracted via POST /v2/uploads.
 */

/* ---------------- payload types (mirror GET /api/v2/assignments/[id]) --- */

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
export interface PartView {
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
  kind: "text" | "audio" | "annotation";
  body: string;
  audioUrl: string | null;
  partId: string | null;
  authorName: string;
  authorRole: string;
  createdAt: string;
}
interface SignOffView {
  signerId: string;
  signerName: string;
  signerRole: string;
  order: number;
  note: string;
  decidedAt: string;
}
export interface AssignmentDetail {
  id: string;
  courseId: string;
  courseName: string | null;
  title: string;
  description: string;
  instructions: string;
  dueDate: string | null;
  week: number | null;
  maxScore: number;
  requiredTypes: string[];
  milestoneLabel: string | null;
  rubric: {
    id: string;
    title: string;
    criteria: RubricCriterionView[];
  } | null;
  policy: {
    maxCycles: number;
    cooldownHours: number;
    signOffChain?: Array<{ signerId: string; signerName: string; signerRole: string }>;
  };
  submission: {
    id: string;
    status: string;
    cycle: number;
    score: number | null;
    learnerSummary: string;
    submittedAt: string | null;
    decidedAt: string | null;
    parts: PartView[];
    thread: ThreadMsgView[];
    signOffs: SignOffView[];
  } | null;
}

/* ---------------- part editing model ---------------------------------- */

export interface PartInput {
  type: string;
  text?: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  dataUrl?: string;
  extractedText?: string;
  extractionStatus?: "none" | "pending" | "done" | "failed";
  checklist?: Array<{ label: string; checked: boolean }>;
}

const PART_LABELS: Record<string, string> = {
  text: "Written answer",
  photo: "Photo evidence",
  video: "Video evidence",
  link: "Live artifact link",
  checklist: "Checklist",
  file: "Document",
};

const PART_HINTS: Record<string, string> = {
  text: "Type your answer — the AI assistant reads only what you write.",
  photo: "Take or upload a clear photo of your work (for your mentor).",
  video: "Paste a link to your video — videos are linked, not uploaded.",
  link: "Paste a URL your mentor can open.",
  checklist: "Tick each step you completed.",
  file: "Word or PDF — converted to text in-house for AI assistance.",
};

const DONE_STATUSES = new Set(["submitted", "in_review", "resubmitted", "approved", "signed_off"]);

const TIMELINE = ["submitted", "in_review", "changes_requested", "approved", "signed_off"] as const;
const TIMELINE_LABELS: Record<(typeof TIMELINE)[number], string> = {
  submitted: "Submitted",
  in_review: "In review",
  changes_requested: "Returned",
  approved: "Approved",
  signed_off: "Signed off",
};

/* ---------------- page ------------------------------------------------ */

export function SubmissionFlow({ assignmentId }: { assignmentId: string }) {
  const { data, error, isLoading, retry } = useApi<AssignmentDetail>(
    `/api/v2/assignments/${assignmentId}`,
  );

  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState("");
  const [parts, setParts] = useState<PartInput[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [resubmitMode, setResubmitMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── hydrate form state from the fetched detail (render-phase adjust,
  //    per react-hooks guidance — no setState inside effects) ──────────
  const [prevData, setPrevData] = useState<AssignmentDetail | null | undefined>(undefined);
  if (data !== prevData) {
    setPrevData(data);
    if (data?.submission) {
      setSummary(data.submission.learnerSummary);
      setParts(data.submission.parts.map((p) => partToInput(p)));
      const done = DONE_STATUSES.has(data.submission.status);
      setStep(done ? 3 : data.submission.status === "changes_requested" ? 1 : 0);
      setResubmitMode(data.submission.status === "changes_requested");
    }
    setHydrated(true);
  }

  const submission = data?.submission ?? null;
  const status = submission?.status ?? null;
  const done = status ? DONE_STATUSES.has(status) : false;
  const canEdit = hydrated && !done && !submitting;

  // ── draft autosave (debounced; setState only in async callbacks) ─────
  useEffect(() => {
    if (!canEdit || !dirty) return;
    const t = setTimeout(() => {
      api
        .post<{ ok: boolean; data: { submissionId: string } }>(
          `/api/v2/assignments/${assignmentId}/draft`,
          { learnerSummary: summary, parts },
        )
        .then(() => {
          setDraftStatus("saved");
          setDirty(false);
        })
        .catch(() => setDraftStatus("error"));
    }, 1200);
    return () => clearTimeout(t);
  }, [summary, parts, dirty, canEdit, assignmentId]);

  const missing = useMemo(() => {
    if (!data) return [];
    return data.requiredTypes.filter(
      (t) => !parts.some((p) => p.type === t && partFilled(p)),
    );
  }, [data, parts]);

  function touch() {
    setDirty(true);
    setDraftStatus("saving");
  }

  function setPart(patch: PartInput) {
    touch();
    setParts((prev) => {
      const existing = prev.findIndex((p) => p.type === patch.type);
      if (existing === -1) return [...prev, patch];
      const next = [...prev];
      next[existing] = patch;
      return next;
    });
  }

  function partFor(type: string): PartInput | undefined {
    return parts.find((p) => p.type === type);
  }

  async function handleSubmit() {
    if (!data) return;
    setSubmitting(true);
    setSubmitError(null);
    const payload = { learnerSummary: summary, parts };
    try {
      if (resubmitMode && submission) {
        await api.post<{ ok: boolean; data: { status: string; cycle: number } }>(
          `/api/v2/submissions/${submission.id}/resubmit`,
          payload,
        );
      } else {
        await api.post<{ ok: boolean; data: { submissionId: string; status: string; cycle: number } }>(
          `/api/v2/assignments/${assignmentId}/submit`,
          payload,
        );
      }
      setDirty(false);
      setDraftStatus("saved");
      setResubmitMode(false);
      retry(); // refetch → hydration lands on the Submitted step
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not submit — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <FlowSkeleton />;
  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-4 py-10 text-center">
        <p className="text-sm text-fg-secondary">{error ?? "Assignment not found."}</p>
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24 md:pb-8">
      {/* header */}
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-fg-muted">
              <Link href="/learner/assignments" className="hover:text-fg">
                Assignments
              </Link>{" "}
              · {data.courseName ?? "Course"}
            </p>
            <h1 className="truncate text-lg font-semibold text-fg md:text-xl">{data.title}</h1>
          </div>
          {data.maxScore > 0 && (
            <span className="shrink-0 rounded-md bg-bg-subtle px-2 py-1 text-xs font-medium tabular-nums text-fg-secondary">
              /{data.maxScore} pts
            </span>
          )}
        </div>
        <Stepper current={step} />
      </header>

      {/* returned banner with mentor feedback */}
      {status === "changes_requested" && step !== 0 && (
        <div className="rounded-xl border border-warning-subtle bg-warning-subtle p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-warning-on">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Changes requested — see your mentor&apos;s feedback below
          </p>
          <div className="mt-3">
            <FeedbackThread messages={submission?.thread ?? []} readOnly />
          </div>
        </div>
      )}

      {/* draft status chip */}
      {canEdit && draftStatus !== "idle" && (
        <p className="text-xs text-fg-muted" aria-live="polite">
          {draftStatus === "saving" && "Saving draft…"}
          {draftStatus === "saved" && "Draft saved"}
          {draftStatus === "error" && "Draft save failed — changes are kept on this screen"}
        </p>
      )}

      {/* STEP 0 — instructions */}
      {step === 0 && (
        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Instructions</h2>
            {data.instructions ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-secondary">
                {data.instructions}
              </p>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">{data.description || "No extra instructions."}</p>
            )}
            <ul className="mt-3 space-y-2">
              {data.requiredTypes.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm">
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                  <span>
                    <span className="font-medium text-fg">{PART_LABELS[t] ?? t}</span>
                    <span className="block text-xs text-fg-muted">{PART_HINTS[t] ?? ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {data.rubric && (
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-fg">How it will be graded</h2>
              <ul className="mt-2 space-y-2">
                {data.rubric.criteria.map((c) => (
                  <li key={c.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-fg-secondary">
                      {c.label}
                      {c.aiAssist && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-info-on">
                          <Sparkles className="h-3 w-3" aria-hidden />
                          AI-assisted
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-fg-muted">weight {c.weight}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-fg-muted">
                {data.policy.maxCycles > 1
                  ? `Up to ${data.policy.maxCycles} resubmissions`
                  : "Single attempt"}
                {data.policy.cooldownHours > 0
                  ? ` · ${data.policy.cooldownHours}h cooldown between resubmissions`
                  : ""}
                .
              </p>
            </section>
          )}
        </div>
      )}

      {/* STEP 1 — your work */}
      {step === 1 && (
        <div className="space-y-4">
          <section className="space-y-2">
            <label htmlFor="summary" className="text-sm font-semibold text-fg">
              Summary of your work <span className="text-danger">*</span>
            </label>
            <textarea
              id="summary"
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                touch();
              }}
              rows={4}
              placeholder="In your own words: what did you do, and what should your mentor look at?"
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            />
            <p className="text-xs text-fg-muted">
              Required — this is the text the AI assistant reads (photos and videos are for
              your mentor&apos;s eyes).
            </p>
          </section>

          {data.requiredTypes.map((t) => (
            <PartEditor key={t} type={t} part={partFor(t)} onChange={setPart} />
          ))}
        </div>
      )}

      {/* STEP 2 — review */}
      {step === 2 && (
        <div className="space-y-4">
          {missing.length > 0 && (
            <div className="rounded-xl border border-warning-subtle bg-warning-subtle p-4 text-sm text-warning-on">
              Still missing: {missing.map((t) => PART_LABELS[t] ?? t).join(", ")}.
            </div>
          )}
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg">Your summary</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
              {summary.trim() || <span className="text-fg-muted">(empty)</span>}
            </p>
          </section>
          {parts.map((p, i) => (
            <section key={`${p.type}-${i}`} className="space-y-1.5">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {PART_LABELS[p.type] ?? p.type}
              </p>
              <SubmissionRenderer part={p} />
            </section>
          ))}
        </div>
      )}

      {/* STEP 3 — submitted */}
      {step === 3 && submission && (
        <div className="space-y-4">
          {/* status timeline */}
          <Timeline status={submission.status} />

          {/* score */}
          {submission.score != null && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
              <p className="text-sm font-semibold text-fg">Score</p>
              <p className="text-sm font-medium tabular-nums text-fg-secondary">
                {submission.score} / {data.maxScore}
              </p>
            </div>
          )}

          {/* mentor feedback */}
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Conversation with your mentor
            </h2>
            <FeedbackThread
              messages={submission.thread}
              readOnly
              emptyLabel="No feedback yet — your mentor will reply here."
            />
          </section>

          {/* sign-off chain */}
          {(data.policy.signOffChain?.length || submission.signOffs.length > 0) && (
            <SignOffCard
              milestoneLabel={data.milestoneLabel ?? data.title}
              chain={data.policy.signOffChain ?? submission.signOffs.map((s) => ({
                signerId: s.signerId,
                signerName: s.signerName,
                signerRole: s.signerRole,
              }))}
              done={submission.signOffs.map((s) => ({ signerId: s.signerId, order: s.order }))}
              status={submission.status}
            />
          )}

          {/* your submission */}
          <section className="space-y-1.5">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Your submission
            </h2>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">
                {submission.learnerSummary || <span className="text-fg-muted">(no summary)</span>}
              </p>
            </div>
            {submission.parts.map((p, i) => (
              <div key={`${p.type}-${i}`}>
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {PART_LABELS[p.type] ?? p.type}
                </p>
                <SubmissionRenderer part={p} />
              </div>
            ))}
          </section>

          {status === "changes_requested" && (
            <div className="rounded-xl border border-warning-subtle bg-warning-subtle p-4">
              <p className="text-sm font-medium text-warning-on">
                Your mentor asked for changes. Update your work and resubmit
                {submission.cycle < data.policy.maxCycles
                  ? ` (${data.policy.maxCycles - submission.cycle} attempt${data.policy.maxCycles - submission.cycle === 1 ? "" : "s"} left)`
                  : ""}.
              </p>
              {data.policy.cooldownHours > 0 && (
                <p className="mt-1 text-xs text-warning-on/80">
                  {data.policy.cooldownHours}h cooldown applies between resubmissions.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* submit error */}
      {submitError && (
        <div
          role="alert"
          className="rounded-xl border border-danger-subtle bg-danger-subtle px-4 py-3 text-sm text-danger-on"
        >
          {submitError}
        </div>
      )}

      {/* bottom action bar — on xs it sits ABOVE the fixed BottomNav
          (56px + safe inset) so the primary action is never covered;
          md+ it returns to the flow. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-[var(--p-z-raised)] border-t border-line bg-surface p-3 md:static md:bottom-auto md:z-auto md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {step > 0 && step < 3 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s as number) - 1)}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
          )}
          {step === 0 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover"
            >
              Start your work
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={missing.length > 0}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              Review
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || missing.length > 0}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting ? "Submitting…" : resubmitMode ? "Resubmit" : "Submit"}
              <CloudUpload className="h-4 w-4" aria-hidden />
            </button>
          )}
          {step === 3 && (
            <>
              <Link
                href="/learner/assignments"
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong"
              >
                Back to assignments
              </Link>
              {status === "changes_requested" && (
                <button
                  type="button"
                  onClick={() => {
                    setResubmitMode(true);
                    setStep(1);
                  }}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover"
                >
                  Edit and resubmit
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------------------------------------- */

function partToInput(p: PartView): PartInput {
  return {
    type: p.type,
    ...(p.text != null ? { text: p.text } : {}),
    ...(p.url ? { url: p.url } : {}),
    ...(p.fileName ? { fileName: p.fileName } : {}),
    ...(p.mimeType ? { mimeType: p.mimeType } : {}),
    ...(p.sizeBytes != null ? { sizeBytes: p.sizeBytes } : {}),
    ...(p.dataUrl ? { dataUrl: p.dataUrl } : {}),
    ...(p.extractedText ? { extractedText: p.extractedText } : {}),
    extractionStatus: (p.extractionStatus ?? "none") as PartInput["extractionStatus"],
    ...(p.checklist ? { checklist: p.checklist } : {}),
  };
}

function partFilled(p: PartInput): boolean {
  switch (p.type) {
    case "text":
      return Boolean(p.text?.trim());
    case "photo":
    case "video":
    case "link":
      return Boolean(p.url?.trim() || p.dataUrl?.trim());
    case "checklist":
      return Boolean(p.checklist?.length);
    case "file":
      return Boolean(p.fileName?.trim());
    default:
      return false;
  }
}

function Stepper({ current }: { current: number }) {
  const steps = ["Instructions", "Your work", "Review", "Submitted"];
  return (
    <ol className="flex items-center gap-1" aria-label="Submission progress">
      {steps.map((label, i) => (
        <li key={label} className="flex min-w-0 flex-1 items-center gap-1">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              i < current
                ? "bg-success-subtle text-success-on"
                : i === current
                  ? "bg-brand text-on-brand"
                  : "bg-bg-subtle text-fg-muted"
            )}
          >
            {i < current ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span
            className={cn(
              "truncate text-xs",
              i === current ? "font-medium text-fg" : "text-fg-muted"
            )}
          >
            {label}
          </span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function Timeline({ status }: { status: string }) {
  const currentIdx = TIMELINE.indexOf(status as (typeof TIMELINE)[number]);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <ol className="flex">
        {TIMELINE.map((s, i) => {
          const passed = currentIdx >= 0 && i <= currentIdx;
          const active = i === currentIdx;
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-3">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  passed ? (s === "changes_requested" ? "bg-warning" : "bg-success") : "bg-line",
                  active && "ring-2 ring-line-strong"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "truncate text-center text-[11px]",
                  active ? "font-medium text-fg" : passed ? "text-fg-secondary" : "text-fg-muted"
                )}
              >
                {TIMELINE_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------- part editors ----------------------------------------- */

function PartEditor({
  type,
  part,
  onChange,
}: {
  type: string;
  part?: PartInput;
  onChange: (patch: PartInput) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">{PART_LABELS[type] ?? type}</h2>
      <p className="mb-3 text-xs text-fg-muted">{PART_HINTS[type] ?? ""}</p>

      {type === "text" && (
        <textarea
          value={part?.text ?? ""}
          onChange={(e) => onChange({ type: "text", text: e.target.value })}
          rows={5}
          placeholder="Write your answer…"
          aria-label={PART_LABELS.text}
          className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
        />
      )}

      {type === "link" && (
        <input
          type="url"
          value={part?.url ?? ""}
          onChange={(e) => onChange({ type: "link", url: e.target.value })}
          placeholder="https://…"
          aria-label={PART_LABELS.link}
          className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
        />
      )}

      {type === "video" && (
        <input
          type="url"
          value={part?.url ?? ""}
          onChange={(e) =>
            onChange({ type: "video", url: e.target.value, fileName: part?.fileName ?? "video" })
          }
          placeholder="https://… (video link)"
          aria-label={PART_LABELS.video}
          className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
        />
      )}

      {type === "photo" && (
        <div className="space-y-3">
          <MediaCapture
            accept="image/*"
            capture="environment"
            label={part?.fileName ? "Replace photo" : "Take or upload a photo"}
            onFile={(f) =>
              onChange({
                type: "photo",
                fileName: f.fileName,
                mimeType: f.mimeType,
                sizeBytes: f.sizeBytes,
                dataUrl: f.dataUrl ?? undefined,
              })
            }
            onError={(msg) => onChange({ type: "photo", text: msg })}
          />
          {part && <SubmissionRenderer part={part} />}
          {part?.text && !part.fileName && (
            <p className="text-xs text-danger-on">{part.text}</p>
          )}
        </div>
      )}

      {type === "file" && (
        <div className="space-y-3">
          <MediaCapture
            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            label={part?.fileName ? "Replace document" : "Upload Word or PDF"}
            onFile={(f) => onFilePart(f)}
            onError={(msg) => onChange({ type: "file", text: msg })}
          />
          {part && part.fileName && (
            <FileStatus part={part} />
          )}
        </div>
      )}

      {type === "checklist" && (
        <ChecklistEditor
          items={part?.checklist ?? []}
          onChange={(checklist) => onChange({ type: "checklist", checklist })}
        />
      )}
    </section>
  );

  /** Upload a document, run in-house extraction, then store the part. */
  async function onFilePart(f: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl: string | null;
  }) {
    if (!f.dataUrl) {
      onChange({ type: "file", fileName: f.fileName, text: "File too large to process." });
      return;
    }
    onChange({ type: "file", fileName: f.fileName, extractionStatus: "pending" });
    try {
      const res = await api.post<{
        ok: boolean;
        data: {
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          extractionStatus: "done" | "failed";
          extractedText: string;
          truncated: boolean;
          reason?: string;
        };
      }>("/api/v2/uploads", {
        fileName: f.fileName,
        mimeType: f.mimeType,
        dataBase64: f.dataUrl,
      });
      onChange({
        type: "file",
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        extractedText: res.data.extractedText,
        extractionStatus: res.data.extractionStatus,
      });
    } catch (e) {
      onChange({
        type: "file",
        fileName: f.fileName,
        extractionStatus: "failed",
        text: e instanceof Error ? e.message : "Extraction failed",
      });
    }
  }
}

function FileStatus({ part }: { part: PartInput }) {
  if (part.extractionStatus === "pending") {
    return (
      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Converting to text…
      </p>
    );
  }
  return <SubmissionRenderer part={part} />;
}

function ChecklistEditor({
  items,
  onChange,
}: {
  items: Array<{ label: string; checked: boolean }>;
  onChange: (items: Array<{ label: string; checked: boolean }>) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const label = draft.trim();
    if (!label) return;
    onChange([...items, { label, checked: false }]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-bg-subtle px-3 py-2">
          <input
            type="checkbox"
            id={`check-${i}`}
            checked={item.checked}
            onChange={(e) =>
              onChange(items.map((it, j) => (j === i ? { ...it, checked: e.target.checked } : it)))
            }
            className="h-4 w-4 shrink-0 accent-[var(--brand)]"
          />
          <label htmlFor={`check-${i}`} className="min-w-0 flex-1 truncate text-sm text-fg">
            {item.label}
          </label>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label={`Remove "${item.label}"`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a step (e.g. “Harness checked”)"
          aria-label="New checklist step"
          className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-subtle text-fg hover:border-line-strong disabled:opacity-50"
          aria-label="Add step"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function FlowSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4 pb-24">
      <div className="h-6 w-1/2 rounded bg-bg-subtle" />
      <div className="h-3 w-2/3 rounded bg-bg-subtle" />
      <div className="h-40 rounded-xl bg-bg-subtle" />
      <div className="h-24 rounded-xl bg-bg-subtle" />
    </div>
  );
}
