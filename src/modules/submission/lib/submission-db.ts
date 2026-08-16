/**
 * modules/submission/lib/submission-db.ts — W4 DB wrapper
 *
 * Thin async functions that read/write via Prisma and call the pure libs
 * (lifecycle.ts, rubric-engine.ts, registries.ts). This is the ONLY file
 * in the submission subsystem that imports `db`.
 *
 * Access model (IDOR guards live here, not in routes):
 *   learner    → must be enrolled (CourseEnrollment role "student")
 *   instructor → must teach the course (CourseEnrollment role "instructor")
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import {
  type AssignmentFilter,
  type AssignmentSummary,
  type CriterionEntry,
  type DecisionInput,
  type FeedbackInput,
  type PartInput,
  type PartView,
  type ResubmissionPolicy,
  type ReviewQueueItem,
  type SubmissionStatus,
} from "../contracts";
import {
  canResubmit,
  canSign,
  chainComplete,
  parsePolicy,
  resolveDecisionStatus,
  validateDecision,
  validateSubmit,
  type SignOffDone,
  type SignerRef,
} from "./lifecycle";
import { grade, type RubricDef } from "./rubric-engine";
import {
  DEFAULT_SUBMISSION_TYPES,
  SAMPLE_DOMAIN_TEMPLATES,
} from "./registries";

// ── Errors (routes map these to typed responses) ─────────────────────────

export class SubmissionError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = "SubmissionError";
  }
}

// ── JSON helpers ─────────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

function asRecord(json: unknown): JsonRecord {
  return (json ?? {}) as JsonRecord;
}

export function parsePartTypes(json: unknown): string[] {
  const raw = asRecord({ v: json }).v;
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
  return [];
}

function partToView(part: {
  id: string;
  type: string;
  payloadJson: unknown;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  extractedText: string | null;
  extractionStatus: string;
}): PartView {
  const payload = asRecord(part.payloadJson);
  const checklist = Array.isArray(payload.checklist)
    ? (payload.checklist as { label: string; checked: boolean }[])
    : null;
  return {
    id: part.id,
    type: part.type,
    text: typeof payload.text === "string" ? payload.text : null,
    url: typeof payload.url === "string" ? payload.url : null,
    fileName: part.fileName,
    mimeType: part.mimeType,
    sizeBytes: part.sizeBytes,
    dataUrl: typeof payload.dataUrl === "string" ? payload.dataUrl : null,
    extractedText: part.extractedText,
    extractionStatus: part.extractionStatus,
    checklist,
  };
}

function partInputToData(
  assignmentPart: PartInput,
): Omit<Prisma.SubmissionPartUncheckedCreateInput, "submissionId" | "submission"> {
  const payload: JsonRecord = {};
  if (assignmentPart.text) payload.text = assignmentPart.text;
  if (assignmentPart.url) payload.url = assignmentPart.url;
  if (assignmentPart.dataUrl) payload.dataUrl = assignmentPart.dataUrl;
  if (assignmentPart.checklist) payload.checklist = assignmentPart.checklist;

  return {
    type: assignmentPart.type,
    payloadJson: payload as unknown as Prisma.InputJsonValue,
    fileName: assignmentPart.fileName ?? null,
    mimeType: assignmentPart.mimeType ?? null,
    sizeBytes: assignmentPart.sizeBytes ?? null,
    extractedText: assignmentPart.extractedText ?? null,
    extractionStatus: assignmentPart.extractionStatus ?? "none",
  };
}

// ── Registry seeding (idempotent, once per process) ──────────────────────

let registriesEnsured = false;

/** Insert-or-update a platform-default registry row. SQL NULL semantics make
 *  the [orgId, kind, key] unique index unreliable for NULL orgId rows, so
 *  defaults resolve query-first instead of via the compound upsert key. */
async function upsertDefaultRow(
  kind: string,
  key: string,
  label: string,
  sortOrder: number,
  configJson: JsonRecord,
): Promise<void> {
  const existing = await db.registryRow.findFirst({
    where: { orgId: null, kind, key },
    select: { id: true },
  });
  const data = {
    kind,
    key,
    label,
    sortOrder,
    configJson: configJson as unknown as Prisma.InputJsonValue,
  };
  if (!existing) {
    await db.registryRow.create({ data });
  } else {
    await db.registryRow.update({ where: { id: existing.id }, data });
  }
}

