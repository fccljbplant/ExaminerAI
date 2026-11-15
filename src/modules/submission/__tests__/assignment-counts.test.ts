import { describe, expect, it } from "vitest";
import { bucketAssignmentCounts } from "../lib/submission-db";

/**
 * UI-UX-RULES-2026-11-15 rule 5 (curate, don't shrink): the filter
 * chips show real per-bucket totals. These tests pin the bucketing
 * math that listLearnerAssignmentCounts serves to the L5 list.
 */

describe("bucketAssignmentCounts", () => {
  it("counts not-started and draft assignments as due", () => {
    const counts = bucketAssignmentCounts([null, null, "draft"]);
    expect(counts).toEqual({ all: 3, due: 3, in_review: 0, returned: 0, graded: 0 });
  });

  it("buckets every review-stage status into in_review", () => {
    const counts = bucketAssignmentCounts(["submitted", "in_review", "resubmitted"]);
    expect(counts).toEqual({ all: 3, due: 0, in_review: 3, returned: 0, graded: 0 });
  });

  it("buckets changes_requested into returned and final states into graded", () => {
    const counts = bucketAssignmentCounts(["changes_requested", "approved", "signed_off"]);
    expect(counts).toEqual({ all: 3, due: 0, in_review: 0, returned: 1, graded: 2 });
  });

  it("keeps unknown statuses out of every bucket except all", () => {
    const counts = bucketAssignmentCounts(["something_new"]);
    expect(counts).toEqual({ all: 1, due: 0, in_review: 0, returned: 0, graded: 0 });
  });

  it("returns an all-zero record for an empty list", () => {
    expect(bucketAssignmentCounts([])).toEqual({
      all: 0,
      due: 0,
      in_review: 0,
      returned: 0,
      graded: 0,
    });
  });

  it("matches the FILTER_STATUSES buckets on a mixed workload", () => {
    const counts = bucketAssignmentCounts([
      null, // due
      "draft", // due
      "submitted", // in_review
      "changes_requested", // returned
      "approved", // graded
      "signed_off", // graded
    ]);
    expect(counts).toEqual({ all: 6, due: 2, in_review: 1, returned: 1, graded: 2 });
  });
});
