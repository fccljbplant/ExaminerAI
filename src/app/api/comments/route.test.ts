import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  getStaffAuthorizedStudentCourseIds: vi.fn(),
  courseEnrollmentFindFirst: vi.fn(),
  interactionFindMany: vi.fn(),
  projectTaskFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  dailyLogFindMany: vi.fn(),
  commentFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));
vi.mock("@/lib/db", () => ({
  db: {
    courseEnrollment: { findFirst: mocks.courseEnrollmentFindFirst },
    interaction: { findMany: mocks.interactionFindMany },
    projectTask: { findMany: mocks.projectTaskFindMany },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
    dailyLog: { findMany: mocks.dailyLogFindMany },
    comment: { findMany: mocks.commentFindMany },
  },
}));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: vi.fn().mockResolvedValue(null) }));
vi.mock("@/modules/instructor-portal/authorized-student-courses", () => ({
  getStaffAuthorizedStudentCourseIds: mocks.getStaffAuthorizedStudentCourseIds,
}));

import { GET } from "./route";

function request(studentId = "learner-1", courseId?: string) {
  const query = new URLSearchParams({ studentId });
  if (courseId) query.set("courseId", courseId);
  return GET(new NextRequest(`http://localhost/api/comments?${query.toString()}`));
}

describe("GET /api/comments course scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.getStaffAuthorizedStudentCourseIds.mockResolvedValue(["course-a", "course-b"]);
    mocks.courseEnrollmentFindFirst.mockResolvedValue({ id: "enrolment-1" });
    mocks.interactionFindMany.mockResolvedValue([{ id: "interaction-a" }]);
    mocks.projectTaskFindMany.mockResolvedValue([{ id: "task-a" }]);
    mocks.weeklyTestFindMany.mockResolvedValue([{ id: "weekly-a" }]);
    mocks.dailyLogFindMany.mockResolvedValue([{ id: "daily-a" }]);
    mocks.commentFindMany.mockResolvedValue([
      { id: "linked", interactionId: "interaction-a", taskId: null, weeklyTestId: null, dailyLogId: null },
      { id: "mixed", interactionId: "interaction-a", taskId: "task-from-other-course", weeklyTestId: null, dailyLogId: null },
      { id: "unassigned", interactionId: null, taskId: null, weeklyTestId: null, dailyLogId: null },
    ]);
  });

  it("requires staff to select a course before reading comments", async () => {
    const response = await request();
    expect(response.status).toBe(400);
    expect(mocks.commentFindMany).not.toHaveBeenCalled();
    expect(mocks.interactionFindMany).not.toHaveBeenCalled();
  });

  it("denies a course outside the current authorised intersection", async () => {
    const response = await request("learner-1", "course-outside");
    expect(response.status).toBe(403);
    expect(mocks.commentFindMany).not.toHaveBeenCalled();
  });

  it("returns only comments whose every linked record belongs to the selected course", async () => {
    const response = await request("learner-1", "course-b");
    expect(response.status).toBe(200);
    expect(mocks.interactionFindMany).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-b" },
      select: { id: true },
    });
    expect(mocks.projectTaskFindMany).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-b" },
      select: { id: true },
    });
    expect(mocks.commentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        studentId: "learner-1",
        OR: [
          { interactionId: { in: ["interaction-a"] } },
          { taskId: { in: ["task-a"] } },
          { weeklyTestId: { in: ["weekly-a"] } },
          { dailyLogId: { in: ["daily-a"] } },
        ],
      },
    }));
    const body = await response.json();
    expect(body.comments.map((comment: { id: string }) => comment.id)).toEqual(["linked"]);
  });

  it("preserves a learner's own unfiltered comment history", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.commentFindMany.mockResolvedValue([{ id: "own-comment" }]);

    const response = await request();
    expect(response.status).toBe(200);
    expect(mocks.commentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: "learner-1" },
    }));
    expect(mocks.interactionFindMany).not.toHaveBeenCalled();
  });
});
