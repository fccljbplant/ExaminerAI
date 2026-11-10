import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  enrollmentFindMany: vi.fn(),
  courseFindFirst: vi.fn(),
  weeklyTestFindFirst: vi.fn(),
  getCourseDurationWeeks: vi.fn(),
  getCourseWeekTopicTitles: vi.fn(),
  getCourseWeekPhase: vi.fn(),
  getTestConfig: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/db", () => ({
  db: {
    courseEnrollment: { findMany: mocks.enrollmentFindMany },
    course: { findFirst: mocks.courseFindFirst },
    weeklyTest: { findFirst: mocks.weeklyTestFindFirst },
  },
}));
vi.mock("@/lib/course-db", () => ({
  getCourseDurationWeeks: mocks.getCourseDurationWeeks,
  getCourseWeekTopicTitles: mocks.getCourseWeekTopicTitles,
  getCourseWeekPhase: mocks.getCourseWeekPhase,
  getCourseMetadata: vi.fn(),
}));
vi.mock("@/lib/course-config", () => ({
  getTestConfig: mocks.getTestConfig,
  getAIPrompts: vi.fn(),
}));

import { GET } from "./route";

function request(query = "") {
  return GET(new NextRequest(`http://localhost/api/ai/weekly-test${query}`));
}

describe("GET /api/ai/weekly-test course identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "learner-1", currentWeek: 1 });
    mocks.enrollmentFindMany.mockResolvedValue([{ courseId: "course-a" }, { courseId: "course-b" }]);
    mocks.courseFindFirst.mockResolvedValue({ id: "course-b" });
    mocks.getCourseDurationWeeks.mockResolvedValue(3);
    mocks.getCourseWeekTopicTitles.mockResolvedValue(["Course B topic"]);
    mocks.getCourseWeekPhase.mockResolvedValue("Course B phase");
    mocks.getTestConfig.mockResolvedValue({ totalQuestions: 10, maxRepliesPerQuestion: 3 });
    mocks.weeklyTestFindFirst.mockResolvedValue({
      id: "attempt-2",
      week: 2,
      attempt: 2,
      status: "completed",
      score: 86,
      currentQuestion: 10,
      replyCount: 1,
      completedAt: new Date("2026-11-10T10:00:00.000Z"),
      retakeAllowed: false,
      plagiarismScore: 0,
      conversation: "[]",
      weaknesses: "[]",
    });
  });

  it("requires explicit course selection when a learner has multiple courses", async () => {
    const response = await request("?week=2");
    expect(response.status).toBe(400);
    expect(mocks.weeklyTestFindFirst).not.toHaveBeenCalled();
  });

  it("reads only the selected course and latest attempt for the requested week", async () => {
    const response = await request("?courseId=course-b&week=2");
    expect(response.status).toBe(200);
    expect(mocks.weeklyTestFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-b", week: 2 },
      orderBy: { attempt: "desc" },
    });
    expect(mocks.getCourseWeekTopicTitles).toHaveBeenCalledWith("learner-1", 2, "course-b");
    expect(mocks.getCourseWeekPhase).toHaveBeenCalledWith("learner-1", 2, "course-b");
    const body = await response.json();
    expect(body.test.attempt).toBe(2);
    expect(body.weekTopics).toEqual(["Course B topic"]);
  });

  it("rejects a course the learner is not enrolled in", async () => {
    const response = await request("?courseId=course-outside&week=2");
    expect(response.status).toBe(403);
    expect(mocks.courseFindFirst).not.toHaveBeenCalled();
    expect(mocks.weeklyTestFindFirst).not.toHaveBeenCalled();
  });
});
