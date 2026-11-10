import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  getStaffAuthorizedStudentCourseIds: vi.fn(),
  userFindUnique: vi.fn(),
  courseEnrollmentFindFirst: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  interactionFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    courseEnrollment: { findFirst: mocks.courseEnrollmentFindFirst },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
    interaction: { findMany: mocks.interactionFindMany },
  },
}));
vi.mock("@/modules/instructor-portal/authorized-student-courses", () => ({
  getStaffAuthorizedStudentCourseIds: mocks.getStaffAuthorizedStudentCourseIds,
}));

import { GET } from "./route";

function request(courseId?: string, userId = "learner-1") {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
  return GET(
    new NextRequest(`http://localhost/api/growth-reports/${userId}${query}`),
    { params: Promise.resolve({ userId }) },
  );
}

describe("GET /api/growth-reports/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });
    mocks.assertCanAccessStudent.mockResolvedValue(true);
    mocks.getStaffAuthorizedStudentCourseIds.mockResolvedValue(["course-a", "course-b"]);
    mocks.userFindUnique.mockResolvedValue({ id: "learner-1" });
    mocks.weeklyTestFindMany.mockResolvedValue([{ week: 1, score: 80 }, { week: 2, score: 60 }]);
    mocks.interactionFindMany.mockResolvedValue([{ correctness: 0 }, { correctness: 100 }]);
  });

  it("requires staff to request a specific course", async () => {
    const response = await request();
    expect(response.status).toBe(400);
    expect(mocks.weeklyTestFindMany).not.toHaveBeenCalled();
    expect(mocks.interactionFindMany).not.toHaveBeenCalled();
  });

  it("denies a course outside the staff/learner authorised intersection", async () => {
    const response = await request("course-outside");
    expect(response.status).toBe(403);
    expect(mocks.weeklyTestFindMany).not.toHaveBeenCalled();
    expect(mocks.interactionFindMany).not.toHaveBeenCalled();
  });

  it("filters every assessment source to the selected course and counts measured zero practice scores", async () => {
    const response = await request("course-b");
    expect(response.status).toBe(200);
    expect(mocks.weeklyTestFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "learner-1", status: "completed", score: { not: null }, courseId: "course-b" },
    }));
    expect(mocks.interactionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "learner-1", courseId: "course-b" },
      orderBy: { date: "desc" },
      take: 500,
    }));
    const body = await response.json();
    const snapshot = JSON.parse(body.report.dimensionSnapshot);
    expect(body.report.courseId).toBe("course-b");
    expect(snapshot).toMatchObject({
      performanceScore: 60,
      avgTestScore: 70,
      avgPracticeScore: 50,
      testCount: 2,
      practiceCount: 2,
    });
  });

  it("returns unavailable score values instead of fabricated zeroes when the course has no evidence", async () => {
    mocks.weeklyTestFindMany.mockResolvedValue([]);
    mocks.interactionFindMany.mockResolvedValue([]);

    const response = await request("course-a");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.parse(body.report.dimensionSnapshot)).toEqual({
      performanceScore: null,
      avgTestScore: null,
      avgPracticeScore: null,
      testCount: 0,
      practiceCount: 0,
    });
    expect(JSON.parse(body.report.growthAreas)).toEqual([
      "Insufficient course-specific assessment and practice evidence for a performance assessment.",
    ]);
  });

  it("lets a learner request only a course in their own enrolments", async () => {
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner" });
    mocks.courseEnrollmentFindFirst.mockResolvedValue(null);

    const response = await request("course-outside");
    expect(response.status).toBe(403);
    expect(mocks.weeklyTestFindMany).not.toHaveBeenCalled();
  });
});
