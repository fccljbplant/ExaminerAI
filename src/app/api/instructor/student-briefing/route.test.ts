import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  getStaffAuthorizedStudentCourseIds: vi.fn(),
  userFindUnique: vi.fn(),
  dailyTestFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  projectTaskFindMany: vi.fn(),
  dailyLogFindMany: vi.fn(),
  interactionFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    dailyTest: { findMany: mocks.dailyTestFindMany },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
    projectTask: { findMany: mocks.projectTaskFindMany },
    dailyLog: { findMany: mocks.dailyLogFindMany },
    interaction: { findMany: mocks.interactionFindMany },
  },
}));
vi.mock("@/modules/instructor-portal/authorized-student-courses", () => ({
  getStaffAuthorizedStudentCourseIds: mocks.getStaffAuthorizedStudentCourseIds,
}));

import { GET } from "./route";

function request(courseId?: string) {
  const query = new URLSearchParams({ studentId: "learner-1" });
  if (courseId) query.set("courseId", courseId);
  return GET(new NextRequest(`http://localhost/api/instructor/student-briefing?${query.toString()}`));
}

describe("GET /api/instructor/student-briefing course scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.getStaffAuthorizedStudentCourseIds.mockResolvedValue(["course-a"]);
    mocks.userFindUnique.mockResolvedValue({ id: "learner-1", name: "Learner", role: "learner" });
    mocks.dailyTestFindMany.mockResolvedValue([]);
    mocks.weeklyTestFindMany.mockResolvedValue([]);
    mocks.projectTaskFindMany.mockResolvedValue([]);
    mocks.dailyLogFindMany.mockResolvedValue([]);
    mocks.interactionFindMany.mockResolvedValue([]);
  });

  it("requires an explicit course before loading learner evidence", async () => {
    const response = await request();
    expect(response.status).toBe(400);
    expect(mocks.dailyTestFindMany).not.toHaveBeenCalled();
    expect(mocks.weeklyTestFindMany).not.toHaveBeenCalled();
  });

  it("denies courses outside the authorised staff/learner intersection", async () => {
    const response = await request("course-outside");
    expect(response.status).toBe(403);
    expect(mocks.dailyTestFindMany).not.toHaveBeenCalled();
  });

  it("filters every source to the selected course and represents missing evidence as insufficient", async () => {
    const response = await request("course-a");
    expect(response.status).toBe(200);
    for (const query of [
      mocks.dailyTestFindMany,
      mocks.weeklyTestFindMany,
      mocks.projectTaskFindMany,
      mocks.dailyLogFindMany,
      mocks.interactionFindMany,
    ]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: "learner-1", courseId: "course-a" },
      }));
    }
    const body = await response.json();
    expect(body.courseId).toBe("course-a");
    expect(body.status).toBe("insufficient_data");
    expect(body.avgScore).toBeNull();
    expect(body.week).toBeNull();
    expect(body.day).toBeNull();
    expect(body.briefing).toContain("No curriculum activity is recorded");
    expect(body.briefing).not.toContain("Week 1, Day 1");
  });
});
