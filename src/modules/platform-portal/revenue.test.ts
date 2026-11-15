import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Platform revenue — 44px guard (rule 12).
 *
 * The coupon form inputs and the per-payment Refund button were the
 * last interactive controls in the twelve-rules scope still at 36px
 * (h-9/min-h-9). Icon tiles and skeletons elsewhere in this file use
 * h-9 w-9 spans, which are not interactive — so this file now contains
 * no h-9 at all; keep it that way for interactive controls. Focus rings
 * are enforced repo-wide by the focus-visibility source guard.
 */

const source = readFileSync(new URL("./revenue.tsx", import.meta.url), "utf8");

describe("Revenue controls are 44px targets (rule 12)", () => {
  it("contains no 36px (h-9/min-h-9) sizing — controls are h-11", () => {
    expect(source).not.toMatch(/\bmin-h-9\b/);
    expect(source).not.toMatch(/\bh-9(?!-)/); // h-9 exactly, not h-9x suffixes
  });

  it("carries the 44px classes on the coupon form and refund action", () => {
    const hits = source.match(/\bh-11\b|\bmin-h-11\b/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(5);
  });
});
