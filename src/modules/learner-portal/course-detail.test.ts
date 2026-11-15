import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
}));

vi.mock("./use-api", () => ({ useApi: mocks.useApi }));

import { CourseDetail, CourseworkTab, getNextCourseTab, resolveCourseTab, StatusDot } from "./course-detail";

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


describe("CourseDetail accessible tabs", () => {
  beforeEach(() => {
    mocks.useApi.mockImplementation((path: string | null) => {
      if (path === "/api/v2/courses/course-1/overview") {
        return {
          data: {
            course: {
              id: "course-1",
              name: "Course One",
              subtitle: null,
              description: "Learn practical skills.",
              category: "Engineering",
              level: "Core",
              durationWeeks: 4,
              rating: 0,
              reviewCount: 0,
              enrollmentCount: 1,
              thumbnailUrl: null,
              skillsVerified: [],
              whatYouWillLearn: [],
              prerequisites: [],
              toolsUsed: [],
              weekCount: 4,
              instructorName: null,
            },
            enrollment: {
              enrolled: true,
              totalXP: 0,
              streakCurrent: 0,
              position: null,
              nextLesson: null,
            },
          },
          error: null,
          isLoading: false,
          retry: vi.fn(),
        };
      }
      return { data: null, error: null, isLoading: false, retry: vi.fn() };
    });
  });

  it("renders linked tab and tabpanel semantics for course sections", () => {
    const html = renderToStaticMarkup(createElement(CourseDetail, { courseId: "course-1" }));

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls="course-panel-course-1-overview"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-labelledby="course-tab-course-1-overview"');
    expect(html).not.toContain('aria-current="page"');
  });

  it("keeps the primary Continue CTA, back link, and tabs keyboard-visible (rule 12)", () => {
    const html = renderToStaticMarkup(createElement(CourseDetail, { courseId: "course-1" }));

    const cta = html.split("<a ").slice(1).find((tag) => tag.includes("/learn/course-1"));
    expect(cta).toContain("Continue");
    expect(cta).toContain("focus-visible:outline-2");

    const back = html.split("<a ").slice(1).find((tag) => tag.includes("/learner/learn"));
    expect(back).toContain("focus-visible:outline-2");
  });
});

describe("course detail tab state", () => {
  it("resets to overview when the learner opens a different course", () => {
    expect(
      resolveCourseTab({ courseId: "course-1", tab: "coursework" }, "course-2", true),
    ).toBe("overview");
  });

  it("does not retain the coursework tab when enrollment is unavailable", () => {
    expect(
      resolveCourseTab({ courseId: "course-1", tab: "coursework" }, "course-1", false),
    ).toBe("overview");
  });

  it("preserves the selected tab for the same enrolled course", () => {
    expect(
      resolveCourseTab({ courseId: "course-1", tab: "syllabus" }, "course-1", true),
    ).toBe("syllabus");
  });

  it("wraps arrow navigation and supports Home and End", () => {
    const tabs = ["overview", "syllabus", "coursework"] as const;
    expect(getNextCourseTab(tabs, "coursework", "ArrowRight")).toBe("overview");
    expect(getNextCourseTab(tabs, "overview", "ArrowLeft")).toBe("coursework");
    expect(getNextCourseTab(tabs, "coursework", "Home")).toBe("overview");
    expect(getNextCourseTab(tabs, "overview", "End")).toBe("coursework");
    expect(getNextCourseTab(tabs, "overview", "Enter")).toBeNull();
  });
});

describe("StatusDot carries status by shape, not color alone (rule 7)", () => {
  it("marks completed days with a check on a success-tinted disc", () => {
    const html = renderToStaticMarkup(createElement(StatusDot, { status: "completed" }));
    expect(html).toContain('aria-label="Completed"');
    expect(html).toContain("bg-success-subtle");
    expect(html).toContain("<svg"); // check glyph, not just a colored dot
  });

  it("pulses the current day", () => {
    const html = renderToStaticMarkup(createElement(StatusDot, { status: "current" }));
    expect(html).toContain('aria-label="Current"');
    expect(html).toContain("animate-pulse");
    expect(html).toContain("bg-brand");
  });

  it("keeps upcoming days hollow with a named state", () => {
    const html = renderToStaticMarkup(createElement(StatusDot, { status: "upcoming" }));
    expect(html).toContain('aria-label="Upcoming"');
    expect(html).toContain("border-2 border-line-strong");
    expect(html).not.toContain("bg-brand");
    expect(html).not.toContain("bg-success");
  });
});
