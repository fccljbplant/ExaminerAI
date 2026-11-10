import { describe, expect, it } from "vitest";
import {
  buildCourseReportCard,
  parseCourseReportCardPolicy,
  type CourseReportCardGradingPolicy,
} from "./report-card";

const policy: CourseReportCardGradingPolicy = {
  gradingScale: [
    { grade: "A", min: 90, max: 100 },
    { grade: "B", min: 80, max: 89 },
    { grade: "C", min: 70, max: 79 },
    { grade: "D", min: 60, max: 69 },
    { grade: "F", min: 0, max: 59 },
  ],
  weights: { weeklyTest: 80, practice: 20 },
};

describe("course report-card calculation", () => {
  it("does not fabricate a zero or F grade when evidence is missing", () => {
    const result = buildCourseReportCard(
      { tasks: [], practiceScores: [], weeklyTests: [], dailyCheckinCount: 0 },
      policy,
    );
    expect(result.hasEvidence).toBe(false);
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.progress).toContain("Overall: unavailable");
  });

  it("preserves a genuine zero when a completed assessment scored zero", () => {
    const result = buildCourseReportCard(
      { tasks: [], practiceScores: [], weeklyTests: [{ attempt: 1, status: "completed", score: 0 }], dailyCheckinCount: 0 },
      policy,
    );
    expect(result.score).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.weeklyTestScore).toBe(0);
  });

  it("keeps results ungraded when the selected course has no grading policy", () => {
    const result = buildCourseReportCard(
      { tasks: [], practiceScores: [90], weeklyTests: [], dailyCheckinCount: 0 },
      null,
    );
    expect(result.hasEvidence).toBe(true);
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.nextSteps.join(" ")).toContain("course grading policy");
  });

  it("uses only selected-course evidence supplied to the calculation", () => {
    const result = buildCourseReportCard(
      { tasks: [{ status: "completed" }, { status: "planned" }], practiceScores: [80], weeklyTests: [], dailyCheckinCount: 2 },
      policy,
    );
    expect(result.taskCompletionRate).toBe(50);
    expect(result.practiceAverage).toBe(80);
    expect(result.score).toBe(80);
    expect(result.grade).toBe("B");
  });

  it("normalises weights when only one weighted evidence source is available", () => {
    const result = buildCourseReportCard(
      { tasks: [], practiceScores: [72], weeklyTests: [], dailyCheckinCount: 0 },
      policy,
    );
    expect(result.score).toBe(72);
    expect(result.grade).toBe("C");
  });

  it("selects the highest, latest or first completed retake according to course policy", () => {
    const evidence = {
      tasks: [],
      practiceScores: [],
      weeklyTests: [
        { attempt: 1, status: "completed", score: 65 },
        { attempt: 2, status: "completed", score: 92 },
        { attempt: 3, status: "completed", score: 78 },
      ],
      dailyCheckinCount: 0,
    };
    expect(buildCourseReportCard(evidence, policy, "best").selectedAttempt).toBe(2);
    expect(buildCourseReportCard(evidence, policy, "latest").selectedAttempt).toBe(3);
    expect(buildCourseReportCard(evidence, policy, "first").selectedAttempt).toBe(1);
  });

  it("treats zero task completion as a genuine result only when tasks exist", () => {
    const result = buildCourseReportCard(
      { tasks: [{ status: "planned" }, { status: "blocked" }], practiceScores: [], weeklyTests: [], dailyCheckinCount: 0 },
      policy,
    );
    expect(result.taskCompletionRate).toBe(0);
    expect(result.progress).toContain("0/2 (0%)");
    expect(result.score).toBeNull();
  });

  it("rejects malformed grading policies instead of silently using a global scale", () => {
    expect(parseCourseReportCardPolicy(null)).toBeNull();
    expect(parseCourseReportCardPolicy("{broken")).toBeNull();
    expect(parseCourseReportCardPolicy(JSON.stringify({ gradingScale: [], weights: { weeklyTest: 80, practice: 20 } }))).toBeNull();
  });
});
