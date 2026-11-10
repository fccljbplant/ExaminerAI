import { describe, it, expect } from "vitest";
import { homeForRole } from "../portal-home";
import { resolveHomeForUser } from "../portal-home-server";

describe("homeForRole", () => {
  it("maps each role to its portal", () => {
    expect(homeForRole("platform_admin")).toBe("/platform");
    expect(homeForRole("admin")).toBe("/platform"); // legacy alias
    expect(homeForRole("org_admin")).toBe("/org");
    expect(homeForRole("instructor")).toBe("/instructor");
    expect(homeForRole("learner")).toBe("/learner");
    expect(homeForRole("student")).toBe("/learner");
    expect(homeForRole("demo")).toBe("/learn"); // demo role is not admitted by learner layout
  });

  it("falls back to /learn for unknown roles", () => {
    expect(homeForRole("guardian")).toBe("/learn");
    expect(homeForRole("")).toBe("/learn");
  });
});

describe("resolveHomeForUser", () => {
  it("routes platform admins according to the platform portal flag", async () => {
    expect(await resolveHomeForUser({ role: "platform_admin" }, { platform: true })).toBe("/platform");
    expect(await resolveHomeForUser({ role: "admin" }, { platform: true })).toBe("/platform");
    expect(await resolveHomeForUser({ role: "platform_admin" }, { platform: false })).toBe("/learn");
  });

  it("routes learner to /learner when the learner portal is enabled", async () => {
    expect(await resolveHomeForUser({ role: "learner" }, { learner: true })).toBe("/learner");
    expect(await resolveHomeForUser({ role: "studen¶»§q«^