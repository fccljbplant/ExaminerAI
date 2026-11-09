import { describe, expect, it } from "vitest";
import { canExposeLearnerBehavioralAnalysis } from "./final-result-visibility";

describe("final-result behavioural analysis visibility", () => {
  it("allows a learner to view their own analysis", () => {
    expect(canExposeLearnerBehavioralAnalysis("learner-1", "learner-1")).toBe(true);
  });

  it("hides individual behavioural analysis from every staff viewer", () => {
    expect(canExposeLearnerBehavioralAnalysis("instructor-1", "learner-1")).toBe(false);
    expect(canExposeLearnerBehavioralAnalysis("org-admin-1", "learner-1")).toBe(false);
    expect(canExposeLearnerBehavioralAnalysis("platform-admin-1", "learner-1")).toBe(false);
  });
});
