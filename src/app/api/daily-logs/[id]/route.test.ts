import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  assertCanAccessStudent: vi.fn(),
  demoWriteBlock: vi.fn(),
  dailyLogFindUnique: vi.fn(),
  commentCount: vi.fn(),
  dailyLogDelete: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthUser: mocks.getAuthUser,
  assertCanAccessStudent: mocks.assertCanAccessStudent,
}));
vi.mock("@/lib/demo-guard", () => ({ demoWriteBlock: mocks.demoWriteBlock }));
vi.mock("@/lib/db", () => ({
  db: {
    dailyLog: { findUnique: mocks.dailyLogFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { DELETE } from "./route";

const context = { params: Promise.resolve({ id: "log-1" }) };

describe("DELETE /api/daily-logs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.demoWriteBlock.mockResolvedValue(null);
    mocks.getAuthUser.mockResolvedValue({ sub: "learner-1", role: "learner", email: "learner@example.test", name: "Learner" });
    mocks.assertCanAccessStudent.mockResolvedValue(undefined);
    mocks.dailyLogFindUnique.mockResolvedValue({ userId: "learner-1" });
    mocks.commentCount.mockResolvedValue(0);
    mocks.dailyLogDelete.mockResolvedValue({ id: "log-1" });
    mocks.transaction.mockImplementation((callback) => callback({
      comment: { count: mocks.commentCount },
      dailyLog: { delete: mocks.dailyLogDelete },
    }));
  });

  it("preserves instructor feedback and refuses to delete its check-in", async () => {
    mocks.commentCount.mockResolvedValue(1);

    const response = await DELETE(
      new NextRequest("http://localhost/api/daily-logs/log-1", { method: "DELETE" }),
      context,
    );

    if (!response) throw new Error("Expected a DELETE response");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("mentor feedback") });
    expect(mocks.commentCount).toHaveBeenCalledWith({ where: { dailyLogId: "log-1" } });
    expect(mocks.dailyLogDelete).not.toHaveBeenCalled();
  });

  it("deletes a check-in when no instructor feedback is attached", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/daily-logs/log-1", { method: "DELETE" }),
      context,
    );

    if (!response) throw new Error("Expected a DELETE response");
    expect(response.status).toBe(200);
    expect(mocks.dailyLogDelete).toHaveBeenCalledWith({ where: { id: "log-1" } });
  });
});
