import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  userFindUnique: vi.fn(),
  courseEnrollmentFindMany: vi.fn(),
  orgMemberFindMany: vi.fn(),
  orgCourseFindMany: vi.fn(),
  accessGrantFindFirst: vi.fn(),
  projectTaskFindMany: vi.fn(),
  dailyLogFindMany: vi.fn(),
  interactionFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  competencyFindMany: vi.fn(),
  reportCardFindMany: vi.fn(),
  commentFindMany: vi.fn(),
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
    projectTask: { findMany: mocks.projectTaskFindMany },
    dailyLog: { findMany: mocks.dailyLogFindMany },
    interaction: { findMany: mocks.interactionFindMany },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
    competency: { findMany: mocks.competencyFindMany },
    reportCard: { findMany: mocks.reportCardFindMany },
    comment: { findMany: mocks.commentFindMany },
  },
}));

import { GET } from "./route";

const learnerId = "learner-1";

async function requestPortfolio() {
  return GET(
    new NextRequest("http://localhost/api/students/learner-1/portfolio"),
    { params: Promise.resolve({ id: learnerId }) },
  );
}

function expectCourseFilter(mock: ReturnType<typeof vi.fn>, courseIds: string[]) {
  expect(mock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        userId: learnerId,
        courseId: { in: courseIds },
      },
    }),
  );
}

