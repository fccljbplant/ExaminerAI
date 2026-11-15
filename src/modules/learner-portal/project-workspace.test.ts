import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
}));

vi.mock("./use-api", () => ({ useApi: mocks.useApi }));

import { ProjectWorkspace } from "./project-workspace";

function projectData(overrides: Record<string, unknown> = {}) {
  return {
    project: {
      id: "project-1",
      title: "Build a bridge",
      goal: "Learn structural design",
      stack: "Steel",
      currentState: null,
      deadline: null,
      status: "approved",
      description: "Design and test a scale bridge",
      objectives: ["Design the truss", "Load-test the prototype"],
      durationWeeks: 4,
      approvalNote: null,
      approvedByName: "Dana Mentor",
      approvedAt: "2026-11-10T00:00:00.000Z",
      courseName: "Structural Engineering",
      createdAt: "2026-11-01T00:00:00.000Z",
      ...overrides,
    },
    milestones: [
      { id: "m-1", title: "Plan & design", description: null, order: 0, status: "completed", completedAt: "2026-11-05T00:00:00.000Z" },
      { id: "m-2", title: "Build core features", description: null, order: 1, status: "planned", completedAt: null },
    ],
    weeks: [
      { id: "w-1", week: 1, title: "Foundations", summary: "Load basics", milestones: ["Plan & design"] },
    ],
    tasks: [
      { id: "t-1", title: "Review the design", status: "completed", week: 1, day: 1, dueDate: null, isMilestone: false, courseTopicLink: "Truss basics" },
      { id: "t-2", title: "Cut the members", status: "planned", week: 1, day: 2, dueDate: null, isMilestone: false, courseTopicLink: null },
    ],
    kpis: { milestoneProgress: 50, milestonesDone: "1/2", taskProgress: 50, tasksDone: "1/2" },
  };
}

describe("ProjectWorkspace course-first L7 surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the owning course identity in the header", () => {
    mocks.useApi.mockReturnValue({
      data: projectData(),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { projectId: "project-1" }));

    expect(html).toContain("Structural Engineering");
    expect(html).toContain("Build a bridge");
    expect(html).toContain("Design and test a scale bridge");
  });

  it("communicates task completion state on the toggle control (aria-pressed)", () => {
    mocks.useApi.mockReturnValue({
      data: projectData(),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { projectId: "project-1" }));

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Mark Review the design incomplete");
    expect(html).toContain("Mark Cut the members complete");
  });

  it("keeps the timeline locked behind instructor approval", () => {
    mocks.useApi.mockReturnValue({
      data: {
        ...projectData({ status: "pending_approval", approvedByName: null }),
        tasks: [],
        weeks: [],
        kpis: { milestoneProgress: 0, milestonesDone: "0/2", taskProgress: 0, tasksDone: "0/0" },
      },
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { projectId: "project-1" }));

    expect(html).toContain("Awaiting instructor approval");
    expect(html).toContain("Timeline locked");
    expect(html).toContain("Task generation unlocks after your instructor approves this project.");
    expect(html).not.toContain("Generate");
  });

  it("offers the generate timeline action for an approved project without tasks", () => {
    mocks.useApi.mockReturnValue({
      data: {
        ...projectData(),
        tasks: [],
        weeks: [],
        kpis: { milestoneProgress: 0, milestonesDone: "0/2", taskProgress: 0, tasksDone: "0/0" },
      },
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { projectId: "project-1" }));

    expect(html).toContain("Generate your project timeline");
    expect(html).toContain("Tasks per week");
  });

  it("disables milestone completion while the proposal is unapproved", () => {
    mocks.useApi.mockReturnValue({
      data: projectData({ status: "pending_approval", approvedByName: null }),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { projectId: "project-1" }));

    expect(html).toContain("disabled");
    expect(html).toContain("Unlocks after instructor approval");
  });

  it("renders a retryable error state when the project cannot load", () => {
    mocks.useApi.mockReturnValue({
      data: null,
      error: "Service unavailable",
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { projectId: "project-1" }));

    expect(html).toContain("Couldn&#x27;t load this project");
    expect(html).toContain("Service unavailable");
    expect(html).toContain("Retry");
    expect(html).toContain('role="alert"');
  });

  it("meets 44px touch targets on task row controls", () => {
    mocks.useApi.mockReturnValue({
      data: projectData(),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { projectId: "project-1" }));

    // h-11 / w-11 = 44px tap area for the toggle and delete icon buttons.
    expect(html).toContain("h-11 w-11");
    // Focus rings follow the portal-wide outline convention.
    const focusRings = html.match(/focus-visible:outline-2/g) ?? [];
    expect(focusRings.length).toBeGreaterThanOrEqual(8);
  });
});
