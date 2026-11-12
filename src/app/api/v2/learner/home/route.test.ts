import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    courseEnrollment: { findMany: vi.fn() },
    learnProfile: { findMany: vi.fn() },
    learnDailyTest: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
    learnProject: { findMany: vi.fn() },
    course: { findMany: vi.fn() },
  },
  getAuthUser: vi.fn(),
  apiError: vi.fn((message: string, code: string, status: number) => ({ message, code, status })),
  apiSuccess: vi.fn((data: unknown) => ({ data })),
  apiUnauthorized: vi.fn(() => ({ unauthorized: true })),
  getTodayTopic: vi.fn(),
  getLearnerLevel: vi.fn(() => ({ name: "Novice" })),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/api-response", () => ({
  apiError: mocks.apiError,
  apiSuccess: mocks.apiSuccess,
  apiUnauthorized: mocks.apiUnauthorized,
}));
vi.mock("@/modules/learn/lib/today-topic", () => ({ getTodayTopic: mocks.getTodayTopic }));
vi.mock("@/modules/learn/lib/xp-ledger", () => ({ getLearnerLevel: mocks.getLearnerLevel }));

import { GET } from "./route";

describe("GET /api/v2/learner/home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1" });
    mocks.db.courseEnrollment.findMany.mockResolvedValue([]);
    mocks.db.learnProfile.findMany.mockResolvedValue([]);
    mocks.db.learnDailyTest.findMany.mockResolvedValue([]);
    mocks.db.notification.findMany.mockResolvedValue([]);
    mocks.db.learnProject.findMany.mockResolvedValue([]);
    mocks.db.course.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns service unavailable when enrollment profiles cannot be read", async () => {
    mocks.db.courseEnrollment.findMany.mockResolvedValue([
      { courseId: "course-1", course: { id: "course-1", name: "Course One" } },
    ]);
    mocks.db.learnProfile.findMany.mockRejectedValue(new Error("table unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await GET();

    expect(mocks.apiError).toHaveBeenCalledWith(
      "Your dashboard is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
    expect(mocks.apiSuccess).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(mocks.db.learnDailyTest.findMany).not.toHaveBeenCalled();
  });

  it("returns service unavailable when project data cannot be read", async () => {
    mocks.db.courseEnrollment.findMany.mockResolvedValue([
      { courseId: "course-1", course: { id: "course-1", name: "Course One" } },
    ]);
    mocks.db.learnProject.findMany.mockRejectedValue(new Error("table unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await GET();

    expect(mocks.apiError).toHaveBeenCalledWith(
      "Your dashboard is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
    expect(mocks.apiSuccess).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });


  it("uses student enrollments for course counts and scopes progress and daily tests", async () => {
    mocks.db.courseEnrollment.findMany.mockResolvedValue([
      { courseId: "course-1", course: { id: "course-1", name: "Course One" } },
      { courseId: "course-2", course: { id: "course-2", name: "Course Two" } },
    ]);
    mocks.db.learnProfile.findMany.mockResolvedValue([
      {
        courseId: "course-1",
        course: { id: "course-1", name: "Course One" },
        totalXP: 120,
        streakCurrent: 4,
      },
    ]);
    mocks.getTodayTopic.mockResolvedValue({
      topic: { week: 1, day: 1, title: "Foundations" },
      completed: false,
    });

    await GET();

    const payload = mocks.apiSuccess.mock.calls[0][0] as {
      learner: { enrolledCount: number; totalXP: number; streakCurrent: number };
      continue: { courseId: string; kind: string } | null;
    };
    expect(payload.learner).toMatchObject({ enrolledCount: 2, totalXP: 120, streakCurrent: 4 });
    expect(payload.continue).toMatchObject({ courseId: "course-1", kind: "learn" });
    expect(mocks.db.learnProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "learner-1", courseId: { in: ["course-1", "course-2"] } },
      }),
    );
    expect(mocks.db.learnDailyTest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ courseId: { in: ["course-1", "course-2"] } }),
      }),
    );
  });

  it("offers a start action when an enrolled learner has no progress profile yet", async () => {
    mocks.db.courseEnrollment.findMany.mockResolvedValue([
      { courseId: "course-1", course: { id: "course-1", name: "Course One" } },
    ]);

    await GET();

    const payload = mocks.apiSuccess.mock.calls[0][0] as {
      learner: { enrolledCount: number };
      continue: { courseId: string; kind: string; nextLesson: string } | null;
    };
    expect(payload.learner.enrolledCount).toBe(1);
    expect(payload.continue).toMatchObject({
      courseId: "course-1",
      kind: "start",
      nextLesson: "Start your first study session",
    });
    expect(mocks.getTodayTopic).not.toHaveBeenCalled();
  });

  it("does not query progress or daily tests when the learner has no student enrollments", async () => {
    await GET();

    const payload = mocks.apiSuccess.mock.calls[0][0] as { learner: { enrolledCount: number }; continue: unknown };
    expect(payload.learner.enrolledCount).toBe(0);
    expect(payload.continue).toBeNull();
    expect(mocks.db.learnProfile.findMany).not.toHaveBeenCalled();
    expect(mocks.db.learnDailyTest.findMany).not.toHaveBeenCalled();
    expect(mocks.db.learnProject.findMany).not.toHaveBeenCalled();
  });

  it("returns service unavailable when student enrollments cannot be read", async () => {
    mocks.db.courseEnrollment.findMany.mockRejectedValue(new Error("table unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await GET();

    expect(mocks.apiError).toHaveBeenCalledWith(
      "Your dashboard is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
    expect(mocks.apiSuccess).not.toHaveBeenCalled();
    expect(mocks.db.learnProfile.findMany).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("shows only course-owned projects in the learner's current student enrolments", async () => {
    mocks.db.courseEnrollment.findMany.mockResolvedValue([
      { courseId: "course-1", course: { id: "course-1", name: "Course One" } },
      { courseId: "course-2", course: { id: "course-2", name: "Course Two" } },
    ]);
    mocks.db.learnProject.findMany.mockResolvedValue([
      {
        id: "project-1",
        title: "Course Project",
        status: "active",
        courseId: "course-1",
        tasks: [
          { id: "task-1", status: "completed" },
          { id: "task-2", status: "pending" },
        ],
      },
      {
        id: "legacy-project",
        title: "Legacy Personal Project",
        status: "active",
        courseId: null,
        tasks: [],
      },
    ]);

    await GET();

    expect(mocks.db.learnProject.findMany).toHaveBeenCalledWith({
      where: {
        userId: "learner-1",
        courseId: { in: ["course-1", "course-2"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { tasks: { select: { id: true, status: true } } },
    });
    const payload = mocks.apiSuccess.mock.calls[0][0] as {
      projects: Array<{ id: string; courseName: string; taskProgress: number; tasksDone: string }>;
    };
    expect(payload.projects).toEqual([
      {
        id: "project-1",
        title: "Course Project",
        status: "active",
        courseName: "Course One",
        taskProgress: 50,
        tasksDone: "1/2",
      },
    ]);
    expect(mocks.db.course.findMany).not.toHaveBeenCalled();
  });

  it("returns a successful empty project list when the query succeeds with no rows", async () => {
    await GET();

    expect(mocks.apiSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ projects: [] }),
    );
    expect(mocks.apiError).not.toHaveBeenCalled();
  });
});
