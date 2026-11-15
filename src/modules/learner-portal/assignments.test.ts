import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useApiMock = vi.hoisted(() => vi.fn());
vi.mock("./use-api", () => ({ useApi: useApiMock }));

import { LearnerAssignments } from "./assignments";

const DAY_MS = 86_400_000;

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    courseId: "course-1",
    courseName: "Structural Engineering",
    title: "Bridge load report",
    description: "",
    dueDate: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    week: 3,
    maxScore: 100,
    requiredTypes: ["text"],
    milestoneLabel: null,
    submissionId: null,
    status: null,
    cycle: null,
    score: null,
    submittedAt: null,
    hasDraft: false,
    ...overrides,
  };
}

function payload(items: unknown[], counts?: Record<string, number>) {
  return { data: { items, nextCursor: null, ...(counts ? { counts } : {}) }, error: null, isLoading: false, retry: vi.fn() };
}

describe("LearnerAssignments filter chips (rules 5 + 12)", () => {
  beforeEach(() => useApiMock.mockReset());

  it("gives every chip a 44px target, visible focus, and its real count", () => {
    useApiMock.mockReturnValue(
      payload([item()], { all: 6, due: 2, in_review: 1, returned: 1, graded: 2 }),
    );

    const html = renderToStaticMarkup(createElement(LearnerAssignments));

    const chips = html.split("<button ").slice(1).map((tag) => tag.split(">")[0]);
    expect(chips).toHaveLength(5);
    for (const chip of chips) {
      expect(chip).toContain("min-h-11");
      expect(chip).toContain("focus-visible:outline-2");
      expect(chip).toContain('aria-pressed=');
    }
    // Real counts render beside each label.
    expect(html).toContain("All");
    expect(html).toContain(">2<");
    expect(html).toContain("tabular-nums");
  });

  it("renders without count badges when the payload carries no counts", () => {
    useApiMock.mockReturnValue(payload([item()]));

    const html = renderToStaticMarkup(createElement(LearnerAssignments));
    expect(html).toContain("Bridge load report");
    expect(html).not.toContain("tabular-nums");
  });
});

describe("LearnerAssignments due readings (rule 10)", () => {
  beforeEach(() => useApiMock.mockReset());

  it("tones overdue and due-today readings with fixed status tokens", () => {
    useApiMock.mockReturnValue(
      payload([
        item({ id: "a-2", dueDate: new Date(Date.now() - 2 * DAY_MS).toISOString() }),
        item({ id: "a-3", dueDate: new Date().toISOString() }),
      ]),
    );

    const html = renderToStaticMarkup(createElement(LearnerAssignments));

    expect(html).toContain("Overdue 2d");
    expect(html).toContain("bg-danger-subtle");
    expect(html).toContain("Due today");
    expect(html).toContain("bg-warning-subtle");
    expect(html).not.toContain("Due tomorrow");
  });

  it("keeps distant dates plain without an urgency tone", () => {
    useApiMock.mockReturnValue(
      payload([item({ dueDate: new Date(Date.now() + 30 * DAY_MS).toISOString() })]),
    );

    const html = renderToStaticMarkup(createElement(LearnerAssignments));
    expect(html).toMatch(/Due [A-Z][a-z]{2} \d{1,2}/);
    expect(html).not.toContain("bg-danger-subtle");
    expect(html).not.toContain("bg-warning-subtle");
  });

  it("shows status as a toned chip, never as prose", () => {
    useApiMock.mockReturnValue(payload([item({ status: "in_review" })]));

    const html = renderToStaticMarkup(createElement(LearnerAssignments));
    expect(html).toContain("In review");
    expect(html).toContain("bg-info-subtle");
  });
});

describe("LearnerAssignments empty + error states (rules 6 + 9)", () => {
  beforeEach(() => useApiMock.mockReset());

  it("ends the empty all-filter state with a next action", () => {
    useApiMock.mockReturnValue(payload([]));

    const html = renderToStaticMarkup(createElement(LearnerAssignments));

    expect(html).toContain("No assignments here");
    expect(html).toContain("Browse courses");
    expect(html).toContain('href="/learner/learn"');
    expect(html).toContain("focus-visible:outline-2");
  });

  it("links the empty embedded state to its course", () => {
    useApiMock.mockReturnValue(payload([]));

    const html = renderToStaticMarkup(
      createElement(LearnerAssignments, { courseId: "course-7", embedded: true }),
    );

    expect(html).toContain("Open the course");
    expect(html).toContain('href="/learner/courses/course-7"');
  });

  it("keeps the retry control focus-visible", () => {
    useApiMock.mockReturnValue({ data: null, error: "Service unavailable", isLoading: false, retry: vi.fn() });

    const html = renderToStaticMarkup(createElement(LearnerAssignments));

    expect(html).toContain("Retry");
    expect(html).toContain("focus-visible:outline-2");
  });
});
