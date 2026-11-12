import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  courseFindUnique: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  learnTestFindUnique: vi.fn(),
  learnTestCreate: vi.fn(),
  profileFindUnique: vi.fn(),
  getOrCreateProfile: vi.fn(),
  getCourseOutline: vi.fn(),
  topicInOutline: vi.fn(),
  getTopicByWeekDay: vi.fn(),
  getLearnerDifficulty: vi.fn(),
  callAIJson: vi.fn(),
  isFeatureEnabled: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/db", () => ({
  db: {
    course: { findUnique: mocks.courseFindUnique },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    learnDailyTest: { findUnique: mocks.learnTestFindUnique, create: mocks.learnTestCreate },
    learnProfile: { findUnique: mocks.profileFindUnique },
  },
}));
vi.mock("@/modules/learn/lib/learner-profile", () => ({ getOrCreateProfile: mocks.getOrCreateProfile }));
vi.mock("@/modules/learn/lib/course-outline", () => ({
  getCourseOutline: mocks.getCourseOutline,
  topicInOutline: mocks.topicInOutline,
}));
vi.mock("@/modules/learn/lib/today-topic", () => ({ getTopicByWeekDay: mocks.getTopicByWeekDay }));
vi.mock("@/modules/learn/lib/learner-difficulty", () => ({ getLearnerDifficulty: mocks.getLearnerDifficulty }));
vi.mock("@/modules/assessment/lib/ai-json", () => ({ callAIJson: mocks.callAIJson }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: mocks.isFeatureEnabled }));

import { POST } from "./route";

const outline = [{
  week: 1,
  phase: "Foundations",
  days: [
    { day: 1, title: "First completed topic", objective: "Understand the first topic", activity: null, deliverable: null },
    { day: 2, title: "Second completed topic", objective: "Apply the second topic", activity: "Build a small example", deliverable: null },
    { day: 3, title: "Next uncompleted topic", objective: "Continue learning", activity: null, deliverable: null },
  ],
}];

