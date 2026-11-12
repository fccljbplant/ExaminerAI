import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { isCronAuthorized } from "../cron-auth";

function request(authorization: string | null): NextRequest {
  return {
    headers: new Headers(authorization ? { authorization } : undefined),
  } as NextRequest;
}

describe("isCronAuthorized", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("denies production requests when CRON_SECRET is not configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronAuthorized(request(null))).toBe(false);
    expect(isCronAuthorized(request("Bearer arbitrary"))).toBe(false);
  });

  it("requires an exact configured bearer token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "configured-cron-secret");
    expect(isCronAuthorized(request("Bearer configured-cron-secret"))).toBe(true);
    expect(isCronAuthorized(request("Bearer wrong"))).toBe(false);
    expect(isCronAuthorized(request(null))).toBe(false);
  });
});