/** Seed platform-default registry rows (orgId = null). Zero-code domains:
 *  a new domain = a RegistryRow insert, never a code change (P4 §5).
 *
 *  Best-effort: one failed row (e.g. a read-only demo db on a serverless
 *  instance) must never take down the whole queue — reads still work and
 *  the seeding re-runs on the next process. */
export async function ensureDefaultRegistries(): Promise<void> {
  if (registriesEnsured) return;
  for (const [i, t] of DEFAULT_SUBMISSION_TYPES.entries()) {
    await upsertDefaultRow("submission_type", t.key, t.label, i, {
      captureHint: t.captureHint,
      maxBytes: t.maxBytes,
      acceptMime: t.acceptMime,
      aiVisible: t.aiVisible,
    }).catch((err) => {
      logger.warn("Registry seed failed (submission_type)", { key: t.key, err });
    });
  }
  for (const [i, tpl] of SAMPLE_DOMAIN_TEMPLATES.entries()) {
    await upsertDefaultRow("assignment_template", tpl.key, tpl.label, i + 1, {
      description: tpl.description,
      partTypes: tpl.partTypes,
      policy: tpl.policy,
      rubricTitle: tpl.rubricTitle,
      criteria: tpl.criteria,
      instructions: tpl.instructions,
    }).catch((err) => {
      logger.warn("Registry seed failed (assignment_template)", { key: tpl.key, err });
    });
  }
  registriesEnsured = true;
}

// ── Access guards ────────────────────────────────────────────────────────

async function enrolledCourseIds(userId: string, role: string): Promise<string[]> {
  const enrollments = await db.courseEnrollment.findMany({
    where: { userId, role },
    select: { courseId: true },
  });
  return enrollments.map((e) => e.courseId);
}

async function requireLearnerAccess(
  userId: string,
  courseId: string,
): Promise<void> {
  const enrollments = await enrolledCourseIds(userId, "student");
  if (!enrollments.includes(courseId)) {
    throw new SubmissionError("Not enrolled in this course", "IDOR_VIOLATION", 403);
  }
}

async function requireInstructorAccess(
  userId: string,
  courseId: string,
): Promise<void> {
  const teaching = await enrolledCourseIds(userId, "instructor");
  if (!teaching.includes(courseId)) {
    throw new SubmissionError("You do not teach this course", "IDOR_VIOLATION", 403);
  }
}

// ── L5: learner assignment list ──────────────────────────────────────────

const FILTER_STATUSES: Record<Exclude<AssignmentFilter, "all">, string[]> = {
  due: ["__none__", "draft"],
  in_review: ["submitted", "in_review", "resubmitted"],
  returned: ["changes_requested"],
  graded: ["approved", "signed_off"],
};

export async function listLearnerAssignments(
  userId: string,
  query: { status?: AssignmentFilter; courseId?: string; cursor?: string; limit?: number },
): Promise<{ items: AssignmentSummary[]; nextCursor: string | null }> {
  await ensureDefaultRegistries();
  let courseIds = await enrolledCourseIds(userId, "student");
  if (query.courseId) courseIds = courseIds.filter((c) => c === query.courseId);
  if (courseIds.length === 0) return { items: [], nextCursor: null };

  const limit = query.limit ?? 20;
  const assignments = await db.assignment.findMany({
    where: { courseId: { in: courseIds }, status: "published" },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: limit,
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      dueDate: true,
      week: true,
      maxScore: true,
      milestoneLabel: true,
      partTypesJson: true,
      course: { select: { name: true } },
      submissions: {
        where: { userId },
        select: {
          id: true,
          status: true,
          cycle: true,
          score: true,
          submittedAt: true,
        },
      },
    },
  });

  const wanted = query.status ?? "all";
  const items = assignments
    .map<AssignmentSummary>((a) => {
      const sub = a.submissions[0] ?? null;
      return {
        id: a.id,
        courseId: a.courseId,
        courseName: a.course.name,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate?.toISOString() ?? null,
        week: a.week,
        maxScore: a.maxScore,
        requiredTypes: parsePartTypes(a.partTypesJson),
        milestoneLabel: a.milestoneLabel,
        submissionId: sub?.id ?? null,
        status: sub?.status ?? null,
        cycle: sub?.cycle ?? null,
        score: sub?.score ?? null,
        submittedAt: sub?.submittedAt?.toISOString() ?? null,
        hasDraft: sub?.status === "draft",
      };
    })
    .filter((a) => {
      if (wanted === "all") return true;
      const allowed = FILTER_STATUSES[wanted];
      return allowed.includes(a.status ?? "__none__");
    });

  const nextCursor =
    assignments.length === limit ? assignments[assignments.length - 1].id : null;
  return { items, nextCursor };
}

