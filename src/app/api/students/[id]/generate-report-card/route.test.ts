import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  demoWriteBlock: vi.fn(),
  getStaffAuthorizedStudentCourseIds: vi.fn(),
  userFindUnique: vi.fn(),
  courseFindUnique: vi.fn(),
  taskFindMany: vi.fn(),
  dailyLogFindMany: vi.fn(),
  interactionFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  getTestConfig: vi.fn(),
  saveCourseReportCard: vi.fn(),
  logAudit: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));
vi.mock("@/lib/rbac", () => ({
  isStaffRole: (role: string) => ["instructor", "org_admin", "platform_admin", "demo"].includes(role),
}));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/modules/instructor-portal/authorized-student-courses", () => ({
  getStaffAuthorizedStudentCourseIds: mocks.getStaffAuthorizedStudentCourseIds,
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    course: { findUnique: mocks.courseFindUnique },
    projectTask: { findMany: mocks.taskFindMany },
    dailyLog: { findMany: mocks.dailyLogFindMany },
    interaction: { findMany: mocks.interactionFindMany },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
  },
}));
vi.mock("@/modules/course/lib/course-config", () => ({ getTestConfig: mocks.getTestConfig }));
vi.mock("@/modules/course/lib/report-card-records", () => ({
  saveCourseReportCard: mocks.saveCourseReportCard,
}));
vi.mock("@/lib/audit-log", () => ({
  AuditAction: { REPORT_CARD_GENERATED: "report_card_generated" },
  logAudit: mocks.logAudit,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.loggerError } }));

import { POST } from "./route";

const policy = {
  gradingScale: [
    { grade: "A", min: 90, max: 100 },
    { grade: "B", min: 80, max: 89 },
    { grade: "F", min: 0, max: 79 },
  ],
  weights: { weeklyTest: 80, practice: 20 },
};

function request(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/students/learner-1/generate-report-card", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "learner-1" }) },
  );
}

describe("POST /api/students/[id]/generate-report-card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", name: "Instructor", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.getStaffAuthorizedStudentCourseIds.mockResolvedValue(["course-a"]);
    mocks.userFindUnique.mockResolvedValue({ id: "learner-1", role: "learner" });
    mocks.courseFindUnique.mockResolvedValue({
      id: "course-a",
      name: "Course A",
      reportCardTemplateJson: JSON.stringify(policy),
      weeks: [{ weekNumber: 1 }],
    });
    mocks.taskFindMany.mockResolvedValue([{ status: "completed" }, { status: "planned" }]);
    mocks.dailyLogFindMany.mockResolvedValue([{ id: "log-1" }]);
    mocks.interactionFindMany.mockResolvedValue([{ correctness: 80 }]);
    mocks.weeklyTestFindMany.mockResolvedValue([{ attempt: 1, status: "completed", score: 90 }]);
    mocks.getTestConfig.mockResolvedValue({ retakePolicy: "best" });
    mocks.saveCourseReportCard.mockResolvedValue({
      id: "card-1",
      courseId: "course-a",
      week: 1,
      score: 88,
      grade: "B",
      version: 1,
    });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("reads only the selected learner/course/week evidence and saves the weighted result", async () => {
    const response = await request({ courseId: "course-a", week: 1 });
    expect(response.status).toBe(200);

    for (const mock of [mocks.taskFindMany, mocks.dailyLogFindMany, mocks.interactionFindMany, mocks.weeklyTestFindMany]) {
      expect(mock).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: "learner-1", courseId: "course-a", week: 1 },
      }));
    }
    expect(mocks.saveCourseReportCard).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.objectContaining({
        userId: "learner-1",
        courseId: "course-a",
        week: 1,
        score: 88,
        grade: "B",
      }),
      actorId: "instructor-1",
    }));
  });

  it("denies a course outside the instructor's authorised learner-course intersection", async () => {
    mocks.getStaffAuthorizedStudentCourseIds.mockResolvedValue(["course-b"]);
    const response = await request({ courseId: "course-a", week: 1 });
    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.taskFindMany).not.toHaveBeenCalled();
    expect(mocks.saveCourseReportCard).not.toHaveBeenCalled();
  });

  it("does not create a report card when the selected course week has no evidence", async () => {
    mocks.taskFindMany.mockResolvedValue([]);
    mocks.dailyLogFindMany.mockResolvedValue([]);
    mocks.interactionFindMany.mockResolvedValue([]);
    mocks.weeklyTestFindMany.mockResolvedValue([]);
    const response = await request({ courseId: "course-a", week: 1 });
    expect(response.status).toBe(409);
    expect(mocks.saveCourseReportCard).not.toHaveBeenCalled();
  });

  it("keeps the score and grade unavailable when the course has no grading policy", async () => {
    mocks.courseFindUnique.mockResolvedValue({
      id: "course-a",
      name: "Course A",
      reportCardTemplateJson: null,
      weeks: [{ weekNumber: 1 }],
    });
    const response = await request({ courseId: "course-a", week: 1 });
    expect(response.status).toBe(200);
    expect(mocks.saveCourseReportCard).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.objectContaining({ score: null, grade: null }),
    }));
  });
});
