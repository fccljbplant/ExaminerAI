import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../db", () => ({
  db: { user: { findUnique: vi.fn() } },
  enterDemoSessionBox: vi.fn(() => ({ demo: false })),
}));

import { cookies } from "next/headers";
import { db } from "../db";
import { getAuthUser, signToken, type JwtPayload } from "../auth";

const payload: JwtPayload = {
  sub: "db-outage-user",
  email: "learner@example.invalid",
  role: "student",
  name: "Test Learner",
};

describe("getAuthUser fail-closed behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies access when the authoritative identity lookup fails without a fresh cache entry", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: signToken(payload) }),
    } as never);
    vi.mocked(db.user.findUnique).mockRejectedValue(new Error("database unavailable"));

    await expect(getAuthUser()).resolves.toBeNull();
  });
});
