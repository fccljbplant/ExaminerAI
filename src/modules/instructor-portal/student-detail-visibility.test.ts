import { describe, expect, it } from "vitest";
import {
  canViewLearnerSupportSignals,
  toDailyLogPayload,
} from "./student-detail-visibility";

describe("instructor student-detail visibility", () => {
  it("limits learner support indicators to instructors", () => {
    expect(canViewLearnerSupportSignals("instructor")).toBe(false);
    expect(canViewLearnerSupportSignals("instructor", true, false)).toBe(false);
    expect(canViewLearnerSupportSignals("instructor", false, true)).toBe(false);
    expect(canViewLearnerSupportSignals("instructor", true, true)).toBe(true);
    expect(canViewLearnerSupportSignals("org_admin", true, true)).toBe(false);
    expect(canViewLearnerSupportSignals("platform_admin", true, true)).toBe(false);
  });

  it("returns attendance dates without confidence for organisation admins", () => {
    const payload = toDailyLogPayload(
      { date: new Date("2026-11-09T10:00:00.000Z"), confidence: 42 },
      false,
    );

    expect(payload).toEqual({ date: "2026-11-09" });
    expect(payload).not.toHaveProperty("confidence");
  });

  it("preserves confidence data for the learner's instructor", () => {
    expect(
      toDailyLogPayload(
        { date: new Date("2026-11-09T10:00:00.000Z"), confidence: 42 },
        true,
      ),
    ).toEqual({ date: "2026-11-09", confidence: 42 });
  });
});
