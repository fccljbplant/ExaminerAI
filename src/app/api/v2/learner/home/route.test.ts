import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
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
    mocks.db.learnProfile.findMany.mockResolvedValue([]);
    mocks.db.learnDailyTest.findMany.mockResolvedValue([]);
    mocks.db.notification.findMany.mockResolvedValue([]);
    mocks.db.learnProject.findMany.mockResolvedValue([]);
    mocks.db.course.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns service unavailable when project data cannot be read", async () => {
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

  it("returns a successful empty project list when the query succeeds with no rows", async () => {
    await GET();

    expect(mocks.apiSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ projects: [] }),
    );
    expect(mocks.apiError).not.toHaveBeenCalled();
  });
});