// ── L6: assignment detail + draft/submit ─────────────────────────────────

async function loadAssignmentBundle(assignmentId: string) {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: { select: { name: true } },
      rubric: {
        include: { criteria: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!assignment) {
    throw new SubmissionError("Assignment not found", "NOT_FOUND", 404);
  }
  return assignment;
}

function bundlePolicy(json: unknown): ResubmissionPolicy {
  return parsePolicy(json);
}

function bundleRubric(
  rubric: { id: string; title: string; maxScore?: number; criteria: Array<{ key: string; label: string; weight: number; aiAssist: boolean; levelsJson: unknown }> } | null,
  assignmentMaxScore: number,
): RubricDef | null {
  if (!rubric || rubric.criteria.length === 0) return null;
  return {
    id: rubric.id,
    title: rubric.title,
    maxScore: assignmentMaxScore,
    criteria: rubric.criteria.map((c) => ({
      key: c.key,
      label: c.label,
      weight: c.weight,
      aiAssist: c.aiAssist,
      levels: Array.isArray(asRecord({ v: c.levelsJson }).v)
        ? (asRecord({ v: c.levelsJson }).v as RubricDef["criteria"][number]["levels"])
        : [],
    })),
  };
}

export async function getAssignmentDetail(
  assignmentId: string,
  userId: string,
) {
  await ensureDefaultRegistries();
  const bundle = await loadAssignmentBundle(assignmentId);
  await requireLearnerAccess(userId, bundle.courseId);

  const submission = await db.submission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } },
    include: {
      parts: { orderBy: { createdAt: "asc" } },
      thread: { include: { messages: { orderBy: { createdAt: "asc" } } } },
      signOffs: { orderBy: { order: "asc" } },
    },
  });

  const rubric = bundleRubric(bundle.rubric, bundle.maxScore);
  return {
    id: bundle.id,
    courseId: bundle.courseId,
    courseName: bundle.course.name,
    title: bundle.title,
    description: bundle.description,
    instructions: bundle.instructions,
    dueDate: bundle.dueDate?.toISOString() ?? null,
    week: bundle.week,
    maxScore: bundle.maxScore,
    requiredTypes: parsePartTypes(bundle.partTypesJson),
    milestoneLabel: bundle.milestoneLabel,
    rubric: rubric
      ? {
          id: rubric.id,
          title: rubric.title,
          criteria: rubric.criteria.map((c) => ({
            key: c.key,
            label: c.label,
            weight: c.weight,
            aiAssist: c.aiAssist,
            levels: c.levels,
          })),
        }
      : null,
    policy: bundlePolicy(bundle.resubmissionPolicyJson),
    submission: submission
      ? {
          id: submission.id,
          status: submission.status,
          cycle: submission.cycle,
          score: submission.score,
          learnerSummary: submission.learnerSummary,
          submittedAt: submission.submittedAt?.toISOString() ?? null,
          decidedAt: submission.decidedAt?.toISOString() ?? null,
          parts: submission.parts.map(partToView),
          thread: (submission.thread?.messages ?? []).map((m) => ({
            id: m.id,
            kind: m.kind,
            body: m.body,
            audioUrl: m.audioUrl,
            partId: m.partId,
            authorName: m.authorName,
            authorRole: m.authorRole,
            createdAt: m.createdAt.toISOString(),
          })),
          signOffs: submission.signOffs.map((s) => ({
            signerId: s.signerId,
            signerName: s.signerName,
            signerRole: s.signerRole,
            order: s.order,
            note: s.note,
            decidedAt: s.decidedAt.toISOString(),
          })),
        }
      : null,
  };
}

/** Replace the parts + summary of a submission (draft upsert). */
async function writeParts(
  submissionId: string,
  input: { learnerSummary?: string; parts?: PartInput[] },
  defaults: { learnerSummary: string },
): Promise<void> {
  await db.$transaction([
    db.submissionPart.deleteMany({ where: { submissionId } }),
    db.submissionPart.createMany({
      data: (input.parts ?? []).map((p) => ({
        ...partInputToData(p),
        submissionId,
      })),
    }),
    db.submission.update({
      where: { id: submissionId },
      data: { learnerSummary: input.learnerSummary ?? defaults.learnerSummary },
    }),
  ]);
}

