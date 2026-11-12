import { describe, expect, it } from "vitest";
import { getMiddlewareJwtSecret, isCronAuthorizationValid } from "../auth-policy";

describe("middleware JWT secret policy", () => {
  it("uses the configured secret", () => {
    expect(getMiddlewareJwtSecret({ NODE_ENV: "production", JWT_SECRET: "configured-secret" })).toBe("configured-secret");
  });

  it("fails closed in production when the secret is missing", () => {
    expect(getMiddlewareJwtSecret({ NODE_ENV: "production" })).toBeNull();
    expect(getMiddlewareJwtSecret({ NODE_ENV: "production", JWT_SECRET: "" })).toBeNull();
  });

  it("retains the development secret only outside production", () => {
    expect(getMiddlewareJwtSecret({ NODE_ENV: "development" })).toBe("examiner-ai-dev-secret-change-me");
    expect(getMiddlewareJwtSecret({ NODE_ENV: "test" })).toBe("examiner-ai-dev-secret-change-me");
  });
});

describe("cron authorization policy", () => {
  it("denies production cron requests when CRON_SECRET is missing", () => {
    expect(isCronAuthorizationValid(null, { NODE_ENV: "production" })).toBe(false);
    expect(isCronAuthorizationValid("Bearer anything", { NODE_ENV: "production" })).toBe(false);
  });

  it("allows unconfigured cron requests only outside production", () => {
    expect(isCronAuthorizationValid(null, { NODE_ENV: "development" })).toBe(true);
    expect(isCronAuthorizationValid(null, { NODE_ENV: "test" })).toBe(true);
  });

  it("requires an exact bearer token when CRON_SECRET is configured", () => {
    const env = { NODE_ENV: "test", CRON_SECRET: "cron-secret" };
    expect(isCronAuthorizationValid("Bearer cron-secret", env)).toBe(true);
    expect(isCronAuthorizationValid("bearer cron-secret", env)).toBe(false);
    expect(isCronAuthorizationValid("Bearer wrong", env)).toBe(false);
    expect(isCronAuthorizationValid(null, env)).toBe(false);
  });
});
