import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  courseFindUnique: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  learnTestFindUnique: vi.fn(),
  learnTestCreate: vi.fn(),
  getOrCreateProfile: vi.fn(),
  getCourseOutline: vi.fn(),
  learnerReachedTopic: vi.fn(),
  getLearnerDifficulty: vi.fn(),
  callAIJson: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/db", () => ({
  db: {
    course: { findUnique: mocks.courseFindUnique },
    courseEnrollment: { findFirst: mocks.enrollmentFindFirst },
    learnWeeklyTest: { findUnique: mocks.learnTestFindUnique, create: mocks.learnTestCreate },
  },
}));
vi.mock("@/modules/learn/lib/learner-profile", () => ({ getOrCreateProfile: mocks.getOrCreateProfile }));
vi.mock("@/modules/learn/lib/course-outline", () => ({ getCourseOutline: mocks.getCourseOutline }));
vi.mock("@/modules/learn/lib/today-topic", () => ({ learnerReachedTopic: mocks.learnerReachedTopic }));
vi.mock("@/modules/learn/lib/learner-difficulty", () => ({ getLearnerDifficulty: mocks.getLearnerDifficulty }));
vi.mock("@/modules/assessment/lib/ai-json", () => ({ callAIJson: mocks.callAIJson }));

import { POST } from "./route";

function request(body: Record<string, unknown>, week = "1") {
  return POST(
    new Request(`http://localhost/api/learn/weekly-test/${week}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ week }) },
  );
}

describe("POST /api/learn/weekly-test/[week]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.courseFindUnique.mockResolvedValue({ id: "course-a" });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1" });
    mocks.learnTestFindUnique.mockResolvedValue(null);
    mocks.learnTestCreate.mockResolvedValue({ id: "test-1" });
    mocks.getOrCreateProfile.mockResolvedValue({});
    mocks.getCourseOutline.mockResolvedValue([{
      week: 1,
      days: [{ day: 1, title: "Course A day 1", objective: "Apply the course method" }],
    }]);
    mocks.learnerReachedTopic.mockResolvedValue(true);
    mocks.getLearnerDifficulty.mockResolvedValue({ level: 2, label: "Developing", directive: "Use guided questions" });
    mocks.callAIJson.mockResolvedValue({
      ok: true,
      data: [{ question: "How would you apply the method?", format: "open", conceptId: "day-1" }],
    });
  });

  it("requires the learner to be enrolled in the selected course", async () => {
    mocks.enrollmentFindFirst.mockResolvedValue(null);
    const response = await request({ courseId: "course-a" });
    expect(response.status).toBe(403);
    expect(mocks.getOrCreateProfile).not.toHaveBeenCalled();
    expect(mocks.callAIJson).not.toHaveBeenCalled();
  });

  it("does not substitute generic topics for a missing week in a published course outline", async () => {
    mocks.getCourseOutline.mockResolvedValue([{
      week: 1,
      days: [{ day: 1, title: "Course A day 1", objective: "Apply the course method" }],
    }]);
    const response = await request({ courseId: "course-a" }, "2");
    expect(response.status).toBe(409);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestCreate).not.toHaveBeenCalled();
  });

  it("enforces the last content day before returning an existing in-progress test", async () => {
    mocks.getCourseOutline.mockResolvedValue([{
      week: 1,
      days: [
        { day: 1, title: "Day 1", objective: "Objective 1" },
        { day: 2, title: "Day 2", objective: "Objective 2" },
        { day: 3, title: "Day 3", objective: "Objective 3" },
      ],
    }]);
    mocks.learnerReachedTopic.mockResolvedValue(false);
    mocks.learnTestFindUnique.mockResolvedValue({
      id: "existing-test",
      questions: [{ question: "Already stored", format: "open", conceptId: "day-1" }],
      status: "in_progress",
      answers: [],
    });

    const response = await request({ courseId: "course-a" });

    expect(response.status).toBe(409);
    expect(mocks.learnerReachedTopic).toHaveBeenCalledWith("learner-1", "course-a", 1, 3);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestCreate).not.toHaveBeenCalled();
  });

  it("returns unavailable rather than using the legacy ladder when outline lookup fails", async () => {
    mocks.getCourseOutline.mockRejectedValue(new Error("database unavailable"));

    const response = await request({ courseId: "course-a" });

    expect(response.status).toBe(503);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestCreate).not.toHaveBeenCalled();
  });

  it("preserves the legacy topic ladder for courses without a published outline", async () => {
    mocks.getCourseOutline.mockResolvedValue(null);

    const response = await request({ courseId: "course-a" });

    expect(response.status).toBe(200);
    expect(mocks.callAIJson).toHaveBeenCalledOnce();
    expect(mocks.learnTestCreate).toHaveBeenCalledOnce();
  });

  it("creates a weekly test only from the selected course outline", async () => {
    const response = await request({ courseId: "course-a" });
    expect(response.status).toBe(200);
    expect(mocks.enrollmentFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-a", role: "student" },
      select: { id: true },
    });
    expect(mocks.learnTestCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "learner-1", courseId: "course-a", week: 1 }),
    }));
  });
});