export async function saveDraft(
  assignmentId: string,
  userId: string,
  input: { learnerSummary?: string; parts?: PartInput[] },
): Promise<{ submissionId: string }> {
  const bundle = await loadAssignmentBundle(assignmentId);
  await requireLearnerAccess(userId, bundle.courseId);

  const existing = await db.submission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } },
    select: { id: true, status: true, learnerSummary: true },
  });
  if (existing && !["draft", "changes_requested"].includes(existing.status)) {
    throw new SubmissionError(
      "This submission is locked while under review",
      "CONFLICT",
      409,
    );
  }

  if (!existing) {
    const created = await db.submission.create({
      data: {
        assignmentId,
        userId,
        status: "draft",
        learnerSummary: input.learnerSummary ?? "",
      },
    });
    await writeParts(created.id, input, { learnerSummary: "" });
    await db.feedbackThread.create({
      data: { submissionId: created.id },
    }).catch(() => undefined); // already exists (unique) — ignore
    return { submissionId: created.id };
  }

  await writeParts(existing.id, input, { learnerSummary: existing.learnerSummary });
  return { submissionId: existing.id };
}

export async function submitAssignment(
  assignmentId: string,
  userId: string,
  input: { learnerSummary?: string; parts?: PartInput[] },
): Promise<{ submissionId: string; status: string; cycle: number }> {
  const bundle = await loadAssignmentBundle(assignmentId);
  await requireLearnerAccess(userId, bundle.courseId);

  const required = parsePartTypes(bundle.partTypesJson);
  const parts = input.parts ?? [];
  const summary = input.learnerSummary ?? "";
  const check = validateSubmit(required, parts, summary);
  if (!check.ok) throw new SubmissionError(check.message, check.code, 400);

  const existing = await db.submission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } },
    select: { id: true, status: true, cycle: true, learnerSummary: true },
  });
  if (existing && !["draft", "changes_requested"].includes(existing.status)) {
    throw new SubmissionError(
      "Already submitted — waiting for review",
      "CONFLICT",
      409,
    );
  }

  let submissionId: string;
  let cycle = 1;
  if (!existing) {
    const created = await db.submission.create({
      data: {
        assignmentId,
        userId,
        status: "submitted",
        cycle: 1,
        learnerSummary: summary,
        submittedAt: new Date(),
      },
    });
    submissionId = created.id;
    await db.feedbackThread.create({ data: { submissionId } }).catch(() => undefined);
  } else {
    // Learner hit Submit on a returned submission — same as resubmit.
    const policy = bundlePolicy(bundle.resubmissionPolicyJson);
    const decidedAtRow = await db.submission.findUnique({
      where: { id: existing.id },
      select: { decidedAt: true },
    });
    const recheck = canResubmit(
      existing.status as SubmissionStatus,
      existing.cycle,
      decidedAtRow?.decidedAt ?? null,
      policy,
    );
    if (!recheck.ok) throw new SubmissionError(recheck.message, recheck.code, 409);
    cycle = existing.cycle + 1;
    await db.submission.update({
      where: { id: existing.id },
      data: { status: "resubmitted", cycle, submittedAt: new Date() },
    });
    submissionId = existing.id;
  }

  await writeParts(submissionId, input, { learnerSummary: summary });

  await db.engagementEvent.create({
    data: {
      userId,
      courseId: bundle.courseId,
      eventType: "submit.sent",
      metadata: { assignmentId, cycle } as unknown as Prisma.InputJsonValue,
    },
  });

  return { submissionId, status: cycle === 1 ? "submitted" : "resubmitted", cycle };
}

