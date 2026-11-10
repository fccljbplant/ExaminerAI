import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  courseEnrollmentFindMany: vi.fn(),
  orgMemberFindMany: vi.fn(),
  orgCourseFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    courseEnrollment: { findMany: mocks.courseEnrollmentFindMany },
    orgMember: { findMany: mocks.orgMemberFindMany },
    orgCourse: { findMany: mocks.orgCourseFindMany },
  },
}));

import { getStaffAuthorizedStudentCourseIds } from "./authorized-student-courses";

describe("getStaffAuthorizedStudentCourseIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("intersects instructor teaching courses with learner enrolments", async () => {
    mocks.courseEnrollmentFindMany
      .mockResolvedValueOnce([{ courseId: "course-a" }, { courseId: "course-b" }])
      .mockResolvedValueOnce([{ courseId: "course-b" }, { courseId: "course-c" }]);

    await expect(getStaffAuthorizedStudentCourseIds(
      { sub: "instructor-1", role: "instructor" } as never,
      "learner-1",
    )).resolves.toEqual(["course-b"]);
  });

  it("limits org admins to active shared organisations and linked learner courses", async () => {
    mocks.courseEnrollmentFindMany.mockResolvedValue([{ courseId: "course-a" }, { courseId: "course-b" }]);
    mocks.orgMemberFindMany
      .mockResolvedValueOnce([{ orgId: "org-1" }])
      .mockResolvedValueOnce([{ orgId: "org-1" }]);
    mocks.orgCourseFindMany.mockResolvedValue([{ courseId: "course-b" }, { courseId: "course-c" }]);

    await expect(getStaffAuthorizedStudentCourseIds(
      { sub: "admin-1", role: "org_admin" } as never,
      "learner-1",
    )).resolves.toEqual(["course-b"]);
    expect(mocks.orgMemberFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { userId: "admin-1", role: "admin", status: "active" },
    }));
    expect(mocks.orgMemberFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { userId: "learner-1", orgId: { in: ["org-1"] }, status: "active" },
    }));
  });

  it("bounds platform admins to courses in which the learner is enrolled", async () => {
    mocks.courseEnrollmentFindMany.mockResolvedValue([{ courseId: "course-a" }]);

    await expect(getStaffAuthorizedStudentCourseIds(
      { sub: "platform-1", role: "platform_admin" } as never,
      "learner-1",
    )).resolves.toEqual(["course-a"]);
    expect(mocks.courseEnrollmentFindMany).toHaveBeenCalledTimes(1);
  });

  it("returns no courses when the learner has no course enrolments", async () => {
    mocks.courseEnrollmentFindMany.mockResolvedValue([]);

    await expect(getStaffAuthorizedStudentCourseIds(
      { sub: "instructor-1", role: "instructor" } as never,
      "learner-1",
    )).resolves.toEqual([]);
    expect(mocks.courseEnrollmentFindMany).toHaveBeenCalledTimes(1);
  });
});
