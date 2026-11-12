import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isPortalEnabled: vi.fn(),
  userFindUnique: vi.fn(),
  courseEnrollmentFindMany: vi.fn(),
  orgMemberFindMany: vi.fn(),
  orgCourseFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  reportCardFindMany: vi.fn(),
  dailyLogFindMany: vi.fn(),
  projectTaskFindMany: vi.fn(),
  certificateFindMany: vi.fn(),
  engagementEventFindMany: vi.fn(),
  learnProjectFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/feature-flags", () => ({ isPortalEnabled: mocks.isPortalEnabled }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    courseEnrollment: { findMany: mocks.courseEnrollmentFindMany },
    orgMember: { findMany: mocks.orgMemberFindMany },
    orgCourse: { findMany: mocks.orgCourseFindMany },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
    reportCard: { findMany: mocks.reportCardFindMany },
    dailyLog: { findMany: mocks.dailyLogFindMany },
    projectTask: { findMany: mocks.projectTaskFindMany },
    certificate: { findMany: mocks.certificateFindMany },
    engagementEvent: { findMany: mocks.engagementEventFindMany },
    learnProject: { findMany: mocks.learnProjectFindMany },
  },
}));

import { GET } from "./route";

const params = { params: Promise.resolve({ id: "learner-1" }) };

async function callAs(role: string) {
  mocks.getAuthUser.mockResolvedValue({ sub: role + "-1", role });
  return GET(
    new NextRequest("http://localhost/api/v2/instructor/students/learner-1"),
    params,
  );
}

describe("GET /api/v2/instructor/students/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPortalEnabled.mockResolvedValue(true);
    mocks.userFindUnique.mockResolvedValue({
      id: "learner-1",
      name: "Learner",
      email: "learner@example.test",
      role: "learner",
      lastLogin: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mocks.courseEnrollmentFindMany.mockResolvedValue([]);
    mocks.orgMemberFindMany.mockResolvedValue([]);
    mocks.orgCourseFindMany.mockResolvedValue([]);
    mocks.weeklyTestFindMany.mockResolvedValue([{
      week: 1,
      score: 80,
      status: "completed",
      completedAt: new Date("2026-01-02T00:00:00.000Z"),
      plagiarismScore: null,
      strengths: "[]",
      weaknesses: "[]",
      nextAction: null,
      retakeAllowed: false,
      conversation: "[]",
    }]);
    mocks.reportCardFindMany.mockResolvedValue([]);
    mocks.dailyLogFindMany.mockResolvedValue([{ date: new Date("2026-01-02T00:00:00.000Z") }]);
    mocks.projectTaskFindMany.mockResolvedValue([{ id: "task-a", description: "Task A", status: "completed", week: 1 }]);
    mocks.certificateFindMany.mockResolvedValue([]);
    mocks.engagementEventFindMany.mockResolvedValue([]);
    mocks.learnProjectFindMany.mockResolvedValue([]);
  });

  it("scopes every course-bearing learner dataset to all shared instructor courses", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }: {
      where: { userId: string; courseId?: { in: string[] } };
    }) => (
      where.userId === "instructor-1"
        ? [{ courseId: "course-a" }, { courseId: "course-b" }]
        : ["course-a", "course-b", "course-c"]
            .filter((courseId) => where.courseId?.in.includes(courseId))
            .map((courseId) => ({ courseId }))
    ));

    const response = await callAs("instructor");
    const body = await response.json();

    expect(response.status).toBe(200);
    for (const query of [
      mocks.weeklyTestFindMany,
      mocks.reportCardFindMany,
      mocks.dailyLogFindMany,
      mocks.projectTaskFindMany,
      mocks.certificateFindMany,
      mocks.engagementEventFindMany,
      mocks.learnProjectFindMany,
    ]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: "learner-1", courseId: { in: ["course-a", "course-b"] } },
      }));
    }
    expect(body.data.courseIds).toEqual(["course-a", "course-b"]);
    expect(body.data.kpis.tasksDone).toBe("1/1");
  });

  it("limits org admins to learners enrolled in their active organisation's courses", async () => {
    mocks.orgMemberFindMany.mockResolvedValue([{ orgId: "org-1" }]);
    mocks.orgCourseFindMany.mockResolvedValue([{ courseId: "course-a" }]);
    mocks.courseEnrollmentFindMany.mockResolvedValue([{ courseId: "course-a" }]);

    const response = await callAs("org_admin");

    expect(response.status).toBe(200);
    expect(mocks.orgMemberFindMany).toHaveBeenCalledWith({
      where: { userId: "org_admin-1", role: "admin", status: "active" },
      select: { orgId: true },
    });
    expect(mocks.weeklyTestFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "learner-1", courseId: { in: ["course-a"] } },
    }));
  });

  it("denies org admins when the learner is not enrolled in an organisation course", async () => {
    mocks.orgMemberFindMany.mockResolvedValue([{ orgId: "org-1" }]);
    mocks.orgCourseFindMany.mockResolvedValue([{ courseId: "course-a" }]);
    mocks.courseEnrollmentFindMany.mockResolvedValue([]);

    const response = await callAs("org_admin");

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.weeklyTestFindMany).not.toHaveBeenCalled();
  });

  it("does not process or expose psychology/confidence signals before consent gates exist", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }: { where: { userId: string } }) => (
      where.userId === "instructor-1" ? [{ courseId: "course-a" }] : [{ courseId: "course-a" }]
    ));

    const response = await callAs("instructor");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.psychWeekly).toBeNull();
    expect(body.data.dailyLogs).toEqual([{ date: "2026-01-02", confidence: null }]);
  });

  it("rejects non-learner accounts before loading academic records", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }: { where: { userId: string } }) => (
      where.userId === "instructor-1" ? [{ courseId: "course-a" }] : [{ courseId: "course-a" }]
    ));
    mocks.userFindUnique.mockResolvedValue({
      id: "learner-1",
      role: "org_admin",
      name: "Not a learner",
      email: "admin@example.test",
      lastLogin: null,
      createdAt: new Date(),
    });

    const response = await callAs("instructor");

    expect(response.status).toBe(404);
    expect(mocks.weeklyTestFindMany).not.toHaveBeenCalled();
  });
});