export async function resubmitSubmission(
  submissionId: string,
  userId: string,
  input: { learnerSummary?: string; parts?: PartInput[] },
): Promise<{ status: string; cycle: number }> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        select: {
          courseId: true,
          partTypesJson: true,
          resubmissionPolicyJson: true,
        },
      },
    },
  });
  if (!submission || submission.userId !== userId) {
    throw new SubmissionError("Submission not found", "NOT_FOUND", 404);
  }

  const policy = bundlePolicy(submission.assignment.resubmissionPolicyJson);
  const check = canResubmit(
    submission.status as SubmissionStatus,
    submission.cycle,
    submission.decidedAt,
    policy,
  );
  if (!check.ok) throw new SubmissionError(check.message, check.code, 409);

  const required = parsePartTypes(submission.assignment.partTypesJson);
  const validate = validateSubmit(required, input.parts ?? [], input.learnerSummary ?? "");
  if (!validate.ok) throw new SubmissionError(validate.message, validate.code, 400);

  const cycle = submission.cycle + 1;
  await db.submission.update({
    where: { id: submissionId },
    data: {
      status: "resubmitted",
      cycle,
      submittedAt: new Date(),
      learnerSummary: input.learnerSummary ?? submission.learnerSummary,
    },
  });
  await writeParts(submissionId, input, {
    learnerSummary: submission.learnerSummary,
  });

  await db.engagementEvent.create({
    data: {
      userId,
      courseId: submission.assignment.courseId,
      eventType: "submit.sent",
      metadata: { assignmentId: submission.assignmentId, cycle, resubmit: true } as unknown as Prisma.InputJsonValue,
    },
  });

  return { status: "resubmitted", cycle };
}

// ── I3: review queue ─────────────────────────────────────────────────────

export async function reviewQueue(
  instructorId: string,
  query: {
    type?: string;
    status?: SubmissionStatus;
    courseId?: string;
    cursor?: string;
    limit?: number;
  },
): Promise<{ items: ReviewQueueItem[]; nextCursor: string | null }> {
  await ensureDefaultRegistries();
  let courseIds = await enrolledCourseIds(instructorId, "instructor");
  if (query.courseId) courseIds = courseIds.filter((c) => c === query.courseId);
  if (courseIds.length === 0) return { items: [], nextCursor: null };

  const limit = query.limit ?? 20;
  const statuses = query.status
    ? [query.status]
    : ["submitted", "in_review", "resubmitted", "changes_requested"];

  const rows = await db.submission.findMany({
    where: {
      status: { in: statuses },
      assignment: { courseId: { in: courseIds } },
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: limit,
    select: {
      id: true,
      status: true,
      cycle: true,
      score: true,
      submittedAt: true,
      user: { select: { id: true, name: true } },
      assignment: {
        select: {
          id: true,
          title: true,
          partTypesJson: true,
          milestoneLabel: true,
          courseId: true,
          course: { select: { name: true } },
        },
      },
    },
  });

  const items: ReviewQueueItem[] = rows.map((r) => ({
    submissionId: r.id,
    assignmentId: r.assignment.id,
    assignmentTitle: r.assignment.title,
    courseId: r.assignment.courseId,
    courseName: r.assignment.course.name,
    learnerId: r.user.id,
    learnerName: r.user.name,
    status: r.status,
    cycle: r.cycle,
    score: r.score,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    partTypes: parsePartTypes(r.assignment.partTypesJson),
    milestoneLabel: r.assignment.milestoneLabel,
  }));

  // Type filter runs in memory — JSON filtering is unreliable on SQLite and
  // the queue page is small enough that the extra rows are negligible.
  const filtered = query.type
    ? items.filter((i) => i.partTypes.includes(query.type as string))
    : items;

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
  return { items: filtered, nextCursor };
}

// ── I4: review detail + grade/decision/feedback ──────────────────────────

async function loadSubmissionBundle(submissionId: string) {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      user: { select: { id: true, name: true } },
      assignment: {
        include: {
          course: { select: { name: true } },
          rubric: { include: { criteria: { orderBy: { order: "asc" } } } },
        },
      },
      parts: { orderBy: { createdAt: "asc" } },
      thread: { include: { messages: { orderBy: { createdAt: "asc" } } } },
      signOffs: { orderBy: { order: "asc" } },
      grades: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!submission) {
    throw new SubmissionError("Submission not found", "NOT_FOUND", 404);
  }
  return submission;
}

