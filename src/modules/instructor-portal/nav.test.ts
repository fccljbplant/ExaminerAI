import { describe, expect, it } from "vitest";
import { INSTRUCTOR_NAV } from "./nav";
import { resolveActiveItem } from "@/modules/shell/types";

describe("instructor navigation active state", () => {
  it.each([
    "/instructor/projects",
    "/instructor/certificates",
    "/instructor/analytics",
    "/instructor/earnings",
    "/instructor/studio/courses",
    "/instructor/payouts",
  ])("keeps More selected on %s", (pathname) => {
    expect(resolveActiveItem(pathname, INSTRUCTOR_NAV)?.id).toBe("more");
  });

  it("keeps grading selected for an individual submission review", () => {
    expect(resolveActiveItem("/instructor/review/submission-123", INSTRUCTOR_NAV)?.id).toBe("grading");
  });

  it("keeps students selected for an individual student detail", () => {
    expect(resolveActiveItem("/instructor/students/student-123", INSTRUCTOR_NAV)?.id).toBe("students");
  });
});
