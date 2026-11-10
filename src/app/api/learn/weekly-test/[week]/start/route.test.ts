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

function request(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/learn/weekly-test/1/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ week: "1" }) },
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
      days: [{ title: "Course A day 1", objective: "Apply the course method" }],
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

  it("does not fall back to shared topics when the selected course week has no outline", async () => {
    mocks.getCourseOutline.mockResolvedValue(null);
    const response = await request({ courseId: "course-a" });
    expect(response.status).toBe(409);
    expect(mocks.callAIJson).not.toHaveBeenCalled();
    expect(mocks.learnTestCreate).not.toHaveBeenCalled();
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
