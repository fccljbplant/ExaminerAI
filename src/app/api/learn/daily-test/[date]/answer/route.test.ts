import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  testFindUnique: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  txTestFindUnique: vi.fn(),
  txTestUpdateMany: vi.fn(),
  transaction: vi.fn(),
  callAIJson: vi.fn(),
  awardTypedXPWithClient: vi.fn(),
  isFeatureEnabled: vi.fn(),
}));

const tx = {
  learnDailyTest: {
    findUnique: mocks.txTestFindUnique,
    updateMany: mocks.txTestUpdateMany,
  },
  xPLedger: {},
  learnProfile: {},
};

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/db", () => ({
  db: {
    learnDailyTest: { findUnique: mocks.testFindUnique },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/modules/assessment/lib/ai-json", () => ({ callAIJson: mocks.callAIJson }));
vi.mock("@/modules/learn/lib/xp-ledger", () => ({
  awardTypedXPWithClient: mocks.awardTypedXPWithClient,
}));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: mocks.isFeatureEnabled }));

import { POST } from "./route";

const date = "2026-11-12";
const questions = [
  { question: "Question one", format: "open", conceptId: "today", topicTitle: "Study topic one" },
  { question: "Question two", format: "short", conceptId: "today", topicTitle: "Study topic one" },
  { question: "Question three", format: "probe", conceptId: "sr", topicTitle: "Earlier topic" },
];

function request(
  questionIdx = 0,
  bodyOverrides: Record<string, unknown> = {},
  routeDate = date,
) {
  return POST(
    new Request("http://localhost/api/learn/daily-test/" + routeDate + "/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        testId: "daily-test-1",
        questionIdx,
        answer: "A considered answer",
        ...bodyOverrides,
      }),
    }),
    { params: Promise.resolve({ date: routeDate }) },
  );
}

function testRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "daily-test-1",
    userId: "learner-1",
    courseId: "course-a",
    date: new Date("2026-11-12T00:00:00.000Z"),
    status: "in_progress",
    questions,
    answers: null,
    ...overrides,
  };
}

describe("POST /api/learn/daily-test/[date]/answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.testFindUnique.mockResolvedValue(testRecord());
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.txTestFindUnique.mockResolvedValue(testRecord());
    mocks.txTestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    mocks.callAIJson.mockResolvedValue({
      ok: true,
      data: { evaluation: "correct", feedback: "Good explanation. Apply this approach in the next example.", score: 1 },
    });
    mocks.awardTypedXPWithClient.mockResolvedValue(30);
  });

  it("does not call external AI when the global AI feature gate is disabled or unavailable", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);

    const response = await request();

    expect(response.status).toBe(403);
    expect(mocks.testFindUnique).not.toHaveBeenCalled();
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid calendar dates before reading the test", async () => {
    const response = await request(0, {}, "2026-02-31");
    expect(response.status).toBe(400);
    expect(mocks.testFindUnique).not.toHaveBeenCalled();
  });

  it("requires an integer question index", async () => {
    const response = await request(0.5);
    expect(response.status).toBe(400);
    expect(mocks.testFindUnique).not.toHaveBeenCalled();
  });

  it("denies an answer when the route date does not match the stored test date", async () => {
    const response = await request(0, {}, "2026-11-11");
    expect(response.status).toBe(403);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
  });

  it("denies a test owned by a different learner", async () => {
    mocks.testFindUnique.mockResolvedValue(testRecord({ userId: "another-learner" }));

    const response = await request();

    expect(response.status).toBe(403);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
  });

  it("requires current course enrolment before evaluating the answer", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await request();

    expect(response.status).toBe(403);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
  });

  it("rejects skipped or previously answered questions before AI evaluation", async () => {
    mocks.testFindUnique.mockResolvedValue(testRecord({
      answers: [{
        answer: "Saved answer",
        evaluation: "correct",
        score: 1,
        feedback: "Saved feedback",
      }, null, null],
    }));

    const response = await request(0);

    expect(response.status).toBe(409);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not save or grade a fallback score when AI evaluation fails", async () => {
    mocks.callAIJson.mockResolvedValue({ ok: false, error: "provider unavailable" });

    const response = await request();

    expect(response.status).toBe(503);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.awardTypedXPWithClient).not.toHaveBeenCalled();
  });

  it("saves one in-sequence answer without awarding completion XP early", async () => {
    const response = await request(0);

    expect(response.status).toBe(200);
    const updateCall = mocks.txTestUpdateMany.mock.calls[0][0];
    expect(updateCall.where).toMatchObject({ id: "daily-test-1", userId: "learner-1", status: "in_progress" });
    expect(updateCall.data).toHaveProperty("answers");
    expect(updateCall.data).not.toHaveProperty("status");
    expect(mocks.awardTypedXPWithClient).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.data.isComplete).toBe(false);
  });

  it("commits the final answer, completion and XP in one transaction without inventing an integer aggregate", async () => {
    mocks.testFindUnique.mockResolvedValue(testRecord({ questions: [questions[0]] }));
    mocks.txTestFindUnique.mockResolvedValue(testRecord({ questions: [questions[0]] }));
    mocks.callAIJson.mockResolvedValue({
      ok: true,
      data: { evaluation: "partial", feedback: "You have the right idea. Add the missing condition.", score: 0.5 },
    });

    const response = await request(0);

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.txTestUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "completed",
        score: null,
        xpAwarded: 30,
      }),
    }));
    expect(mocks.awardTypedXPWithClient).toHaveBeenCalledWith(
      tx,
      "learner-1",
      "daily_test_done",
      "course-a",
      "daily-test:daily-test-1",
    );
    const body = await response.json();
    expect(body.data.finalScore).toBe(0.5);
    expect(body.data.aggregateScoreAvailable).toBe(false);
  });

  it("rejects a compare-and-swap race without awarding XP", async () => {
    mocks.txTestUpdateMany.mockResolvedValue({ count: 0 });

    const response = await request();

    expect(response.status).toBe(409);
    expect(mocks.awardTypedXPWithClient).not.toHaveBeenCalled();
  });

  it("returns unavailable for malformed persisted answers instead of treating them as empty", async () => {
    mocks.testFindUnique.mockResolvedValue(testRecord({ answers: { corrupt: true } }));

    const response = await request();

    expect(response.status).toBe(503);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
