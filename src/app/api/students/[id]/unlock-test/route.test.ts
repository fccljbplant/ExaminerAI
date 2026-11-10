import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  demoWriteBlock: vi.fn(),
  authorisedCourses: vi.fn(),
  courseFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  weeklyFindFirst: vi.fn(),
  weeklyUpdate: vi.fn(),
  weeklyCreate: vi.fn(),
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
    user: { findUnique: mocks.userFindUnique },
    weeklyTest: {
      findFirst: mocks.weeklyFindFirst,
      update: mocks.weeklyUpdate,
      create: mocks.weeklyCreate,
    },
  },
}));
vi.mock("@/lib/audit-log", () => ({
  AuditAction: { WEEKLY_TEST_UNLOCKED: "weekly_test_unlocked" },
  logAudit: mocks.logAudit,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/students/learner-1/unlock-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "learner-1" }) },
  );
}

describe("POST /api/students/[id]/unlock-test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", name: "Instructor", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.authorisedCourses.mockResolvedValue(["course-a"]);
    mocks.courseFindUnique.mockResolvedValue({ id: "course-a", weeks: [{ weekNumber: 1 }] });
    mocks.userFindUnique.mockResolvedValue({ id: "learner-1", name: "Learner", role: "learner" });
    mocks.weeklyFindFirst.mockResolvedValue({
      id: "attempt-1",
      courseId: "course-a",
      week: 1,
      attempt: 1,
      status: "in-progress",
      startedAt: new Date(),
    });
    mocks.weeklyUpdate.mockResolvedValue({});
    mocks.weeklyCreate.mockResolvedValue({ id: "attempt-2" });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("preserves an in-progress attempt when unlocking it", async () => {
    const response = await request({ courseId: "course-a", week: 1, action: "unlock" });
    expect(response.status).toBe(200);
    expect(mocks.weeklyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "attempt-1" },
      data: expect.objectContaining({ status: "in-progress" }),
    }));
    expect(mocks.weeklyCreate).not.toHaveBeenCalled();
  });

  it("creates a new attempt instead of deleting the previous one on reset", async () => {
    const response = await request({ courseId: "course-a", week: 1, action: "reset" });
    expect(response.status).toBe(200);
    expect(mocks.weeklyUpdate).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: { status: "abandoned", retakeAllowed: false },
    });
    expect(mocks.weeklyCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "learner-1",
        courseId: "course-a",
        week: 1,
        attempt: 2,
        status: "in-progress",
      }),
      select: { id: true },
    }));
  });
});
