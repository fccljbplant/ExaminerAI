/**
 * modules/submission/lib/lifecycle.ts — W4 pure lifecycle state machine
 * (REDESIGN-P4 §5)
 *
 * submit → in_review → (request_changes → resubmit)* → approve / sign-off
 * Enforces cycle limits, resubmission cooldowns, mandatory feedback on
 * request_changes, and ordered multi-signer chains (HSE-style).
 * Pure — no db, no React.
 */

import {
  DEFAULT_POLICY,
  ResubmissionPolicySchema,
  type PartInput,
  type ResubmissionPolicy,
  type SubmissionStatus,
} from "../contracts";

// ── Policy parsing ───────────────────────────────────────────────────────

/** Parse an assignment's policy JSON, falling back to defaults on junk. */
export function parsePolicy(json: unknown): ResubmissionPolicy {
  const parsed = ResubmissionPolicySchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : DEFAULT_POLICY;
}

// ── Submit validation ────────────────────────────────────────────────────

export interface SubmitCheckFailure {
  ok: false;
  code: "PART_REQUIRED" | "PART_EMPTY" | "SUMMARY_REQUIRED" | "STATUS";
  message: string;
}

/** A part is non-empty when its type-specific payload has content. */
export function partIsFilled(p: PartInput): boolean {
  switch (p.type) {
    case "text":
      return !!p.text?.trim();
    case "photo":
    case "video":
    case "link":
      return !!p.url?.trim() || !!p.dataUrl?.trim();
    case "checklist":
      return Array.isArray(p.checklist) && p.checklist.length > 0;
    case "file":
      return !!p.fileName?.trim();
  }
}

/**
 * Validate a submit payload against the assignment's required part types.
 * learnerSummary is mandatory (P3 L6 — AI text-only packet depends on it).
 */
export function validateSubmit(
  requiredTypes: string[],
  parts: PartInput[],
  learnerSummary: string,
): SubmitCheckFailure | { ok: true } {
  if (!learnerSummary.trim()) {
    return {
      ok: false,
      code: "SUMMARY_REQUIRED",
      message: "A short summary of your work is required.",
    };
  }
  for (const type of requiredTypes) {
    const matching = parts.filter((p) => p.type === type);
    if (matching.length === 0) {
      return {
        ok: false,
        code: "PART_REQUIRED",
        message: `Missing required part: ${type}.`,
      };
    }
    if (!matching.some(partIsFilled)) {
      return {
        ok: false,
        code: "PART_EMPTY",
        message: `The "${type}" part is still empty.`,
      };
    }
  }
  return { ok: true };
}

// ── Resubmission ─────────────────────────────────────────────────────────

export interface ResubmitCheckFailure {
  ok: false;
  code: "STATUS" | "CYCLE_LIMIT" | "COOLDOWN";
  message: string;
}

/** Resubmission is only possible from changes_requested, within the cycle
 *  limit, and after the cooldown elapsed since the last decision. */
export function canResubmit(
  status: SubmissionStatus,
  cycle: number,
  decidedAt: Date | null,
  policy: ResubmissionPolicy,
  now: Date = new Date(),
): ResubmitCheckFailure | { ok: true } {
  if (status !== "changes_requested") {
    return {
      ok: false,
      code: "STATUS",
      message: "Only returned submissions can be resubmitted.",
    };
  }
  if (cycle >= policy.maxCycles) {
    return {
      ok: false,
      code: "CYCLE_LIMIT",
      message: `Resubmission limit reached (${policy.maxCycles} cycles).`,
    };
  }
  if (policy.cooldownHours > 0 && decidedAt) {
    const elapsed = now.getTime() - decidedAt.getTime();
    if (elapsed < policy.cooldownHours * 3_600_000) {
      return {
        ok: false,
        code: "COOLDOWN",
        message: `Please wait ${policy.cooldownHours}h before resubmitting.`,
      };
    }
  }
  return { ok: true };
}

// ── Decision validation ──────────────────────────────────────────────────

/** Request-changes requires feedback text (P3 I4 inline rule). */
export function validateDecision(
  decision: "approve" | "request_changes" | "signoff",
  feedbackText: string | undefined,
): { ok: false; message: string } | { ok: true } {
  if (decision === "request_changes" && !feedbackText?.trim()) {
    return {
      ok: false,
      message: "Requesting changes requires written feedback.",
    };
  }
  return { ok: true };
}

// ── Sign-off chains ──────────────────────────────────────────────────────

// (Learner actions map directly: submit → "submitted", resubmit →
//  "resubmitted"; both flip to in_review when a reviewer grades.)

export interface SignerRef {
  signerId: string;
  signerName: string;
  signerRole: string;
}

export interface SignOffDone {
  signerId: string;
  order: number;
}

/**
 * A signer may only sign when every lower-order chain member has signed
 * (ordered chain). Returns an error message when out of order.
 */
export function canSign(
  chain: SignerRef[],
  done: SignOffDone[],
  signerId: string,
): { ok: false; message: string } | { ok: true } {
  const expected = chain.findIndex((s) => s.signerId === signerId);
  if (expected === -1) {
    return { ok: false, message: "You are not on this sign-off chain." };
  }
  if (done.some((d) => d.signerId === signerId)) {
    return { ok: false, message: "You have already signed off." };
  }
  const pendingBefore = chain
    .slice(0, expected)
    .filter((s) => !done.some((d) => d.signerId === s.signerId));
  if (pendingBefore.length > 0) {
    return {
      ok: false,
      message: `Waiting for ${pendingBefore
        .map((s) => s.signerName || "a reviewer")
        .join(", ")} to sign first.`,
    };
  }
  return { ok: true };
}

/** The chain is complete when every member has a SignOff row. */
export function chainComplete(chain: SignerRef[], done: SignOffDone[]): boolean {
  return chain.every((s) => done.some((d) => d.signerId === s.signerId));
}

/**
 * Resolve the status after a reviewer decision.
 *  - request_changes → changes_requested
 *  - approve         → approved (chain, if any, still pending)
 *  - signoff         → signed_off when no chain or the chain completes
 *                     with this signer; otherwise approved (awaiting later signers)
 *
 * `currentSignerId` is the signer acting now (counted as signed even though
 * the row is written by the caller).
 */
export function resolveDecisionStatus(
  decision: "approve" | "request_changes" | "signoff",
  chain: SignerRef[],
  done: SignOffDone[],
  currentSignerId: string,
): SubmissionStatus {
  if (decision === "request_changes") return "changes_requested";
  if (decision === "signoff") {
    const doneAfter = [...done, { signerId: currentSignerId, order: -1 }];
    return chainComplete(chain, doneAfter) ? "signed_off" : "approved";
  }
  return "approved";
}
