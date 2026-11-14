import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
}));

vi.mock("./use-api", () => ({ useApi: mocks.useApi }));

import { LearnerProjects, ProjectCourseField } from "./projects";

describe("LearnerProjects course context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the owning course on each project card", () => {
    mocks.useApi.mockReturnValue({
      data: {
        courses: [{ id: "course-1", name: "Course One" }],
        projects: [{
          id: "project-1",
          courseId: "course-1",
          courseName: "Course One",
          title: "Project One",
          goal: "Build a useful tool",
          status: "active",
          durationWeeks: 4,
          deadline: null,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
          kpis: { taskProgress: 50, tasksDone: "1/2" },
        }],
      },
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(LearnerProjects));

    expect(html).toContain("Course projects");
    expect(html).toContain("Course One");
    expect(html).toContain("Project One");
    expect(html).toContain("Projects stay with their course");
  });

  it("locks proposal course selection to the active course workspace", () => {
    const html = renderToStaticMarkup(createElement(ProjectCourseField, {
      courses: [
        { id: "course-1", name: "Course One" },
        { id: "course-2", name: "Course Two" },
      ],
      preferredCourseId: "course-2",
      selectedCourseId: "course-1",
      onCourseChange: vi.fn(),
    }));

    expect(html).toContain("Course Two");
    expect(html).toContain("Current course");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Course One");
  });

  it("fails closed when the active course is not in the learner's available courses", () => {
    const html = renderToStaticMarkup(createElement(ProjectCourseField, {
      courses: [{ id: "course-1", name: "Course One" }],
      preferredCourseId: "course-2",
      selectedCourseId: "course-1",
      onCourseChange: vi.fn(),
    }));

    expect(html).toContain('role="alert"');
    expect(html).toContain("Course unavailable");
    expect(html).not.toContain("<select");
  });

  it("shows the active course on the embedded proposal action", () => {
    mocks.useApi.mockReturnValue({
      data: { courses: [{ id: "course-2", name: "Course Two" }], projects: [] },
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(LearnerProjects, {
      courseId: "course-2",
      embedded: true,
    }));

    expect(mocks.useApi).toHaveBeenCalledWith("/api/learn/projects?courseId=course-2");
    expect(html).toContain("New project proposal");
    expect(html).toContain("Course Two");
  });

  it("explains that projects require a course when no enrolments exist", () => {
    mocks.useApi.mockReturnValue({
      data: { courses: [], projects: [] },
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(LearnerProjects));

    expect(html).toContain("Projects are part of a course");
    expect(html).toContain("Enroll in a course before proposing a project.");
    expect(html).not.toContain("Propose a project");
  });
});
