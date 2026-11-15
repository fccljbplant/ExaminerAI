import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useApiMock = vi.hoisted(() => vi.fn());
vi.mock("./use-api", () => ({ useApi: useApiMock }));

import { ContinueCard, LearnerHome, NoEnrollment } from "./home";

function homeData(overrides: Record<string, unknown> = {}) {
  return {
    learner: { totalXP: 1200, level: "Level 3 · Builder", streakCurrent: 5, enrolledCount: 1 },
    continue: {
      courseId: "course-1",
      courseName: "Foundations",
      nextLesson: "Week 1 · Day 1 — Safety",
      kind: "learn" as const,
      href: "/learn/course-1",
    },
    dueToday: [
      { id: "t-1", kind: "daily-test" as const, title: "Structural Engineering", meta: "Daily check-in", href: "/learn/course-1" },
    ],
    announcements: [],
    projects: [
      { id: "p-1", title: "Build a bridge", status: "active", courseName: "Structural Engineering", taskProgress: 50, tasksDone: "1/2" },
    ],
    ...overrides,
  };
}

describe("LearnerHome empty state", () => {
  it("provides a primary heading when the learner has no course enrolments", () => {
    const html = renderToStaticMarkup(createElement(NoEnrollment));

    expect(html).toContain("<h1");
    expect(html).toContain("Start your first course");
    expect(html).toContain('href="/learner/learn"');
    expect(html.match(/focus-visible:outline-2/g)).toHaveLength(6);
  });
});


describe("LearnerHome next-step actions", () => {
  it("gives the primary and timed session links 44px targets and visible keyboard focus", () => {
    const html = renderToStaticMarkup(
      createElement(ContinueCard, {
        info: {
          courseId: "course-1",
          courseName: "Foundations",
          nextLesson: "Week 1 · Day 1 — Safety",
          kind: "learn",
          href: "/learn/course-1",
        },
      }),
    );

    const links = html.split("<a ").slice(1).map((tag) => tag.split(">")[0]);
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link).toContain("h-11");
      expect(link).toContain("focus-visible:outline-2");
    }
  });
});


describe("LearnerHome due-today list (UXPeak value-first)", () => {
  beforeEach(() => {
    useApiMock.mockReset();
    useApiMock.mockReturnValue({ data: homeData(), error: null, isLoading: false, retry: vi.fn() });
  });

  it("leads each due item with the course value, not the item-kind label", () => {
    const html = renderToStaticMarkup(createElement(LearnerHome));

    expect(html).toContain("Structural Engineering");
    expect(html).toContain("Daily check-in");
    // Inside the due row, the course value is the title paragraph and the
    // item-kind label is demoted to the meta line directly beneath it.
    expect(html).toContain(
      'text-fg">Structural Engineering</p><p class="mt-0.5 truncate text-xs text-fg-muted">Daily check-in</p>',
    );
  });

  it("gives the empty due list a value statement plus a study CTA", () => {
    useApiMock.mockReturnValue({
      data: homeData({ dueToday: [] }),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(LearnerHome));

    expect(html).toContain("No daily test ready yet");
    expect(html).toContain("Study a lesson");
    expect(html).toContain('href="/learner/learn"');
  });
});


describe("LearnerHome projects list (UXPeak shown-not-told status)", () => {
  beforeEach(() => {
    useApiMock.mockReset();
    useApiMock.mockReturnValue({ data: homeData(), error: null, isLoading: false, retry: vi.fn() });
  });

  it("shows project status as a toned chip with real task progress", () => {
    const html = renderToStaticMarkup(createElement(LearnerHome));

    expect(html).toContain("In progress");
    expect(html).toContain("bg-info-subtle");
    expect(html).toContain('width:50%');
    expect(html).toContain("1/2 tasks");
    // Status must not be buried in a prose meta line.
    expect(html).not.toContain("Structural Engineering · In progress · 1/2 tasks");
  });

  it("tones each project status distinctly", () => {
    useApiMock.mockReturnValue({
      data: homeData({
        projects: [
          { id: "p-1", title: "Bridge", status: "pending_approval", courseName: "Structural Engineering", taskProgress: 0, tasksDone: "0/4" },
          { id: "p-2", title: "Survey", status: "rejected", courseName: "Structural Engineering", taskProgress: 10, tasksDone: "1/6" },
        ],
      }),
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });

    const html = renderToStaticMarkup(createElement(LearnerHome));

    expect(html).toContain("Awaiting approval");
    expect(html).toContain("bg-warning-subtle");
    expect(html).toContain("Needs changes");
    expect(html).toContain("bg-danger-subtle");
  });
});


describe("LearnerHome error state", () => {
  it("keeps the retry control focus-visible", () => {
    useApiMock.mockReset();
    useApiMock.mockReturnValue({ data: null, error: "Service unavailable", isLoading: false, retry: vi.fn() });

    const html = renderToStaticMarkup(createElement(LearnerHome));

    expect(html).toContain('role="alert"');
    expect(html).toContain("Retry");
    expect(html).toContain("focus-visible:outline-2");
  });
});


describe("LearnerHome metric strip", () => {
  it("makes the horizontally scrollable metrics keyboard reachable and discoverable", async () => {
    const { StatStrip } = await import("@/modules/ui/kpi");
    const html = renderToStaticMarkup(
      createElement(
        StatStrip,
        { scrollHint: "Swipe to view all metrics" },
        createElement("div", null, "Streak"),
        createElement("div", null, "Total XP"),
      ),
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Key metrics"');
    expect(html).toContain("On small screens, scroll horizontally to view all metrics.");
    expect(html).toContain("Swipe to view all metrics");
    expect(html).toContain("md:hidden");
    expect(html).toContain("focus-visible:outline-2");
  });
});


describe("LearnerHome desktop KPI sizing", () => {
  it("allows metric cards to shrink into the equal-width desktop grid", async () => {
    const { Kpi } = await import("@/modules/ui/kpi");
    const html = renderToStaticMarkup(createElement(Kpi, { label: "Courses", value: 3 }));

    expect(html).toContain("min-w-[240px]");
    expect(html).toContain("md:min-w-0");
  });
});
