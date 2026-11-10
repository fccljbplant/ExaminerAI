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
    expect(homeForRole("demo")).toBe("/learner");
  });

  it("falls back to /learn for unknown roles", () => {
    expect(homeForRole("guardian")).toBe("/learn");
    expect(homeForRole("")).toBe("/learn");
  });
});

describe("resolveHomeForUser", () => {
  it("routes platform_admin straight to /platform regardless of flags", async () => {
    expect(await resolveHomeForUser({ role: "platform_admin" }, { learner: false })).toBe("/platform");
    expect(await resolveHomeForUser({ role: "admin" }, { org: false })).toBe("/platform");
  });

  it("routes learner to /learner when the learner portal is enabled", async () => {
    expect(await resolveHomeForUser({ role: "learner" }, { learner: true })).toBe("/learner");
    expect(await resolveHomeForUser({ role: "student" }, { learner: true })).toBe("/learner");
    expect(await resolveHomeForUser({ role: "demo" }, { learner: true })).toBe("/learner");
  });

  it("routes learner to /learn when the learner portal is disabled", async () => {
    expect(await resolveHomeForUser({ role: "learner" }, { learner: false })).toBe("/learn");
  });

  it("routes instructor to /instructor when enabled, /learn when disabled", async () => {
    expect(await resolveHomeForUser({ role: "instructor" }, { instructor: true })).toBe("/instructor");
    expect(await resolveHomeForUser({ role: "instructor" }, { instructor: false })).toBe("/learn");
  });

  it("routes org_admin to /org when enabled, /learn when disabled", async () => {
    expect(await resolveHomeForUser({ role: "org_admin" }, { org: true })).toBe("/org");
    expect(await resolveHomeForUser({ role: "org_admin" }, { org: false })).toBe("/learn");
  });

  it("falls back to /learn for unknown roles", async () => {
    expect(await resolveHomeForUser({ role: "guardian" }, { learner: true })).toBe("/learn");
  });
});
