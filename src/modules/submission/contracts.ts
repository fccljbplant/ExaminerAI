/**
 * modules/submission/contracts.ts — W4 Zod contracts (REDESIGN-P4 §2 L5–L7, I3/I4)
 *
 * Shared request/response schemas for the assignments & submissions v2 API.
 * Routes import these for input validation; client code can import them for
 * type-safe response parsing.
 */

import { z } from "zod";

// ── Status / type vocabularies ───────────────────────────────────────────

export const SUBMISSION_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "resubmitted",
  "approved",
  "signed_off",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Registry part-type keys (REDESIGN-P4 §3). */
export const PART_TYPES = ["text", "photo", "video", "link", "checklist", "file"] as const;
export type PartType = (typeof PART_TYPES)[number];

/** L5 status chips → server-side submission status filter. */
export const ASSIGNMENT_FILTERS = ["due", "in_review", "returned", "graded", "all"] as const;
export type AssignmentFilter = (typeof ASSIGNMENT_FILTERS)[number];

// ── Assignment list (L5) ─────────────────────────────────────────────────

export const AssignmentsQuery = z.object({
  status: z.enum(ASSIGNMENT_FILTERS).optional(),
  courseId: z.string().min(1).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type AssignmentsQuery = z.infer<typeof AssignmentsQuery>;

export const AssignmentSummarySchema = z.object({
  id: z.string(),
  courseId: z.string(),
  courseName: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  dueDate: z.string().nullable(),
  week: z.number().int().nullable(),
  maxScore: z.number().int(),
  requiredTypes: z.array(z.string()),
  milestoneLabel: z.string().nullable(),
  /** The learner's own submission rollup (null = never started). */
  submissionId: z.string().nullable(),
  status: z.string().nullable(),
  cycle: z.number().int().nullable(),
  score: z.number().nullable(),
  submittedAt: z.string().nullable(),
  hasDraft: z.boolean(),
});
export type AssignmentSummary = z.infer<typeof AssignmentSummarySchema>;

// ── Assignment detail + submission flow (L6) ─────────────────────────────

/** What a part looks like to the client (draft echo + review renderer). */
export const PartViewSchema = z.object({
  id: z.string(),
  type: z.string(),
  text: z.string().nullable(),
  url: z.string().nullable(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  dataUrl: z.string().nullable(),
  extractedText: z.string().nullable(),
  extractionStatus: z.string(),
  checklist: z.array(z.object({ label: z.string(), checked: z.boolean() })).nullable(),
});
export type PartView = z.infer<typeof PartViewSchema>;

/** Assignment policy JSON (also seeded inside domain templates). */
export const ResubmissionPolicySchema = z.object({
  maxCycles: z.number().int().min(1).max(10).default(3),
  cooldownHours: z.number().int().min(0).max(720).default(0),
  /** Ordered multi-signer chain (HSE-style); empty/omitted = single approver. */
  signOffChain: z
    .array(
      z.object({
        signerId: z.string(),
        signerName: z.string().default(""),
        signerRole: z.string().default("instructor"),
      }),
    )
    .max(5)
    .optional(),
});
export type ResubmissionPolicy = z.infer<typeof ResubmissionPolicySchema>;

export const DEFAULT_POLICY: ResubmissionPolicy = {
  maxCycles: 3,
  cooldownHours: 0,
};

export const AssignmentDetailSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  courseName: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  instructions: z.string(),
  dueDate: z.string().nullable(),
  week: z.number().int().nullable(),
  maxScore: z.number().int(),
  requiredTypes: z.array(z.string()),
  milestoneLabel: z.string().nullable(),
  rubric: z
    .object({
      id: z.string(),
      title: z.string(),
      criteria: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          weight: z.number(),
          aiAssist: z.boolean(),
          levels: z.array(
            z.object({ level: z.number(), label: z.string(), score: z.number() }),
          ),
        }),
      ),
    })
    .nullable(),
  policy: ResubmissionPolicySchema,
  submission: z
    .object({
      id: z.string(),
      status: z.string(),
      cycle: z.number().int(),
      score: z.number().nullable(),
      learnerSummary: z.string(),
      submittedAt: z.string().nullable(),
      decidedAt: z.string().nullable(),
      parts: z.array(PartViewSchema),
      thread: z.array(
        z.object({
          id: z.string(),
          kind: z.string(),
          body: z.string(),
          audioUrl: z.string().nullable(),
          partId: z.string().nullable(),
          authorName: z.string(),
          authorRole: z.string(),
          createdAt: z.string(),
        }),
      ),
      signOffs: z.array(
        z.object({
          signerId: z.string(),
          signerName: z.string(),
          signerRole: z.string(),
          order: z.number().int(),
          note: z.string(),
          decidedAt: z.string(),
        }),
      ),
    })
    .nullable(),
});
export type AssignmentDetail = z.infer<typeof AssignmentDetailSchema>;