describe("GET /api/students/[id]/portfolio course scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.userFindUnique.mockResolvedValue({
      id: learnerId,
      name: "Learner",
      email: "learner@example.test",
      role: "learner",
      currentWeek: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      lastLogin: null,
      projectDurationWeeks: 6,
    });
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => {
      if (where.userId === "instructor-1") {
        return [{ courseId: "course-a" }, { courseId: "course-b" }];
      }
      return [
        { courseId: "course-a" },
        { courseId: "course-b" },
        { courseId: "course-outside" },
      ];
    });
    mocks.orgMemberFindMany.mockResolvedValue([]);
    mocks.orgCourseFindMany.mockResolvedValue([]);
    mocks.accessGrantFindFirst.mockResolvedValue(null);
    mocks.projectTaskFindMany.mockResolvedValue([{ id: "task-a", status: "completed" }]);
    mocks.dailyLogFindMany.mockResolvedValue([
      { id: "log-a", date: new Date("2026-01-02T00:00:00.000Z"), confidence: 10 },
    ]);
    mocks.interactionFindMany.mockResolvedValue([
      { id: "interaction-a", date: new Date("2026-01-02T00:00:00.000Z") },
    ]);
    mocks.weeklyTestFindMany.mockResolvedValue([{ id: "test-a", week: 1, score: 80 }]);
    mocks.competencyFindMany.mockResolvedValue([{ id: "competency-global" }]);
    mocks.reportCardFindMany.mockResolvedValue([{ id: "report-a" }]);
    mocks.commentFindMany.mockResolvedValue([{ id: "comment-a" }]);
  });

  it("filters every course-bearing record to the instructor/learner course intersection", async () => {
    const response = await requestPortfolio();
    expect(response.status).toBe(200);

    const courseIds = ["course-a", "course-b"];
    expectCourseFilter(mocks.projectTaskFindMany, courseIds);
    expectCourseFilter(mocks.dailyLogFindMany, courseIds);
    expectCourseFilter(mocks.interactionFindMany, courseIds);
    expectCourseFilter(mocks.weeklyTestFindMany, courseIds);
    expectCourseFilter(mocks.reportCardFindMany, courseIds);

    expect(mocks.commentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId: learnerId,
          OR: [
            { taskId: { in: ["task-a"] } },
            { interactionId: { in: ["interaction-a"] } },
            { weeklyTestId: { in: ["test-a"] } },
            { dailyLogId: { in: ["log-a"] } },
          ],
        },
      }),
    );

    const body = await response.json();
    expect(body.dailyLogs).toEqual([]);
    expect(body.competencies).toEqual([{ id: "competency-global" }]);
  });

  it("limits organisation admins to courses linked to their shared active organisation", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "org-admin-1", role: "org_admin" });
    mocks.courseEnrollmentFindMany.mockResolvedValue([
      { courseId: "course-a" },
      { courseId: "course-b" },
    ]);
    mocks.orgMemberFindMany.mockImplementation(async ({ where }) => (
      where.userId === "org-admin-1"
        ? [{ orgId: "org-1" }]
        : [{ orgId: "org-1" }]
    ));
    mocks.orgCourseFindMany.mockResolvedValue([
      { courseId: "course-a" },
      { courseId: "course-not-enrolled" },
    ]);

    const response = await requestPortfolio();
    expect(response.status).toBe(200);

    const courseIds = ["course-a"];
    expectCourseFilter(mocks.projectTaskFindMany, courseIds);
    expectCourseFilter(mocks.dailyLogFindMany, courseIds);
    expectCourseFilter(mocks.interactionFindMany, courseIds);
    expectCourseFilter(mocks.weeklyTestFindMany, courseIds);
    expectCourseFilter(mocks.reportCardFindMany, courseIds);
  });

  it("preserves explicit student-grant access when no teaching course is shared", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => (
      where.userId === "instructor-1"
        ? [{ courseId: "course-unrelated" }]
        : [{ courseId: "course-a" }, { courseId: "course-b" }]
    ));
    mocks.accessGrantFindFirst.mockResolvedValue({ id: "grant-1", dataScope: "content_only" });

    const response = await requestPortfolio();
    expect(response.status).toBe(200);
    expect(mocks.accessGrantFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          granteeUserId: "instructor-1",
          scopeType: "student",
          scopeId: learnerId,
          revokedAt: null,
        }),
      }),
    );

    const courseIds = ["course-a", "course-b"];
    expectCourseFilter(mocks.projectTaskFindMany, courseIds);
    expectCourseFilter(mocks.interactionFindMany, courseIds);
    expectCourseFilter(mocks.weeklyTestFindMany, courseIds);
    expectCourseFilter(mocks.reportCardFindMany, courseIds);
  });

  it("does not expose academic records through a wellbeing-only grant", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => (
      where.userId === "instructor-1"
        ? [{ courseId: "course-unrelated" }]
        : [{ courseId: "course-a" }]
    ));
    mocks.accessGrantFindFirst.mockResolvedValue({ id: "grant-1", dataScope: "wellbeing_only" });

    const response = await requestPortfolio();
    expect(response.status).toBe(200);
    expectCourseFilter(mocks.projectTaskFindMany, []);
    expectCourseFilter(mocks.dailyLogFindMany, []);
    expectCourseFilter(mocks.interactionFindMany, []);
    expectCourseFilter(mocks.weeklyTestFindMany, []);
    expectCourseFilter(mocks.reportCardFindMany, []);
    expect(mocks.commentFindMany).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.dataScope).toBe("wellbeing_only");
    expect(body.tasks).toEqual([]);
    expect(body.competencies).toEqual([]);
    expect(body.reportCards).toEqual([]);
  });

  it("fails closed if an explicit grant disappears during scope resolution", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => (
      where.userId === "instructor-1"
        ? [{ courseId: "course-unrelated" }]
        : [{ courseId: "course-a" }]
    ));
    mocks.accessGrantFindFirst.mockResolvedValue(null);

    const response = await requestPortfolio();
    expect(response.status).toBe(200);
    expectCourseFilter(mocks.projectTaskFindMany, []);
    expectCourseFilter(mocks.interactionFindMany, []);
    expectCourseFilter(mocks.weeklyTestFindMany, []);
    expectCourseFilter(mocks.reportCardFindMany, []);

    const body = await response.json();
    expect(body.competencies).toEqual([]);
    expect(body.tasks).toEqual([]);
  });

  it("does not query portfolio records when the access check denies the learner", async () => {
    mocks.assertCanAccessStudent.mockRejectedValue({ status: 403, message: "Access denied" });

    const response = await requestPortfolio();
    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.projectTaskFindMany).not.toHaveBeenCalled();
    expect(mocks.reportCardFindMany).not.toHaveBeenCalled();
  });
});
