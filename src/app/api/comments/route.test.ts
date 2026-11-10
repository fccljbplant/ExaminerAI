import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  getStaffAuthorizedStudentCourseIds: vi.fn(),
  userFindUnique: vi.fn(),
  courseEnrollmentFindFirst: vi.fn(),
  interactionFindMany: vi.fn(),
  interactionFindFirst: vi.fn(),
  projectTaskFindMany: vi.fn(),
  projectTaskFindFirst: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  weeklyTestFindFirst: vi.fn(),
  dailyLogFindMany: vi.fn(),
  dailyLogFindFirst: vi.fn(),
  commentFindMany: vi.fn(),
  commentFindUnique: vi.fn(),
  commentCreate: vi.fn(),
  commentUpdate: vi.fn(),
  commentDelete: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    courseEnrollment: { findFirst: mocks.courseEnrollmentFindFirst },
    interaction: { findMany: mocks.interactionFindMany, findFirst: mocks.interactionFindFirst },
    projectTask: { findMany: mocks.projectTaskFindMany, findFirst: mocks.projectTaskFindFirst },
    weeklyTest: { findMany: mocks.weeklyTestFindMany, findFirst: mocks.weeklyTestFindFirst },
    dailyLog: { findMany: mocks.dailyLogFindMany, findFirst: mocks.dailyLogFindFirst },
    comment: {
      findMany: mocks.commentFindMany,
      findUnique: mocks.commentFindUnique,
      create: mocks.commentCreate,
      update: mocks.commentUpdate,
      delete: mocks.commentDelete,
    },
  },
}));
vi.mock("@/lib/audit-log", () => ({
  logAudit: mocks.logAudit,
  AuditAction: {
    COMMENT_CREATED: "comment_created",
    COMMENT_UPDATED: "comment_updated",
    COMMENT_DELETED: "comment_deleted",
  },
}));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: vi.fn().mockResolvedValue(null) }));
vi.mock("@/modules/instructor-portal/authorized-student-courses", () => ({
  getStaffAuthorizedStudentCourseIds: mocks.getStaffAuthorizedStudentCourseIds,
}));

import { DELETE, GET, PATCH, POST } from "./route";

function request(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}

function getRequest(studentId = "learner-1", courseId?: string) {
  const query = new URLSearchParams({ studentId });
  if (courseId) query.set("courseId", courseId);
  return GET(request("GET", `http://localhost/api/comments?${query.toString()}`));
}

const existingComment = {
  id: "comment-1",
  studentId: "learner-1",
  instructorId: "instructor-1",
  interactionId: "interaction-a",
  taskId: null,
  weeklyTestId: null,
  dailyLogId: null,
  body: "Good work",
  marksOverride: null,
};

