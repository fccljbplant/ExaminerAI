import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  courseEnrollmentFindMany: vi.fn(),
  userFindMany: vi.fn(),
  weeklyTestFindMany: vi.fn(),
  dailyLogGroupBy: vi.fn(),
  projectTaskFindMany: vi.fn(),
  isPortalEnabled: vi.fn(),
  apiSuccess: vi.fn((data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 })),
  apiUnauthorized: vi.fn(() => new Response(null, { status: 401 })),
  apiError: vi.fn((message: string, code: string, status: number) =>
    new Response(JSON.stringify({ ok: false, message, code }), { status }),
  ),
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/db", () => ({
  db: {
    courseEnrollment: { findMany: mocks.courseEnrollmentFindMany },
    user: { findMany: mocks.userFindMany },
    weeklyTest: { findMany: mocks.weeklyTestFindMany },
    dailyLog: { groupBy: mocks.dailyLogGroupBy },
    projectTask: { findMany: mocks.projectTaskFindMany },
  },
}));
vi.mock("@/lib/feature-flags", () => ({ isPortalEnabled: mocks.isPortalEnabled }));
vi.mock("@/lib/api-response", () => ({
  apiSuccess: mocks.apiSuccess,
  apiUnauthorized: mocks.apiUnauthorized,
  apiError: mocks.apiError,
}));

import { GET } from "./route";

describe("GET /api/v2/instructor/students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "instructor-1", role: "instructor" });
    mocks.isPortalEnabled.mockResolvedValue(true);
    mocks.courseEnrollmentFindMany.mockImplementation(async ({ where }) => {
      if (where.role === "instructor") return [{ courseId: "course-1" }];
      return [{ userId: "learner-1" }];
    });
    mocks.userFindMany.mockResolvedValue([
      { id: "learner-1", name: "Learner One", email: "learner@example.test" },
    ]);
    mocks.weeklyTestFindMany.mockResolvedValue([
      { userId: "learner-1", week: 3, score: 55, status: "graded" },
      { userId: "learner-1", week: 5, score: null, status: "pending" },
      { userId: "learner-1", week: 4, score: 80, status: "graded" },
    ]);
    mocks.dailyLogGroupBy.mockResolvedValue([
      { userId: "learner-1", _max: { date: new Date("2026-11-10T10:00:00.000Z") } },
    ]);
    mocks.projectTaskFindMany.mockResolvedValue([
      { userId: "learner-1", status: "completed" },
      { userId: "learner-1", status: "planned" },
    ]);
  });

  it("aggregates latest activity and restricts learner activity to taught courses", async () => {
    const response = await GET(new NextRequest("https://example.test/api/v2/instructor/students"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.items[0]).toMatchObject({
      id: "learner-1", latestScore: 80, progress: 50, lastCheckIn: "2026-11-10T10:00:00.000Z",
    });
    expect(mocks.dailyLogGroupBy).toHaveBeenCalledWith({
      by: ["userId"],
      where: { userId: { in: ["learner-1"] }, courseId: { in: ["course-1"] } },
      _max: { date: true },
    });
    expect(mocks.projectTaskFindMany).toHaveBeenCalledWith({
      where: { userId: { in: ["learner-1"] }, courseId: { in: ["course-1"] } },
      select: { userId: true, status: true },
    });
    expect(mocks.weeklyTestFindMany).toHaveBeenCalledWith({
      where: { userId: { in: ["learner-1"] }, courseId: { in: ["course-1"] } },
      select: { userId: true, week: true, score: true, status: true },
    });
  });

  it("does not query learner activity when the instructor has no taught courses", async () => {
    mocks.courseEnrollmentFindMany.mockResolvedValueOnce([]);
    const response = await GET(new NextRequest("https://example.test/api/v2/instructor/students"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ items: [], total: 0 });
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.dailyLogGroupBy).not.toHaveBeenCalled();
    expect(mocks.projectTaskFindMany).not.toHaveBeenCalled();
  });
});