export async function getSubmissionForReview(
  submissionId: string,
  instructorId: string,
) {
  const bundle = await loadSubmissionBundle(submissionId);
  await requireInstructorAccess(instructorId, bundle.assignment.courseId);

  const rubric = bundleRubric(
    bundle.assignment.rubric,
    bundle.assignment.maxScore,
  );

  return {
    submissionId: bundle.id,
    assignment: {
      id: bundle.assignment.id,
      title: bundle.assignment.title,
      instructions: bundle.assignment.instructions,
      courseId: bundle.assignment.courseId,
      courseName: bundle.assignment.course.name,
      maxScore: bundle.assignment.maxScore,
      milestoneLabel: bundle.assignment.milestoneLabel,
    },
    learner: { id: bundle.user.id, name: bundle.user.name },
    status: bundle.status,
    cycle: bundle.cycle,
    score: bundle.score,
    learnerSummary: bundle.learnerSummary,
    submittedAt: bundle.submittedAt?.toISOString() ?? null,
    decidedAt: bundle.decidedAt?.toISOString() ?? null,
    parts: bundle.parts.map(partToView),
    rubric: rubric
      ? {
          id: rubric.id,
          title: rubric.title,
          criteria: rubric.criteria,
        }
      : null,
    policy: bundlePolicy(bundle.assignment.resubmissionPolicyJson),
    thread:
      bundle.thread?.messages.map((m) => ({
        id: m.id,
        authorId: m.authorId,
        authorName: m.authorName,
        authorRole: m.authorRole,
        kind: m.kind,
        body: m.body,
        audioUrl: m.audioUrl,
        partId: m.partId,
        markers: Array.isArray(asRecord({ v: m.markersJson }).v)
          ? (asRecord({ v: m.markersJson }).v as { at: string; note: string }[])
          : null,
        createdAt: m.createdAt.toISOString(),
      })) ?? [],
    signOffs: bundle.signOffs.map((s) => ({
      signerId: s.signerId,
      signerName: s.signerName,
      signerRole: s.signerRole,
      order: s.order,
      decidedAt: s.decidedAt.toISOString(),
    })),
    gradeHistory: bundle.grades.map((g) => ({
      cycle: g.cycle,
      totalScore: g.totalScore,
      createdAt: g.createdAt.toISOString(),
      entries: Array.isArray(asRecord({ v: g.entriesJson }).v)
        ? (asRecord({ v: g.entriesJson }).v as CriterionEntry[])
        : [],
    })),
  };
}

export async function gradeSubmission(
  submissionId: string,
  graderId: string,
  graderRole: string,
  entries: CriterionEntry[],
): Promise<{ totalScore: number; coverage: number; aiDraftCount: number }> {
  const bundle = await loadSubmissionBundle(submissionId);
  await requireInstructorAccess(graderId, bundle.assignment.courseId);

  const rubric = bundleRubric(
    bundle.assignment.rubric,
    bundle.assignment.maxScore,
  );
  if (!rubric) {
    throw new SubmissionError(
      "This assignment has no rubric to grade against",
      "CONFLICT",
      409,
    );
  }
  if (!["submitted", "in_review", "resubmitted"].includes(bundle.status)) {
    throw new SubmissionError(
      "Only active review cycles can be graded",
      "CONFLICT",
      409,
    );
  }

  const result = grade(rubric, entries);

  await db.$transaction([
    db.gradeEntry.create({
      data: {
        submissionId,
        cycle: bundle.cycle,
        graderId,
        graderRole,
        entriesJson: entries as unknown as Prisma.InputJsonValue,
        totalScore: result.totalScore,
      },
    }),
    db.submission.update({
      where: { id: submissionId },
      data: {
        score: result.totalScore,
        status: "in_review",
        reviewedAt: new Date(),
      },
    }),
  ]);

  return {
    totalScore: result.totalScore,
    coverage: result.coverage,
    aiDraftCount: result.aiDraftCount,
  };
}

