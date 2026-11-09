import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLES,
  PLATFORM_ADMIN_ROLES,
  UserRole,
  hasRole,
  normalizeRole,
} from "../rbac";

describe("role normalization and privilege boundaries", () => {
  it("normalizes legacy role aliases consistently", () => {
    expect(normalizeRole("administrator")).toBe(UserRole.PLATFORM_ADMIN);
    expect(normalizeRole("admin")).toBe(UserRole.PLATFORM_ADMIN);
    expect(normalizeRole("coordinator")).toBe(UserRole.ORG_ADMIN);
    expect(normalizeRole("principal")).toBe(UserRole.ORG_ADMIN);
    expect(normalizeRole("student")).toBe(UserRole.LEARNER);
    expect(normalizeRole("teacher")).toBe(UserRole.INSTRUCTOR);
  });

  it("grants implicit platform scope only to platform administrators", () => {
    expect(hasRole("platform_admin", PLATFORM_ADMIN_ROLES)).toBe(true);
    expect(hasRole("administrator", PLATFORM_ADMIN_ROLES)).toBe(true);
    expect(hasRole("admin", PLATFORM_ADMIN_ROLES)).toBe(true);
    expect(hasRole("org_admin", PLATFORM_ADMIN_ROLES)).toBe(false);
    expect(hasRole("coordinator", PLATFORM_ADMIN_ROLES)).toBe(false);
    expect(hasRole("demo", PLATFORM_ADMIN_ROLES)).toBe(false);
  });

  it("keeps demo inside the staff/admin compatibility sets without making it platform-wide", () => {
    expect(hasRole("demo", ADMIN_ROLES)).toBe(true);
    expect(hasRole("demo", PLATFORM_ADMIN_ROLES)).toBe(false);
  });
});
