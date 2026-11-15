import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
}));

vi.mock("@/modules/learner-portal/use-api", () => ({ useApi: mocks.useApi }));

import { ProjectQueue, projectMetaText } from "./project-queue";

function queueData(overrides: Record<string, unknown> = {}) {
  return {
    pending: [
      {
        id: "project-1",
        title: "Build a bridge",
        goal: "Learn structural design",
        description: "Design and test a scale bridge",
        objectives: ["Design the truss"],
        durationWeeks: 4,
        status: "pending_approval",
        approvalNote: null,
        approvedAt: null,
        deadline: null,
        updatedAt: "2026-11-14T00:00:00.000Z",
        learner: { id: "learner-1", name: "Aven Learner", email: "aven@example.com" },
        course: { id: "course-1", name: "Structural Engineering" },
        kpis: { taskProgress: 0, tasksDone: "0/0" },
      },
    ],
    decided: [
      {
        id: "project-2",
        title: "Survey a site",
        goal: null,
        description: null,
        objectives: [],
        durationWeeks: null,
        status: "approved",
        approvalNote: null,
        approvedAt: "2026-11-10T00:00:00.000Z",
        deadline: null,
        updatedAt: "2026-11-10T00:00:00.000Z",
        learner: { id: "learner-2", name: "Rhea Learner", email: "rhea@example.com" },
        course: { id: "course-1", name: "Structural Engineering" },
        kpis: { taskProgress: 50, tasksDone: "2/4" },
      },
    ],
    kpis: { pendingCount: 1, totalCount: 2 },
    ...overrides,
  };
}

describe("ProjectQueue instructor approval surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the learner, course and proposal evidence per pending card", () => {
    mocks.useApi.mockReturnValue({
      data: queueData(),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectQueue));

    expect(html).toContain("Build a bridge");
    expect(html).toContain("Aven Learner");
    expect(html).toContain("Structural Engineering");
    expect(html).toContain("Design the truss");
    expect(html).toContain("Awaiting approval");
    expect(html).toContain("1 awaiting approval · 2 total");
  });

  it("keeps approve and send-back as 44px targets with focus visibility", () => {
    mocks.useApi.mockReturnValue({
      data: queueData(),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectQueue));

    expect(html).toContain("Approve");
    expect(html).toContain("Send back…");
    // Approve + Send back… are visible 44px targets in the initial state.
    const minTargets = html.match(/min-h-11/g) ?? [];
    expect(minTargets.length).toBeGreaterThanOrEqual(2);
    // Every interactive control carries the focus-outline convention:
    // approve, send-back and the learner profile link.
    const focusRings = html.match(/focus-visible:outline-2/g) ?? [];
    expect(focusRings.length).toBeGreaterThanOrEqual(3);
  });

  it("pairs the success action with the success-on token, not on-brand", () => {
    mocks.useApi.mockReturnValue({
      data: queueData(),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectQueue));

    expect(html).toContain("bg-success px-3 text-xs font-semibold text-success-on");
    expect(html).not.toContain("bg-success px-3 text-xs font-semibold text-on-brand");
  });

  it("links each pending proposal to the learner's course-scoped profile", () => {
    mocks.useApi.mockReturnValue({
      data: queueData(),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectQueue));

    expect(html).toContain('href="/instructor/students/learner-1"');
  });

  it("renders a calm empty state and hides decided history when empty", () => {
    mocks.useApi.mockReturnValue({
      data: queueData({ pending: [], decided: [], kpis: { pendingCount: 0, totalCount: 0 } }),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectQueue));

    expect(html).toContain("Queue clear");
    expect(html).toContain("No proposals are waiting on you.");
    expect(html).not.toContain("Decided");
  });

  it("renders a retryable error state when the queue cannot load", () => {
    mocks.useApi.mockReturnValue({
      data: null,
      error: "Service unavailable",
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectQueue));

    expect(html).toContain("Couldn&#x27;t load the project queue");
    expect(html).toContain("Retry");
    expect(html).toContain('role="alert"');
  });
});

describe("projectMetaText (rule 7 — no orphaned separators)", () => {
  it("joins whichever parts exist, never a leading separator", () => {
    expect(projectMetaText(4, "2026-12-01T00:00:00.000Z")).toContain("4-week timeline");
    expect(projectMetaText(4, "2026-12-01T00:00:00.000Z")).toContain("due ");
    expect(projectMetaText(4, null)).toBe("4-week timeline");
    expect(projectMetaText(null, "2026-12-01T00:00:00.000Z")).toMatch(/^due /);
    expect(projectMetaText(null, null)).toBe("");
  });

  it("no longer renders a leading · when only a deadline exists", () => {
    mocks.useApi.mockReturnValue({
      data: queueData({
        pending: [
          {
            ...queueData().pending[0],
            durationWeeks: null,
            deadline: "2026-12-01T00:00:00.000Z",
          },
        ],
      }),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(ProjectQueue));
    expect(html).not.toContain("· due");
    expect(html).toContain("due ");
  });
});
