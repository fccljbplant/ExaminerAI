import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  userFindUnique: vi.fn(),
  courseEnrollmentFindMany: vi.fn(),
  orgMemberFindMany: vi.fn(),
  orgCourseFindMany: vi.fn(),
  accessGrantFindFirst: vi.fn(),
  getCourseDurationWeeks: vi.fn(),
  getCourseWeekPhase: vi.fn(),
  callAI: vi.fn(),
  enforceAIRateLimit: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    courseEnrollment: { findMany: mocks.courseEnrollmentFindMany },
    orgMember: { findMany: mocks.orgMemberFindMany },
    orgCourse: { findMany: mocks.orgCourseFindMany },
    accessGrant: { findFirst: mocks.accessGrantFindFirst },
  },
}));

vi.mock("@/lib/rbac", () => ({
  isStaffRole: (role: string) =>
    ["instructor", "org_admin", "platform_admin", "demo"].includes(role),
  normalizeRole: (role: string) => role,
  UserRole: {
    LEARNER: "learner",
    INSTRUCTOR: "instructor",
    ORG_ADMIN: "org_admin",
    PLATFORM_ADMIN: "platform_admin",
  },
}));

vi.mock("@/lib/ai-provider", () => ({ callAI: mocks.callAI }));
vi.mock("@/lib/ai-rate-limits", () => ({ enforceAIRateLimit: mocks.enforceAIRateLimit }));
vi.mock("@/lib/audit-log", () => ({
  logAudit: mocks.logAudit,
  AuditAction: { FINAL_RESULT_GENERATED: "FINAL_RESULT_GENERATED" },
}));
vi.mock("@/lib/constants", () => ({ scoreToGrade: (score: number) => `grade-${score}` }));
vi.mock("@/lib/course-db", () => ({
  getCourseDurationWeeks: mocks.getCourseDurationWeeks,
  getCourseWeekPhase: mocks.getCourseWeekPhase,
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import { GET } from "./route";

const learnerId = "learner-1";
const learnerCourseIds = ["course-a", "course-b", "course-outside"];

function requestFinalResult(userId = learnerId) {
  return GET(new Request(`http://localhost/api/students/final-result?userId=${userId}`));
}

function expectAllRelationsScoped(courseIds: string[]) {
  const call = mocks.userFindUnique.mock.calls.at(-1)?.[0];
  expect(call.include.weeklyTests.where).toEqual({ courseId: { in: courseIds } });
  expect(call.include.interactions.where).toEqual({ courseId: { in: courseIds } });
  expect(call.include.reportCards.where).toEqual({ courseId: { in: courseIds } });
  expect(call.include.projectReports.where).toEqual({ courseId: { in: courseIds } });
  expect(call.include.tasks.where).toEqual({ courseId: { in: courseIds } });
}

describe("GET /api/students/final-result course scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({
      sub: "instructor-1",
      role: "instructor",
      name: "Instructor",
      email: "instructor@example.test",
    });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => {
      if (where.userId === "instructor-1") {
        return [{ courseId: "course-a" }, { courseId: "course-unrelated" }];
      }
      return learnerCourseIds.map((courseId) => ({ courseId }));
    });
    mocks.orgMemberFindMany.mockResolvedValue([]);
    mocks.orgCourseFindMany.mockResolvedValue([]);
    mocks.accessGrantFindFirst.mockResolvedValue(null);
    mocks.getCourseDurationWeeks.mockResolvedValue(1);
    mocks.getCourseWeekPhase.mockResolvedValue("Week 1");
    mocks.callAI.mockResolvedValue({
      text: JSON.stringify({
        behavioralPattern: "Learner pattern",
        areasToImprove: ["Practice"],
        overallAssessment: "Good progress",
        careerReadiness: "Almost Ready",
      }),
    });
    mocks.enforceAIRateLimit.mockResolvedValue(null);
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.userFindUnique.mockResolvedValue({
      id: learnerId,
      role: "learner",
      name: "Learner",
      projectName: "Training project",
      weeklyTests: [{
        week: 1, score: 80, currentQuestion: 10, plagiarismScore: null, status: "completed",
      }],
      interactions: [{
        week: 1, correctness: 90, date: new Date("2026-01-01T00:00:00.000Z"), plagiarismScore: null,
      }],
      reportCards: [{ id: "report-a", week: 1 }],
      projectReports: [{
        id: "project-report-a",
        week: 1,
        reportType: "weekly",
        reportText: "Project work",
        aiAnalysis: null,
        submittedAt: new Date("2026-01-01T00:00:00.000Z"),
        analyzedAt: null,
      }],
      tasks: [
        { status: "completed", isMilestone: true, week: 1 },
        { status: "in_progress", isMilestone: false, week: 1 },
      ],
    });
  });

  it("limits instructor results to courses shared with the learner", async () => {
    const response = await requestFinalResult();
    expect(response.status).toBe(200);
    expectAllRelationsScoped(["course-a"]);

    const body = await response.json();
    expect(body.performanceScore).toBe(85);
    expect(body.areasToImprove).toEqual(["Practice"]);
    expect(body.overallAssessment).toBe("Good progress");
    expect(body.careerReadiness).toBe("Almost Ready");
    expect(body.projectReports).toHaveLength(1);
    expect(body.projectTaskStats.totalTasks).toBe(2);
    expect(body).not.toHaveProperty("behavioralPattern");
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it("limits org admins to courses linked to their shared active organisation", async () => {
    mocks.getAuthUser.mockResolvedValue({
      sub: "org-admin-1", role: "org_admin", name: "Org Admin", email: "admin@example.test",
    });
    mocks.orgMemberFindMany.mockImplementation(async ({ where }) => (
      where.userId === "org-admin-1"
        ? [{ orgId: "org-1" }]
        : [{ orgId: "org-1" }]
    ));
    mocks.orgCourseFindMany.mockResolvedValue([
      { courseId: "course-b" },
      { courseId: "course-not-enrolled" },
    ]);

    const response = await requestFinalResult();
    expect(response.status).toBe(200);
    expectAllRelationsScoped(["course-b"]);
  });

  it("preserves explicit instructor-grant access when no teaching course is shared", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => (
      where.userId === "instructor-1"
        ? [{ courseId: "course-unrelated" }]
        : [{ courseId: "course-a" }, { courseId: "course-b" }]
    ));
    mocks.accessGrantFindFirst.mockResolvedValue({ id: "grant-1", dataScope: "content_only" });

    const response = await requestFinalResult();
    expect(response.status).toBe(200);
    expect(mocks.accessGrantFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        granteeUserId: "instructor-1",
        scopeType: "student",
        scopeId: learnerId,
        dataScope: { in: ["full", "content_only"] },
        revokedAt: null,
      }),
    }));
    expectAllRelationsScoped(["course-a", "course-b"]);
  });

  it("fails closed when a grant disappears or no authorised course remains", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => (
      where.userId === "instructor-1"
        ? [{ courseId: "course-unrelated" }]
        : [{ courseId: "course-a" }]
    ));

    const response = await requestFinalResult();
    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("does not query learner records when the tenant/course access check denies access", async () => {
    mocks.assertCanAccessStudent.mockRejectedValue({ status: 403, message: "Access denied" });

    const response = await requestFinalResult();
    expect(response.status).toBe(403);
    expect(mocks.courseEnrollmentFindMany).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("bounds platform-admin results to the learner's actual course enrolments", async () => {
    mocks.getAuthUser.mockResolvedValue({
      sub: "platform-admin-1",
      role: "platform_admin",
      name: "Platform Admin",
      email: "platform@example.test",
    });

    const response = await requestFinalResult();
    expect(response.status).toBe(200);
    expectAllRelationsScoped(learnerCourseIds);
    expect(mocks.courseEnrollmentFindMany).toHaveBeenCalledTimes(1);
  });

  it("preserves the learner's own cross-course result without staff filters", async () => {
    mocks.getAuthUser.mockResolvedValue({
      sub: learnerId, role: "learner", name: "Learner", email: "learner@example.test",
    });

    const response = await requestFinalResult();
    expect(response.status).toBe(200);
    const call = mocks.userFindUnique.mock.calls.at(-1)?.[0];
    expect(call.include.weeklyTests).not.toHaveProperty("where");
    expect(call.include.interactions).not.toHaveProperty("where");
    expect(call.include.reportCards).not.toHaveProperty("where");
    expect(call.include.projectReports).not.toHaveProperty("where");
    expect(call.include.tasks).not.toHaveProperty("where");
    expect(mocks.assertCanAccessStudent).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.behavioralPattern).toBe("Learner pattern");
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });
});
