import { describe, expect, it } from "vitest";
import { getApiStateForPath } from "./use-api";

describe("useApi path-scoped state", () => {
  it("hides the previous resource data while a new path is loading", () => {
    const state = getApiStateForPath(
      {
        path: "/api/courses/course-a/overview",
        data: { courseId: "course-a" },
        error: null,
        loading: false,
      },
      "/api/courses/course-b/overview",
    );

    expect(state).toEqual({ data: null, error: null, isLoading: true });
  });

  it("does not carry a previous path error into the new resource", () => {
    const state = getApiStateForPath(
      {
        path: "/api/courses/course-a/overview",
        data: null,
        error: "Course A could not be loaded",
        loading: false,
      },
      "/api/courses/course-b/overview",
    );

    expect(state).toEqual({ data: null, error: null, isLoading: true });
  });

  it("retains same-path data during a refetch", () => {
    const state = getApiStateForPath(
      {
        path: "/api/courses/course-a/overview",
        data: { courseId: "course-a" },
        error: null,
        loading: true,
      },
      "/api/courses/course-a/overview",
    );

    expect(state).toEqual({
      data: { courseId: "course-a" },
      error: null,
      isLoading: true,
    });
  });

  it("clears resource data when the consumer disables its request", () => {
    const state = getApiStateForPath(
      {
        path: "/api/courses/course-a/overview",
        data: { courseId: "course-a" },
        error: null,
        loading: false,
      },
      null,
    );

    expect(state).toEqual({ data: null, error: null, isLoading: false });
  });
});
