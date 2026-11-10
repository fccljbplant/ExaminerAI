import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  userFindUnique: vi.fn(),
  courseEnrollmentFindMany: vi.fn(),
  courseFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  reportCardFindMany: vi.fn(),
  skillMasteryFindMany: vi.fn(),
  dailyLogFindMany: vi.fn(),
  projectTaskFindMany: vi.fn(),
  certificateFindMany: vi.fn(),
  engagementEventFindMany: vi.fn(),
  learnProjectFindMany: vi.fn(),
  isPortalEnabled: vi.fn(),
  computePsychWeekly: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    courseEnrollment: { findMany: mocks.courseEnrollmentFindMany },
    course: { findMany: mocks.courseFindMany },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
    reportCard: { findMany: mocks.reportCardFindMany },
    skillMastery: { findMany: mocks.skillMasteryFindMany },
    dailyLog: { findMany: mocks.dailyLogFindMany },
    projectTask: { findMany: mocks.projectTaskFindMany },
    certificate: { findMany: mocks.certificateFindMany },
    engagementEvent: { findMany: mocks.engagementEventFindMany },
    learnProject: { findMany: mocks.learnProjectFindMany },
  },
}));
vi.mock("@/lib/rbac", () => ({
  normalizeRole: (role: string) => role,
  UserRole: { LEARNER: "learner" },
}));
vi.mock("@/lib/feature-flags", () => ({ isPortalEnabled: mocks.isPortalEnabled }));
vi.mock("@/modules/learn/lib/psych-weekly", () => ({
  computePsychWeekly: mocks.computePsychWeekly,
}));

import { GET } from "./route";

const learnerId = "learner-1";
const instructorId = "instructor-1";
const academicQueries = [
  mocks.weeklyTestFindMany,
  mocks.reportCardFindMany,
  mocks.skillMasteryFindMany,
  mocks.dailyLogFindMany,
  mocks.projectTaskFindMany,
  mocks.certificateFindMany,
  mocks.engagementEventFindMany,
  mocks.learnProjectFindMany,
];

function request(courseId?: string) {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
  return GET(
    new NextRequest(`http://localhost/api/v2/instructor/students/${learnerId}${query}`),
    { params: Promise.resolve({ id: learnerId }) },
  );
}

describe("GET /api/v2/instructor/students/[id] course selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: instructorId, role: "instructor" });
    mocks.isPortalEnabled.mockResolvedValue(true);
    mocks.userFindUnique.mockResolvedValue({
      id: learnerId,
      name: "Learner",
      email: "learner@example.test",
      role: "learner",
      lastLogin: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => (
      where.userId === instructorId
        ? [{ courseId: "course-a" }, { courseId: "course-b" }]
        : [{ courseId: "course-a" }, { courseId: "course-b" }, { courseId: "course-outside" }]
    ));
    mocks.courseFindMany.mockResolvedValue([
      { id: "course-a", name: "Course A" },
      { id: "course-b", name: "Course B" },
    ]);
    for (const query of academicQueries) query.mockResolvedValue([]);
    mocks.computePsychWeekly.mockResolvedValue(null);
  });

  it("returns course choices and performs no academic queries until a multi-course choice is made", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.courseSelectionRequired).toBe(true);
    expect(body.data.courses).toEqual([
      { id: "course-a", name: "Course A" },
      { id: "course-b", name: "Course B" },
    ]);
    for (const query of academicQueries) expect(query).not.toHaveBeenCalled();
    expect(mocks.computePsychWeekly).not.toHaveBeenCalled();
  });

  it("loads every course-bearing record only for the explicitly selected course", async () => {
    const response = await request("course-b");
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.courseId).toBe("course-b");
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
        where: { userId: learnerId, courseId: "course-b" },
      }));
    }
    expect(mocks.skillMasteryFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: learnerId },
    }));
  });

  it("denies a course outside the current authorised intersection before querying academic records", async () => {
    const response = await request("course-outside");
    expect(response.status).toBe(403);
    for (const query of academicQueries) expect(query).not.toHaveBeenCalled();
  });

  it("automatically selects the only shared course", async () => {
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => (
      where.userId === instructorId ? [{ courseId: "course-a" }] : [{ courseId: "course-a" }]
    ));
    mocks.courseFindMany.mockResolvedValue([{ id: "course-a", name: "Course A" }]);

    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.courseId).toBe("course-a");
    expect(mocks.weeklyTestFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: learnerId, courseId: "course-a" },
    }));
  });
});
