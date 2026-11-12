import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  userFindUnique: vi.fn(),
  courseEnrollmentFindMany: vi.fn(),
  orgMemberFindMany: vi.fn(),
  orgCourseFindMany: vi.fn(),
  accessGrantFindFirst: vi.fn(),
  projectTaskFindMany: vi.fn(),
  dailyLogFindMany: vi.fn(),
  interactionFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  reportCardFindMany: vi.fn(),
  competencyFindMany: vi.fn(),
  commentFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
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
    reportCard: { findMany: mocks.reportCardFindMany },
    competency: { findMany: mocks.competencyFindMany },
    comment: { findMany: mocks.commentFindMany },
  },
}));

import { GET } from "./route";

const params = { params: Promise.resolve({ id: "learner-1" }) };

async function callAs(role: string) {
  mocks.getAuthUser.mockResolvedValue({ sub: role + "-1", role });
  return GET(
    new NextRequest("http://localhost/api/students/learner-1/portfolio"),
    params,
  );
}

describe("GET /api/students/[id]/portfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue({
      id: "learner-1",
      role: "learner",
      name: "Learner",
      email: "learner@example.test",
      currentWeek: 1,
      projectDurationWeeks: 4,
    });
    mocks.courseEnrollmentFindMany.mockResolvedValue([]);
    mocks.orgMemberFindMany.mockResolvedValue([]);
    mocks.orgCourseFindMany.mockResolvedValue([]);
    mocks.accessGrantFindFirst.mockResolvedValue(null);
    mocks.projectTaskFindMany.mockResolvedValue([{ id: "task-a", status: "completed" }]);
    mocks.dailyLogFindMany.mockResolvedValue([{ id: "log-a" }]);
    mocks.interactionFindMany.mockResolvedValue([{ id: "interaction-a" }]);
    mocks.weeklyTestFindMany.mockResolvedValue([{ id: "weekly-a" }]);
    mocks.reportCardFindMany.mockResolvedValue([{ id: "report-a" }]);
    mocks.competencyFindMany.mockResolvedValue([{ id: "competency-a" }]);
    mocks.commentFindMany.mockResolvedValue([{ id: "comment-a" }]);
  });

  it("scopes instructor portfolio records and comments to shared courses", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }: { where: { userId: string } }) => (
      where.userId === "instructor-1"
        ? [{ courseId: "course-a" }]
        : [{ courseId: "course-a" }, { courseId: "course-b" }]
    ));

    const response = await callAs("instructor");
    const body = await response.json();

    expect(response.status).toBe(200);
    for (const query of [
      mocks.projectTaskFindMany,
      mocks.dailyLogFindMany,
      mocks.interactionFindMany,
      mocks.weeklyTestFindMany,
      mocks.reportCardFindMany,
    ]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: "learner-1", courseId: { in: ["course-a"] } },
      }));
    }
    expect(mocks.commentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        studentId: "learner-1",
        OR: expect.arrayContaining([
          { taskId: { in: ["task-a"] } },
          { dailyLogId: { in: ["log-a"] } },
          { interactionId: { in: ["interaction-a"] } },
          { weeklyTestId: { in: ["weekly-a"] } },
        ]),
      }),
    }));
    expect(body.tasks).toHaveLength(1);
    expect(mocks.competencyFindMany).not.toHaveBeenCalled();
  });

  it("limits organisation admins to learners enrolled in their active organisation's courses", async () => {
    mocks.orgMemberFindMany.mockResolvedValue([{ orgId: "org-1" }]);
    mocks.orgCourseFindMany.mockResolvedValue([{ courseId: "course-a" }]);
    mocks.courseEnrollmentFindMany.mockResolvedValue([{ courseId: "course-a" }]);

    const response = await callAs("org_admin");

    expect(response.status).toBe(200);
    expect(mocks.orgMemberFindMany).toHaveBeenCalledWith({
      where: { userId: "org_admin-1", role: "admin", status: "active" },
      select: { orgId: true },
    });
    expect(mocks.projectTaskFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "learner-1", courseId: { in: ["course-a"] } },
    }));
    expect(mocks.dailyLogFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "learner-1", courseId: { in: ["course-a"] } },
      select: { date: true },
    }));
    expect(mocks.competencyFindMany).not.toHaveBeenCalled();
  });

  it("denies organisation admins when the learner has no enrolment in their organisation", async () => {
    mocks.orgMemberFindMany.mockResolvedValue([{ orgId: "org-1" }]);
    mocks.orgCourseFindMany.mockResolvedValue([{ courseId: "course-a" }]);
    mocks.courseEnrollmentFindMany.mockResolvedValue([]);

    const response = await callAs("org_admin");

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.projectTaskFindMany).not.toHaveBeenCalled();
  });

  it("requires an explicit grant for demo accounts instead of treating them as admins", async () => {
    const response = await callAs("demo");

    expect(response.status).toBe(403);
    expect(mocks.accessGrantFindFirst).toHaveBeenCalled();
    expect(mocks.projectTaskFindMany).not.toHaveBeenCalled();
  });

  it("keeps content_only grants to tasks, report cards and interactions", async () => {
    mocks.accessGrantFindFirst.mockResolvedValue({ dataScope: "content_only" });

    const response = await callAs("demo");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.projectTaskFindMany).toHaveBeenCalled();
    expect(mocks.interactionFindMany).toHaveBeenCalled();
    expect(mocks.reportCardFindMany).toHaveBeenCalled();
    expect(mocks.dailyLogFindMany).not.toHaveBeenCalled();
    expect(mocks.weeklyTestFindMany).not.toHaveBeenCalled();
    expect(mocks.competencyFindMany).not.toHaveBeenCalled();
    expect(mocks.commentFindMany).not.toHaveBeenCalled();
    expect(body.dailyLogs).toEqual([]);
    expect(body.weeklyTests).toEqual([]);
    expect(body.competencies).toEqual([]);
    expect(body.comments).toEqual([]);
  });

  it("keeps wellbeing_only grants from querying or exposing academic portfolio data", async () => {
    mocks.accessGrantFindFirst.mockResolvedValue({ dataScope: "wellbeing_only" });

    const response = await callAs("demo");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.dailyLogFindMany).toHaveBeenCalled();
    expect(mocks.projectTaskFindMany).not.toHaveBeenCalled();
    expect(mocks.interactionFindMany).not.toHaveBeenCalled();
    expect(mocks.weeklyTestFindMany).not.toHaveBeenCalled();
    expect(mocks.reportCardFindMany).not.toHaveBeenCalled();
    expect(body.hasProject).toBeNull();
    expect(body.progress).toBeNull();
    expect(body.taskSummary).toBeNull();
    expect(body.tasks).toEqual([]);
  });

  it("does not expose individual daily logs to platform administrators", async () => {
    const response = await callAs("platform_admin");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.dailyLogFindMany).not.toHaveBeenCalled();
    expect(body.dailyLogs).toEqual([]);
  });
});