// ── Draft / submit bodies ────────────────────────────────────────────────

/** One part as sent by the client. Files are pre-processed via POST /v2/uploads
 *  (extraction + validation) and the result is echoed here — the server keeps
 *  the original inline only when dataUrl is provided (≤ ~5MB base64). */
export const PartInputSchema = z.object({
  type: z.enum(PART_TYPES),
  text: z.string().max(20_000).optional(),
  url: z.string().url().max(2_000).optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  sizeBytes: z.number().int().nonnegative().max(6_000_000).optional(),
  dataUrl: z.string().max(7_000_000).optional(),
  extractedText: z.string().max(120_000).optional(),
  extractionStatus: z.enum(["none", "pending", "done", "failed"]).optional(),
  checklist: z
    .array(z.object({ label: z.string().max(200), checked: z.boolean() }))
    .max(30)
    .optional(),
});
export type PartInput = z.infer<typeof PartInputSchema>;

export const DraftSchema = z.object({
  learnerSummary: z.string().max(5_000).optional(),
  parts: z.array(PartInputSchema).max(10).optional(),
});
export type DraftInput = z.infer<typeof DraftSchema>;

export const SubmitSchema = DraftSchema;
export type SubmitInput = z.infer<typeof SubmitSchema>;

// ── Review side (I3/I4) ──────────────────────────────────────────────────

export const ReviewQueueQuery = z.object({
  type: z.string().optional(),
  status: z.enum(SUBMISSION_STATUSES).optional(),
  courseId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type ReviewQueueQuery = z.infer<typeof ReviewQueueQuery>;

export const ReviewQueueItemSchema = z.object({
  submissionId: z.string(),
  assignmentId: z.string(),
  assignmentTitle: z.string(),
  courseId: z.string(),
  courseName: z.string().nullable(),
  learnerId: z.string(),
  learnerName: z.string(),
  status: z.string(),
  cycle: z.number().int(),
  score: z.number().nullable(),
  submittedAt: z.string().nullable(),
  partTypes: z.array(z.string()),
  milestoneLabel: z.string().nullable(),
});
export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;

export const CriterionEntrySchema = z.object({
  criterionKey: z.string().min(1),
  score: z.number().min(0),
  note: z.string().max(2_000).optional(),
  aiDraft: z.boolean().optional(),
});
export type CriterionEntry = z.infer<typeof CriterionEntrySchema>;

export const GradeSchema = z.object({
  entries: z.array(CriterionEntrySchema).min(1).max(20),
});
export type GradeInput = z.infer<typeof GradeSchema>;

export const DecisionSchema = z.object({
  decision: z.enum(["approve", "request_changes", "signoff"]),
  /** Required (non-empty) when decision = request_changes. */
  feedbackText: z.string().max(5_000).optional(),
  note: z.string().max(2_000).optional(),
});
export type DecisionInput = z.infer<typeof DecisionSchema>;

export const FeedbackSchema = z.object({
  body: z.string().min(1).max(5_000),
  kind: z.enum(["text", "audio", "annotation"]).default("text"),
  audioUrl: z.string().url().max(2_000).optional(),
  partId: z.string().optional(),
  markers: z
    .array(z.object({ at: z.string().max(50), note: z.string().max(500) }))
    .max(20)
    .optional(),
});
export type FeedbackInput = z.infer<typeof FeedbackSchema>;
