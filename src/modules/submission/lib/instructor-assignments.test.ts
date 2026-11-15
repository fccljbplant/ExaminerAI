import { describe, expect, it } from "vitest";

import {
  assignmentStatusChip,
  mapCanonicalAssignmentRow,
  mapGroupTaskRow,
  mergeInstructorAssignments,
  type CanonicalAssignmentInput,
  type LegacyGroupTaskInput,
} from "./instructor-assignments";

/**
 * Assignment/GroupTask reconciliation (COMBINED-AUDIT fixation 2).
 * These tests pin the VERIFIED mapping: every output field traces to a
 * source column, statuses normalize to the Assignment vocabulary, and
 * the merge is deterministic.
 */

const canonicalRow = (over: Partial<CanonicalAssignmentInput> = {}): CanonicalAssignmentInput => ({
  id: "a1",
  courseId: "c1",
  title: "Build a dashboard",
  description: "Wire the KPI cards",
  dueDate: "2026-11-20T00:00:00.000Z",
  week: 3,
  maxScore: 50,
  status: "published",
  submissionCount: 4,
  ...over,
});

const legacyRow = (over: Partial<LegacyGroupTaskInput> = {}): LegacyGroupTaskInput => ({
  id: "g1",
  courseId: "c1",
  title: "Old reading task",
  description: null,
  type: "reading",
  dueDate: null,
  week: null,
  maxScore: null,
  status: "open",
  submissionCount: 0,
  ...over,
});

describe("mapCanonicalAssignmentRow", () => {
  it("maps a canonical Assignment 1:1 with legacy: false", () => {
    const row = mapCanonicalAssignmentRow(canonicalRow());
    expect(row).toEqual({
      id: "a1",
      courseId: "c1",
      title: "Build a dashboard",
      description: "Wire the KPI cards",
      dueDate: "2026-11-20T00:00:00.000Z",
      week: 3,
      maxScore: 50,
      status: "published",
      submissionCount: 4,
      legacy: false,
      legacyType: null,
    });
  });

  it("normalizes Date objects and null defaults", () => {
    const row = mapCanonicalAssignmentRow(
      canonicalRow({ dueDate: new Date("2026-12-01T12:00:00.000Z"), description: null, maxScore: null }),
    );
    expect(row.dueDate).toBe("2026-12-01T12:00:00.000Z");
    expect(row.description).toBe("");
    expect(row.maxScore).toBe(100);
  });

  it("keeps archived canonical rows archived", () => {
    expect(mapCanonicalAssignmentRow(canonicalRow({ status: "archived" })).status).toBe("archived");
  });
});

describe("mapGroupTaskRow — the verified legacy mapping", () => {
  it("maps every shared column and flags provenance", () => {
    const row = mapGroupTaskRow(legacyRow());
    expect(row).toEqual({
      id: "g1",
      courseId: "c1",
      title: "Old reading task",
      description: "",
      dueDate: null,
      week: null,
      maxScore: 100,
      status: "published",
      submissionCount: 0,
      legacy: true,
      legacyType: "reading",
    });
  });

  it("normalizes the GroupTask status vocabulary", () => {
    expect(mapGroupTaskRow(legacyRow({ status: "open" })).status).toBe("published");
    expect(mapGroupTaskRow(legacyRow({ status: "closed" })).status).toBe("archived");
  });

  it("normalizes Date due dates exactly like canonical rows", () => {
    expect(mapGroupTaskRow(legacyRow({ dueDate: new Date("2026-11-25T00:00:00.000Z") })).dueDate).toBe(
      "2026-11-25T00:00:00.000Z",
    );
  });
});

describe("mergeInstructorAssignments", () => {
  it("interleaves by due date ascending with undated rows last", () => {
    const merged = mergeInstructorAssignments(
      [
        mapCanonicalAssignmentRow(canonicalRow({ id: "late", title: "Late", dueDate: "2026-12-01T00:00:00.000Z" })),
        mapCanonicalAssignmentRow(canonicalRow({ id: "early", title: "Early", dueDate: "2026-11-01T00:00:00.000Z" })),
      ],
      [mapGroupTaskRow(legacyRow()), mapGroupTaskRow(legacyRow({ id: "g2", title: "Mid", dueDate: "2026-11-15T00:00:00.000Z" }))],
    );
    expect(merged.map((r) => r.id)).toEqual(["early", "g2", "late", "g1"]);
  });

  it("breaks date ties by title for a deterministic order", () => {
    const merged = mergeInstructorAssignments(
      [mapCanonicalAssignmentRow(canonicalRow({ title: "B task", dueDate: null }))],
      [mapGroupTaskRow(legacyRow({ title: "A task", dueDate: null }))],
    );
    expect(merged.map((r) => r.title)).toEqual(["A task", "B task"]);
  });

  it("never invents or drops provenance while merging", () => {
    const merged = mergeInstructorAssignments(
      [mapCanonicalAssignmentRow(canonicalRow())],
      [mapGroupTaskRow(legacyRow())],
    );
    expect(merged.find((r) => r.id === "a1")?.legacy).toBe(false);
    expect(merged.find((r) => r.id === "g1")?.legacy).toBe(true);
  });
});

describe("assignmentStatusChip — one vocabulary in the UI", () => {
  it("labels canonical rows by lifecycle state", () => {
    expect(assignmentStatusChip(mapCanonicalAssignmentRow(canonicalRow()))).toEqual({
      label: "Published",
      tone: "active",
    });
    expect(assignmentStatusChip(mapCanonicalAssignmentRow(canonicalRow({ status: "archived" })))).toEqual({
      label: "Archived",
      tone: "muted",
    });
  });

  it("labels legacy rows with their provenance", () => {
    expect(assignmentStatusChip(mapGroupTaskRow(legacyRow()))).toEqual({ label: "Legacy", tone: "muted" });
    expect(assignmentStatusChip(mapGroupTaskRow(legacyRow({ status: "closed" })))).toEqual({
      label: "Legacy · closed",
      tone: "muted",
    });
  });
});
