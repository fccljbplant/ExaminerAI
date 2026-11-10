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
  AuditAction: { WEEKLY_TEST_RETAKE_ALLOWED: "weekly_test_retake_allowed", WEEKLY_TEST_RETAKE_REVOKED: "weekly_test_retake_revoked" },
  logAudit: mocks.logAudit,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/students/learner-1/allow-retake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "learner-1" }) },
  );
}

describe("POST /api/students/[id]/allow-retake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", name: "Instructor", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.authorisedCourses.mockResolvedValue(["course-a"]);
    mocks.courseFindUnique.mockResolvedValue({ id: "course-a", weeks: [{ weekNumber: 2 }] });
    mocks.weeklyFindFirst.mockResolvedValue({
      id: "attempt-2",
      courseId: "course-a",
      week: 2,
      attempt: 2,
      status: "completed",
      retakeAllowed: false,
    });
    mocks.weeklyUpdate.mockResolvedValue({ id: "attempt-2" });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("grants permission only to the latest attempt in the selected course/week", async () => {
    const response = await request({ courseId: "course-a", week: 2 });
    expect(response.status).toBe(200);
    expect(mocks.weeklyFindFirst).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-a", week: 2 },
      orderBy: { attempt: "desc" },
    });
    expect(mocks.weeklyUpdate).toHaveBeenCalledWith({
      where: { id: "attempt-2" },
      data: { retakeAllowed: true },
    });
  });

  it("rejects a course outside the authorised learner-course intersection", async () => {
    mocks.authorisedCourses.mockResolvedValue(["course-b"]);
    const response = await request({ courseId: "course-a", week: 2 });
    expect(response.status).toBe(403);
    expect(mocks.weeklyFindFirst).not.toHaveBeenCalled();
  });

  it("requires an explicit course", async () => {
    const response = await request({ week: 2 });
    expect(response.status).toBe(400);
    expect(mocks.courseFindUnique).not.toHaveBeenCalled();
  });
});
