import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  learnTestFindUnique: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  learnTestUpdate: vi.fn(),
  callAIJson: vi.fn(),
  awardTypedXP: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/db", () => ({
  db: {
    learnWeeklyTest: { findUnique: mocks.learnTestFindUnique, update: mocks.learnTestUpdate },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
  },
}));
vi.mock("@/modules/assessment/lib/ai-json", () => ({ callAIJson: mocks.callAIJson }));
vi.mock("@/modules/learn/lib/xp-ledger", () => ({ awardTypedXP: mocks.awardTypedXP }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mocks.loggerWarn } }));

import { POST } from "./route";

function request() {
  return POST(
    new Request("http://localhost/api/learn/weekly-test/1/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ testId: "test-1", questionIdx: 0, answer: "My answer" }),
    }),
    { params: Promise.resolve({ week: "1" }) },
  );
}

describe("POST /api/learn/weekly-test/[week]/answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.learnTestFindUnique.mockResolvedValue({
      id: "test-1",
      userId: "learner-1",
      courseId: "course-a",
      status: "in_progress",
      questions: [{ question: "Explain the method", format: "open", conceptId: "day-1" }],
      answers: [],
    });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.learnTestUpdate.mockResolvedValue({});
    mocks.awardTypedXP.mockResolvedValue(undefined);
    mocks.loggerWarn.mockImplementation(() => undefined);
  });

  it("denies answer submission after course enrolment has been removed", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);
    const response = await request();
    expect(response.status).toBe(403);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestUpdate).not.toHaveBeenCalled();
  });

  it("does not persist a fallback grade when AI evaluation is unavailable", async () => {
    mocks.callAIJson.mockResolvedValue({ ok: false, error: "provider timeout" });
    const response = await request();
    expect(response.status).toBe(503);
    expect(mocks.learnTestUpdate).not.toHaveBeenCalled();
    expect(mocks.awardTypedXP).not.toHaveBeenCalled();
  });
});