describe("/api/comments course scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.getStaffAuthorizedStudentCourseIds.mockResolvedValue(["course-a", "course-b"]);
    mocks.userFindUnique.mockResolvedValue({ id: "learner-1", role: "learner" });
    mocks.courseEnrollmentFindFirst.mockResolvedValue({ id: "enrolment-1" });
    mocks.interactionFindMany.mockResolvedValue([{ id: "interaction-a" }]);
    mocks.projectTaskFindMany.mockResolvedValue([{ id: "task-a" }]);
    mocks.weeklyTestFindMany.mockResolvedValue([{ id: "weekly-a" }]);
    mocks.dailyLogFindMany.mockResolvedValue([{ id: "daily-a" }]);
    mocks.interactionFindFirst.mockResolvedValue({ id: "interaction-a" });
    mocks.projectTaskFindFirst.mockResolvedValue({ id: "task-a" });
    mocks.weeklyTestFindFirst.mockResolvedValue({ id: "weekly-a" });
    mocks.dailyLogFindFirst.mockResolvedValue({ id: "daily-a" });
    mocks.commentFindMany.mockResolvedValue([
      { id: "linked", interactionId: "interaction-a", taskId: null, weeklyTestId: null, dailyLogId: null },
      { id: "mixed", interactionId: "interaction-a", taskId: "task-from-other-course", weeklyTestId: null, dailyLogId: null },
      { id: "unassigned", interactionId: null, taskId: null, weeklyTestId: null, dailyLogId: null },
    ]);
    mocks.commentFindUnique.mockResolvedValue(existingComment);
    mocks.commentCreate.mockResolvedValue({ id: "created-comment" });
    mocks.commentUpdate.mockResolvedValue({ ...existingComment, body: "Updated" });
    mocks.commentDelete.mockResolvedValue(existingComment);
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("requires staff to select a course before reading comments", async () => {
    const response = await getRequest();
    expect(response.status).toBe(400);
    expect(mocks.commentFindMany).not.toHaveBeenCalled();
    expect(mocks.interactionFindMany).not.toHaveBeenCalled();
  });

  it("denies a course outside the current authorised intersection", async () => {
    const response = await getRequest("learner-1", "course-outside");
    expect(response.status).toBe(403);
    expect(mocks.commentFindMany).not.toHaveBeenCalled();
  });

  it("returns only comments whose every linked record belongs to the selected course", async () => {
    const response = await getRequest("learner-1", "course-b");
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

    const response = await getRequest();
    expect(response.status).toBe(200);
    expect(mocks.commentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: "learner-1" },
    }));
    expect(mocks.interactionFindMany).not.toHaveBeenCalled();
  });

  it("rejects unassigned or course-less comment creation", async () => {
    const noCourse = await POST(request("POST", "http://localhost/api/comments", {
      studentId: "learner-1", body: "Feedback", interactionId: "interaction-a",
    }));
    expect(noCourse.status).toBe(400);

    const noActivity = await POST(request("POST", "http://localhost/api/comments", {
      studentId: "learner-1", courseId: "course-a", body: "General feedback",
    }));
    expect(noActivity.status).toBe(400);
    expect(mocks.commentCreate).not.toHaveBeenCalled();
  });

  it("denies comment creation when the selected course or activity is outside scope", async () => {
    const outsideCourse = await POST(request("POST", "http://localhost/api/comments", {
      studentId: "learner-1", courseId: "course-outside", interactionId: "interaction-a", body: "Feedback",
    }));
    expect(outsideCourse.status).toBe(403);

    mocks.interactionFindFirst.mockResolvedValueOnce(null);
    const outsideActivity = await POST(request("POST", "http://localhost/api/comments", {
      studentId: "learner-1", courseId: "course-a", interactionId: "interaction-from-other-course", body: "Feedback",
    }));
    expect(outsideActivity.status).toBe(403);
    expect(mocks.commentCreate).not.toHaveBeenCalled();
  });

  it("rejects mixed-course activity references instead of accepting a partially valid comment", async () => {
    mocks.projectTaskFindFirst.mockResolvedValueOnce(null);
    const response = await POST(request("POST", "http://localhost/api/comments", {
      studentId: "learner-1",
      courseId: "course-a",
      interactionId: "interaction-a",
      taskId: "task-from-other-course",
      body: "Feedback",
    }));
    expect(response.status).toBe(403);
    expect(mocks.commentCreate).not.toHaveBeenCalled();
  });

  it("creates a comment only after every supplied activity reference is validated in the selected course", async () => {
    const response = await POST(request("POST", "http://localhost/api/comments", {
      studentId: "learner-1",
      courseId: "course-a",
      interactionId: "interaction-a",
      body: "Strong explanation",
    }));
    expect(response.status).toBe(200);
    expect(mocks.commentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: "learner-1",
        interactionId: "interaction-a",
        taskId: null,
        weeklyTestId: null,
        dailyLogId: null,
      }),
    }));
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "comment_created",
      target: { type: "comment", id: "created-comment" },
      metadata: expect.objectContaining({
        studentId: "learner-1",
        courseId: "course-a",
        activityIds: ["interaction-a"],
      }),
    }));
    expect(JSON.stringify(mocks.logAudit.mock.calls[0][0].metadata)).not.toContain("Strong explanation");
  });

  it("prevents editing a comment whose activity is not in the selected course", async () => {
    mocks.interactionFindFirst.mockResolvedValueOnce(null);
    const response = await PATCH(request(
      "PATCH",
      "http://localhost/api/comments?id=comment-1&courseId=course-a",
      { body: "Updated feedback" },
    ));
    expect(response.status).toBe(403);
    expect(mocks.commentUpdate).not.toHaveBeenCalled();
  });

  it("prevents deleting a comment whose activity is not in the selected course", async () => {
    mocks.interactionFindFirst.mockResolvedValueOnce(null);
    const response = await DELETE(request(
      "DELETE",
      "http://localhost/api/comments?id=comment-1&courseId=course-a",
    ));
    expect(response.status).toBe(403);
    expect(mocks.commentDelete).not.toHaveBeenCalled();
  });

  it("audits edits without recording comment text", async () => {
    const response = await PATCH(request(
      "PATCH",
      "http://localhost/api/comments?id=comment-1&courseId=course-a",
      { body: "Updated feedback" },
    ));
    expect(response.status).toBe(200);
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "comment_updated",
      target: { type: "comment", id: "comment-1" },
      metadata: expect.objectContaining({
        studentId: "learner-1",
        courseId: "course-a",
        updatedFields: ["body"],
      }),
    }));
    expect(JSON.stringify(mocks.logAudit.mock.calls[0][0].metadata)).not.toContain("Updated feedback");
  });

  it("audits deletes with course and activity references", async () => {
    const response = await DELETE(request(
      "DELETE",
      "http://localhost/api/comments?id=comment-1&courseId=course-a",
    ));
    expect(response.status).toBe(200);
    expect(mocks.commentDelete).toHaveBeenCalledWith({ where: { id: "comment-1" } });
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "comment_deleted",
      target: { type: "comment", id: "comment-1" },
      metadata: expect.objectContaining({
        studentId: "learner-1",
        courseId: "course-a",
        activityIds: ["interaction-a"],
      }),
    }));
  });
});
