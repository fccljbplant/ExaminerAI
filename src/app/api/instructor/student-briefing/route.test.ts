import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  isPortalEnabled: vi.fn(),
  userFindUnique: vi.fn(),
  courseEnrollmentFindMany: vi.fn(),
  orgMemberFindMany: vi.fn(),
  orgCourseFindMany: vi.fn(),
  dailyTestFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  projectTaskFindMany: vi.fn(),
  dailyLogFindMany: vi.fn(),
  interactionFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/feature-flags", () => ({ isPortalEnabled: mocks.isPortalEnabled }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    courseEnrollment: { findMany: mocks.courseEnrollmentFindMany },
    orgMember: { findMany: mocks.orgMemberFindMany },
    orgCourse: { findMany: mocks.orgCourseFindMany },
    dailyTest: { findMany: mocks.dailyTestFindMany },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
    projectTask: { findMany: mocks.projectTaskFindMany },
    dailyLog: { findMany: mocks.dailyLogFindMany },
    interaction: { findMany: mocks.interactionFindMany },
  },
}));

import { GET } from "./route";

async function callAs(role: string) {
  mocks.getAuthUser.mockResolvedValue({ sub: role + "-1", role });
  return GET(new NextRequest("http://localhost/api/instructor/student-briefing?studentId=learner-1"));
}

describe("GET /api/instructor/student-briefing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPortalEnabled.mockResolvedValue(true);
    mocks.userFindUnique.mockResolvedValue({
      id: "learner-1",
      name: "Learner",
      role: "learner",
    });
    mocks.courseEnrollmentFindMany.mockResolvedValue([]);
    mocks.orgMemberFindMany.mockResolvedValue([]);
    mocks.orgCourseFindMany.mockResolvedValue([]);
    mocks.dailyTestFindMany.mockResolvedValue([]);
    mocks.weeklyTestFindMany.mockResolvedValue([]);
    mocks.projectTaskFindMany.mockResolvedValue([]);
    mocks.dailyLogFindMany.mockResolvedValue([]);
    mocks.interactionFindMany.mockResolvedValue([]);
  });

  it("scopes every briefing query to the instructor's shared courses", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }: {
      where: { userId: string; courseId?: { in: string[] } };
    }) => (
      where.userId === "instructor-1"
        ? [{ courseId: "course-a" }]
        : ["course-a", "course-b"]
            .filter((courseId) => where.courseId?.in.includes(courseId))
            .map((courseId) => ({ courseId }))
    ));

    const response = await callAs("instructor");
    const body = await response.json();

    expect(response.status).toBe(200);
    for (const query of [
      mocks.dailyTestFindMany,
      mocks.weeklyTestFindMany,
      mocks.projectTaskFindMany,
      mocks.dailyLogFindMany,
      mocks.interactionFindMany,
    ]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: "learner-1", courseId: { in: ["course-a"] } },
      }));
    }
    expect(body.status).toBe("unavailable");
    expect(body.avgScore).toBeNull();
    expect(body.briefing).toContain("There are no scored assessments available");
  });

  it("limits organisation-admin briefings to courses in active organisation memberships", async () => {
    mocks.orgMemberFindMany.mockResolvedValue([{ orgId: "org-1" }]);
    mocks.orgCourseFindMany.mockResolvedValue([{ courseId: "course-a" }]);
    mocks.courseEnrollmentFindMany.mockResolvedValue([{ courseId: "course-a" }]);

    const response = await callAs("org_admin");

    expect(response.status).toBe(200);
    expect(mocks.orgMemberFindMany).toHaveBeenCalledWith({
      where: { userId: "org_admin-1", role: "admin", status: "active" },
      select: { orgId: true },
    });
    expect(mocks.dailyTestFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "learner-1", courseId: { in: ["course-a"] } },
    }));
  });

  it("denies org admins with no shared organisation course", async () => {
    mocks.orgMemberFindMany.mockResolvedValue([{ orgId: "org-1" }]);
    mocks.orgCourseFindMany.mockResolvedValue([{ courseId: "course-a" }]);
    mocks.courseEnrollmentFindMany.mockResolvedValue([]);

    const response = await callAs("org_admin");

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.dailyTestFindMany).not.toHaveBeenCalled();
  });

  it("does not allow platform admins or demo accounts to retrieve individual briefings", async () => {
    expect((await callAs("platform_admin")).status).toBe(403);
    expect((await callAs("demo")).status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.dailyTestFindMany).not.toHaveBeenCalled();
  });

  it("does not treat missing interaction correctness or missing assessments as zero-score evidence", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }: {
      where: { userId: string; courseId?: { in: string[] } };
    }) => (
      where.userId === "instructor-1" ? [{ courseId: "course-a" }] : [{ courseId: "course-a" }]
    ));
    mocks.interactionFindMany.mockResolvedValue([{
      topic: "React",
      correctness: null,
      date: new Date(),
    }]);

    const response = await callAs("instructor");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("unavailable");
    expect(body.avgScore).toBeNull();
    expect(body.weakTopics).toEqual([]);
  });
});
