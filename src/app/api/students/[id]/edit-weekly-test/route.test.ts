import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  demoWriteBlock: vi.fn(),
  authorisedCourses: vi.fn(),
  courseFindUnique: vi.fn(),
  weeklyFindFirst: vi.fn(),
  weeklyUpdate: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));
vi.mock("@/lib/rbac", () => ({ isStaffRole: (role: string) => role === "instructor" || role === "org_admin" }));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/modules/instructor-portal/authorized-student-courses", () => ({
  getStaffAuthorizedStudentCourseIds: mocks.authorisedCourses,
}));
vi.mock("@/lib/db", () => ({
  db: {
    course: { findUnique: mocks.courseFindUnique },
    weeklyTest: { findFirst: mocks.weeklyFindFirst, update: mocks.weeklyUpdate },
  },
}));
vi.mock("@/lib/audit-log", () => ({
  AuditAction: { WEEKLY_TEST_SCORE_UPDATED: "weekly_test_score_updated" },
  logAudit: mocks.logAudit,
}));

import { PATCH } from "./route";

function request(body: Record<string, unknown>) {
  return PATCH(
    new NextRequest("http://localhost/api/students/learner-1/edit-weekly-test", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "learner-1" }) },
  );
}

describe("PATCH /api/students/[id]/edit-weekly-test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", name: "Instructor", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.authorisedCourses.mockResolvedValue(["course-a"]);
    mocks.courseFindUnique.mockResolvedValue({ id: "course-a", weeks: [{ weekNumber: 1 }] });
    mocks.weeklyFindFirst.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-a",
      week: 1,
      attempt: 1,
      status: "completed",
      score: 62,
      originalScore: null,
    });
    mocks.weeklyUpdate.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-a",
      week: 1,
      attempt: 1,
      score: 80,
      originalScore: 62,
      scoreEditedAt: new Date(),
      scoreEditReason: "Reviewed rubric evidence",
      status: "completed",
    });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("retains the original AI score and audits a course-scoped correction", async () => {
    const response = await request({
      courseId: "course-a",
      week: 1,
      attempt: 1,
      score: 80,
      reason: "Reviewed rubric evidence",
    });
    expect(response.status).toBe(200);
    expect(mocks.weeklyFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-a", week: 1, attempt: 1 },
      orderBy: { attempt: "desc" },
    });
    expect(mocks.weeklyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "attempt-1" },
      data: expect.objectContaining({
        originalScore: 62,
        score: 80,
        scoreEditedById: "instructor-1",
        scoreEditReason: "Reviewed rubric evidence",
      }),
    }));
  });

  it("rejects cross-course score corrections", async () => {
    mocks.authorisedCourses.mockResolvedValue(["course-b"]);
    const response = await request({
      courseId: "course-a",
      week: 1,
      score: 80,
      reason: "Reviewed rubric evidence",
    });
    expect(response.status).toBe(403);
    expect(mocks.weeklyFindFirst).not.toHaveBeenCalled();
  });
});
