import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  dailyLogFindMany: vi.fn(),
  demoWriteBlock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/db", () => ({ db: { dailyLog: { findMany: mocks.dailyLogFindMany } } }));

import { GET } from "./route";

describe("GET /api/daily-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "learner-1" });
    mocks.dailyLogFindMany.mockResolvedValue([]);
  });

  it("filters history by both the authenticated learner and selected course", async () => {
    const request = new NextRequest("http://localhost/api/daily-logs?courseId=course-a");

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.dailyLogFindMany).toHaveBeenCalledWith({
      where: { userId: "learner-1", courseId: "course-a" },
      orderBy: { date: "desc" },
    });
  });

  it("keeps the authenticated learner boundary when no course filter is supplied", async () => {
    const request = new NextRequest("http://localhost/api/daily-logs");

    await GET(request);

    expect(mocks.dailyLogFindMany).toHaveBeenCalledWith({
      where: { userId: "learner-1" },
      orderBy: { date: "desc" },
    });
  });
});
