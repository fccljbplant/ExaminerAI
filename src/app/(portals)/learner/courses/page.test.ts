import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import LearnerCoursesAliasPage, { metadata } from "./page";

describe("learner courses compatibility route", () => {
  it("redirects to the canonical learner catalog", () => {
    LearnerCoursesAliasPage();

    expect(redirectMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith("/learner/learn");
  });

  it("uses the canonical courses page title", () => {
    expect(metadata.title).toBe("Courses — TraineesAI");
  });
});