export async function decideSubmission(
  submissionId: string,
  reviewer: { id: string; name: string; role: string },
  input: DecisionInput,
): Promise<{ status: SubmissionStatus; signOffRecorded: boolean }> {
  const bundle = await loadSubmissionBundle(submissionId);
  await requireInstructorAccess(reviewer.id, bundle.assignment.courseId);

  if (!["in_review", "submitted", "resubmitted"].includes(bundle.status)) {
    throw new SubmissionError(
      "This submission is not in an active review state",
      "CONFLICT",
      409,
    );
  }

  const check = validateDecision(input.decision, input.feedbackText);
  if (!check.ok) throw new SubmissionError(check.message, "VALIDATION", 400);

  const policy = bundlePolicy(bundle.assignment.resubmissionPolicyJson);
  const chain: SignerRef[] = policy.signOffChain ?? [];
  const done: SignOffDone[] = bundle.signOffs.map((s) => ({
    signerId: s.signerId,
    order: s.order,
  }));

  let signOffRecorded = false;
  if (input.decision === "signoff") {
    const signCheck = canSign(chain, done, reviewer.id);
    if (!signCheck.ok) throw new SubmissionError(signCheck.message, "FORBIDDEN", 403);
    const expectedOrder = chain.findIndex((s) => s.signerId === reviewer.id);
    await db.signOff.create({
      data: {
        submissionId,
        signerId: reviewer.id,
        signerName: reviewer.name,
        signerRole: reviewer.role,
        order: expectedOrder >= 0 ? expectedOrder : done.length,
        note: input.note ?? "",
      },
    });
    signOffRecorded = true;
  }

  const nextStatus = resolveDecisionStatus(
    input.decision,
    chain,
    done,
    reviewer.id,
  );

  await db.submission.update({
    where: { id: submissionId },
    data: { status: nextStatus, decidedAt: new Date() },
  });

  // request_changes always carries its feedback into the thread.
  if (input.decision === "request_changes" && input.feedbackText?.trim()) {
    await postFeedbackInternal(
      submissionId,
      {
        authorId: reviewer.id,
        authorName: reviewer.name,
        authorRole: "instructor",
      },
      { body: input.feedbackText },
    );
  }

  // Notify the learner (guilt-free copy).
  const titles: Record<string, string> = {
    changes_requested: "Feedback ready on your submission",
    approved: "Your submission was approved",
    signed_off: "Signed off — milestone complete",
  };
  await db.notification.create({
    data: {
      userId: bundle.userId,
      type: "submission",
      title: titles[nextStatus] ?? "Submission update",
      body:
        input.decision === "request_changes"
          ? "Your reviewer left feedback — open the assignment to see it and resubmit."
          : `"${bundle.assignment.title}" is now ${nextStatus.replace("_", " ")}.`,
      link: `/learner/assignments`,
    },
  });

  return { status: nextStatus, signOffRecorded };
}

async function postFeedbackInternal(
  submissionId: string,
  author: { authorId: string; authorName: string; authorRole: string },
  input: { body: string; kind?: string; audioUrl?: string; partId?: string; markers?: { at: string; note: string }[] },
): Promise<{ messageId: string }> {
  const thread = await db.feedbackThread.upsert({
    where: { submissionId },
    create: { submissionId },
    update: {},
  });
  const message = await db.feedbackMsg.create({
    data: {
      threadId: thread.id,
      authorId: author.authorId,
      authorName: author.authorName,
      authorRole: author.authorRole,
      kind: input.kind ?? "text",
      body: input.body,
      audioUrl: input.audioUrl ?? null,
      partId: input.partId ?? null,
      markersJson: (input.markers ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
    },
  });
  return { messageId: message.id };
}

export async function postFeedback(
  submissionId: string,
  author: { id: string; name: string; role: string },
  input: FeedbackInput,
): Promise<{ messageId: string }> {
  const bundle = await loadSubmissionBundle(submissionId);
  // Reviewers are course instructors (or org admins who also teach) —
  // both must hold an instructor enrollment on the course (IDOR guard).
  const isInstructor = author.role === "instructor" || author.role === "org_admin";
  if (isInstructor) {
    await requireInstructorAccess(author.id, bundle.assignment.courseId);
  } else if (bundle.userId !== author.id) {
    throw new SubmissionError("Not your submission", "IDOR_VIOLATION", 403);
  }

  const result = await postFeedbackInternal(submissionId, {
    authorId: author.id,
    authorName: author.name,
    authorRole: isInstructor ? "instructor" : "learner",
  }, input);

  if (isInstructor) {
    await db.notification.create({
      data: {
        userId: bundle.userId,
        type: "submission",
        title: "New feedback on your submission",
        body: "Your reviewer left a note — open the assignment to read it.",
        link: "/learner/assignments",
      },
    });
  }
  return result;
}

/** Chain state snapshot for UIs (who signed, who is next). */
export function describeChain(
  policy: ResubmissionPolicy,
  done: SignOffDone[],
): { complete: boolean; pending: string[] } {
  const chain: SignerRef[] = policy.signOffChain ?? [];
  return {
    complete: chainComplete(chain, done),
    pending: chain
      .filter((s) => !done.some((d) => d.signerId === s.signerId))
      .map((s) => s.signerName || s.signerId),
  };
}
