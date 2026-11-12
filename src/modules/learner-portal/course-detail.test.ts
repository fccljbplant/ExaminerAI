import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
}));

vi.mock("./use-api", () => ({ useApi: mocks.useApi }));

import { CourseworkTab } from "./course-detail";

describe("CourseworkTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useApi.mockImplementation((path: string | null) => {
      if (path === "/api/learn/projects?courseId=course-1") {
        return {
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
        };
      }

      if (path === "/api/v2/assignments?courseId=course-1") {
        return {
          data: {
            items: [{
              id: "assignment-1",
              courseId: "course-1",
              courseName: "Course One",
              title: "Assignment One",
              description: "Complete the practical task",
              dueDate: null,
              week: 1,
              maxScore: 100,
              requiredTypes: ["text"],
              milestoneLabel: "Week 1",
              submissionId: null,
              status: "draft",
              cycle: 1,
              score: null,
              submittedAt: null,
              hasDraft: false,
            }],
            nextCursor: null,
          },
          error: null,
          isLoading: false,
          retry: vi.fn(),
        };
      }

      return { data: null, error: null, isLoading: false, retry: vi.fn() };
    });
  });

  it("loads project proposals and assignment submissions within the selected course", () => {
    const html = renderToStaticMarkup(createElement(CourseworkTab, { courseId: "course-1" }));

    expect(mocks.useApi).toHaveBeenCalledWith("/api/learn/projects?courseId=course-1");
    expect(mocks.useApi).toHaveBeenCalledWith("/api/v2/assignments?courseId=course-1");
    expect(html).toContain("Course projects");
    expect(html).toContain("Project One");
    expect(html).toContain("Assignments");
    expect(html).toContain("Assignment One");
    expect(html).toContain('href="/learner/assignments/assignment-1"');
  });
});
