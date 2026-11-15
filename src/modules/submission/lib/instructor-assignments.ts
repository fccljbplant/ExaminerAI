/**
 * modules/submission/lib/instructor-assignments.ts — Assignment/GroupTask
 * reconciliation (COMBINED-AUDIT §"Integrated bottom-up fixation order" 2)
 *
 * The instructor assignments UI used to create `GroupTask` records while
 * the learner surface and L5/L6 APIs read `Assignment` + `Submission` —
 * two parallel assignment stores with no end-to-end flow. Decision
 * (recorded in the audit): `Assignment` + `Submission` is the canonical
 * path; new instructor writes go there, and legacy `GroupTask` rows are
 * reconciled through this verified READ-TIME mapping — no parallel
 * writes, no backfill, no schema change, nothing dropped.
 *
 * Pure module: no db import (submission-db.ts stays the only one).
 * Every output field maps 1:1 from a source column; the `legacy` flag is
 * the provenance label the UI badges rows with.
 */

export interface CanonicalAssignmentInput {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  dueDate: Date | string | null;
  week: number | null;
  maxScore: number | null;
  status: string;
  submissionCount: number;
}

export interface LegacyGroupTaskInput {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: string | null;
  dueDate: Date | string | null;
  week: number | null;
  maxScore: number | null;
  status: string;
  submissionCount: number;
}

/** One list row regardless of which store it came from. */
export interface ReconciledAssignmentRow {
  id: string;
  courseId: string;
  title: string;
  description: string;
  /** ISO date or null — `Date` inputs are normalized so rows from the
   *  DB (Date) and from JSON APIs (string) compare and render the same. */
  dueDate: string | null;
  week: number | null;
  maxScore: number;
  /** Normalized to the Assignment vocabulary: published | archived. */
  status: "published" | "archived";
  submissionCount: number;
  /** false → canonical Assignment (full lifecycle). true → legacy
   *  GroupTask surfaced through this mapping; its v1 close/delete
   *  actions still work, but it is not part of the v2 submission
   *  flow until an owner-approved backfill. */
  legacy: boolean;
  /** GroupTask.type, kept for display provenance on legacy rows. */
  legacyType: string | null;
}

function iso(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeStatus(status: string): "published" | "archived" {
  // GroupTask used open|closed; Assignment uses draft|published|archived.
  // draft rows never reach the instructor list, so the mapping is total.
  return status === "closed" || status === "archived" ? "archived" : "published";
}

/** Canonical Assignment row → ReconciledAssignmentRow (legacy: false). */
export function mapCanonicalAssignmentRow(row: CanonicalAssignmentInput): ReconciledAssignmentRow {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    description: row.description ?? "",
    dueDate: iso(row.dueDate),
    week: row.week ?? null,
    maxScore: row.maxScore ?? 100,
    status: normalizeStatus(row.status),
    submissionCount: row.submissionCount ?? 0,
    legacy: false,
    legacyType: null,
  };
}

/**
 * Verified GroupTask → row mapping (legacy: true). Field-for-field:
 * title/description/dueDate/week/maxScore/courseId are shared columns;
 * status open|closed → published|archived; `type` is carried as
 * legacyType; submissionCount comes from the counted relation. Nothing
 * is invented and nothing is silently dropped.
 */
export function mapGroupTaskRow(task: LegacyGroupTaskInput): ReconciledAssignmentRow {
  return {
    id: task.id,
    courseId: task.courseId,
    title: task.title,
    description: task.description ?? "",
    dueDate: iso(task.dueDate),
    week: task.week ?? null,
    maxScore: task.maxScore ?? 100,
    status: normalizeStatus(task.status),
    submissionCount: task.submissionCount ?? 0,
    legacy: true,
    legacyType: task.type ?? null,
  };
}

/**
 * One deterministic list: dueDate ascending with undated last, then
 * title. Canonical rows and legacy rows interleave by date; the UI
 * badges legacy rows so instructors always know the provenance.
 */
export function mergeInstructorAssignments(
  canonical: ReconciledAssignmentRow[],
  legacy: ReconciledAssignmentRow[],
): ReconciledAssignmentRow[] {
  return [...canonical, ...legacy].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
}

/** Status chip label + tone for a reconciled row (one vocabulary in the UI). */
export function assignmentStatusChip(row: ReconciledAssignmentRow): { label: string; tone: "active" | "muted" } {
  if (row.legacy) {
    return row.status === "archived"
      ? { label: "Legacy · closed", tone: "muted" }
      : { label: "Legacy", tone: "muted" };
  }
  return row.status === "archived"
    ? { label: "Archived", tone: "muted" }
    : { label: "Published", tone: "active" };
}