function request(date = "2026-11-12", body: Record<string, unknown> = { courseId: "course-a" }) {
  return POST(
    new Request("http://localhost/api/learn/daily-test/" + date + "/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ date }) },
  );
}

describe("POST /api/learn/daily-test/[date]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.courseFindUnique.mockResolvedValue({ id: "course-a" });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.learnTestFindUnique.mockResolvedValue(null);
    mocks.learnTestCreate.mockResolvedValue({ id: "daily-test-1" });
    mocks.profileFindUnique.mockResolvedValue({
      masteryMap: {
        topicProgress: {
          history: [
            { week: 1, day: 1, completedAt: "2026-11-10T10:00:00.000Z" },
            { week: 1, day: 2, completedAt: "2026-11-11T10:00:00.000Z" },
          ],
        },
      },
    });
    mocks.getOrCreateProfile.mockResolvedValue(undefined);
    mocks.getCourseOutline.mockResolvedValue(outline);
    mocks.topicInOutline.mockImplementation((source, week, day) => (
      source.find((item: typeof outline[number]) => item.week === week)
        ?.days.find((item: typeof outline[number]["days"][number]) => item.day === day) ?? null
    ));
    mocks.getTopicByWeekDay.mockReturnValue(null);
    mocks.getLearnerDifficulty.mockResolvedValue({
      level: 2,
      label: "Core",
      directive: "Use concrete examples.",
    });
    mocks.callAIJson.mockResolvedValue({
      ok: true,
      data: [
        { question: "Q1", format: "open", conceptId: "today", isSpacedRepetition: false },
        { question: "Q2", format: "short", conceptId: "today", isSpacedRepetition: false },
        { question: "Q3", format: "probe", conceptId: "sr", isSpacedRepetition: true },
      ],
    });
  });

  it("does not create or return a test when the global AI feature gate is disabled or unavailable", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);

    const response = await request();

    expect(response.status).toBe(403);
    expect(mocks.courseFindUnique).not.toHaveBeenCalled();
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestCreate).not.toHaveBeenCalled();
  });

  it("rejects an impossible calendar date", async () => {
    const response = await request("2026-02-31");
    expect(response.status).toBe(400);
    expect(mocks.courseFindUnique).not.toHaveBeenCalled();
  });

  it("requires a course enrolment before exposing a test", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await request();

    expect(response.status).toBe(403);
    expect(mocks.getOrCreateProfile).not.toHaveBeenCalled();
    expect(mocks.learnTestFindUnique).not.toHaveBeenCalled();
  });

  it("returns an existing same-day test idempotently before checking new study history", async () => {
    mocks.learnTestFindUnique.mockResolvedValue({
      id: "existing-test",
      questions: [{ question: "Existing", format: "open", conceptId: "today", isSpacedRepetition: false }],
      answers: [],
      status: "in_progress",
    });
    mocks.profileFindUnique.mockResolvedValue(null);

    const response = await request();

    expect(response.status).toBe(200);
    expect(mocks.getCourseOutline).not.toHaveBeenCalled();
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestCreate).not.toHaveBeenCalled();
  });

  it("returns a tested-topic label from validated completed-test evidence", async () => {
    mocks.learnTestFindUnique.mockResolvedValue({
      id: "completed-test",
      questions: [{
        question: "Existing",
        format: "open",
        conceptId: "today",
        isSpacedRepetition: false,
        topicWeek: 1,
        topicDay: 2,
        topicTitle: "Second completed topic",
      }],
      answers: [{
        answer: "A valid answer",
        evaluation: "correct",
        score: 1,
        feedback: "Good work.",
      }],
      status: "completed",
    });

    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.studyTopicLabel).toBe("Week 1 · Day 2 — Second completed topic");
  });

  it("does not return a completed test with missing answer evidence as a successful zero", async () => {
    mocks.learnTestFindUnique.mockResolvedValue({
      id: "completed-test",
      questions: [{ question: "Existing", format: "open", conceptId: "today", isSpacedRepetition: false }],
      answers: [],
      status: "completed",
    });

    const response = await request();

    expect(response.status).toBe(503);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
  });

  it("requires at least one completed study topic before starting a daily test", async () => {
    mocks.profileFindUnique.mockResolvedValue({ masteryMap: { topicProgress: { history: [] } } });

    const response = await request();

    expect(response.status).toBe(409);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestCreate).not.toHaveBeenCalled();
  });

  it("generates questions for the most recently completed topic, not the next uncompleted topic", async () => {
    const response = await request();

    expect(response.status).toBe(200);
    expect(mocks.callAIJson).toHaveBeenCalledOnce();
    const messages = mocks.callAIJson.mock.calls[0][0];
    expect(messages[1].content).toContain("Week 1 Day 2: Second completed topic");
    expect(messages[1].content).not.toContain("Next uncompleted topic");
    expect(mocks.learnTestCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "learner-1",
        courseId: "course-a",
        date: new Date("2026-11-12T00:00:00.000Z"),
      }),
    }));
    const body = await response.json();
    expect(body.data.questions[0]).toMatchObject({ topicWeek: 1, topicDay: 2 });
  });

  it("returns unavailable when custom outline retrieval fails rather than switching curricula", async () => {
    mocks.getCourseOutline.mockRejectedValue(new Error("database unavailable"));

    const response = await request();

    expect(response.status).toBe(503);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestCreate).not.toHaveBeenCalled();
  });

  it("marks fallback-generated questions so the UI can disclose degraded question generation", async () => {
    mocks.callAIJson.mockResolvedValue({ ok: false, error: "provider unavailable" });

    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.aiFallback).toBe(true);
    expect(body.data.questions.every((question: { generationFallback?: boolean }) => question.generationFallback)).toBe(true);
  });

  it("does not substitute the shared legacy curriculum for a missing custom-outline topic", async () => {
    mocks.topicInOutline.mockReturnValue(null);

    const response = await request();

    expect(response.status).toBe(503);
    expect(mocks.getTopicByWeekDay).not.toHaveBeenCalled();
    expect(mocks.callAIJson).not.toHaveBeenCalled();
  });
});
