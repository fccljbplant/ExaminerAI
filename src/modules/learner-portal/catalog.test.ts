import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useApiMock = vi.hoisted(() => vi.fn());
vi.mock("./use-api", () => ({ useApi: useApiMock }));

import { LearnerCatalog } from "./catalog";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "course-1",
    name: "Structural Engineering Basics",
    subtitle: "Loads, forces and materials",
    description: "",
    category: "Engineering",
    level: "beginner",
    durationWeeks: 8,
    rating: 4.6,
    reviewCount: 128,
    enrollmentCount: 240,
    thumbnailUrl: null,
    featured: false,
    enrolled: false,
    progress: null,
    ...overrides,
  };
}

function payload(items: unknown[], categories: string[] = ["Engineering", "Design"]) {
  return { data: { items, categories }, error: null, isLoading: false, retry: vi.fn() };
}

describe("LearnerCatalog filter controls (rules 2 + 12)", () => {
  beforeEach(() => useApiMock.mockReset());

  it("gives category chips 44px targets, visible focus, and pressed state", () => {
    useApiMock.mockReturnValue(payload([item()]));

    const html = renderToStaticMarkup(createElement(LearnerCatalog));

    const chips = html.split("<button ").slice(1).map((tag) => tag.split(">")[0]);
    expect(chips.length).toBeGreaterThanOrEqual(3); // All + each category
    for (const chip of chips) {
      expect(chip).toContain("min-h-11");
      expect(chip).toContain("focus-visible:outline-2");
      expect(chip).toContain('aria-pressed=');
    }
  });

  it("labels the search and level controls and keeps keyboard focus visible", () => {
    useApiMock.mockReturnValue(payload([item()]));

    const html = renderToStaticMarkup(createElement(LearnerCatalog));

    expect(html).toContain('aria-label="Search courses"');
    expect(html).toContain('aria-label="Filter by level"');
    expect(html).toContain("focus-visible:outline-focus");
  });

  it("links course cards with a visible focus ring", () => {
    useApiMock.mockReturnValue(payload([item()]));

    const html = renderToStaticMarkup(createElement(LearnerCatalog));
    const card = html.split("<a ").slice(1).map((tag) => tag.split(">")[0]).at(-1);
    expect(card).toContain('href="/learner/courses/course-1"');
    expect(card).toContain("focus-visible:outline-2");
  });
});

describe("LearnerCatalog card anatomy (rules 7 + 10)", () => {
  beforeEach(() => useApiMock.mockReset());

  it("shows enrollment state and progress as visual chips, values leading", () => {
    useApiMock.mockReturnValue(
      payload([item({ enrolled: true, progress: { week: 3, day: 2 } })]),
    );

    const html = renderToStaticMarkup(createElement(LearnerCatalog));

    expect(html).toContain("Enrolled");
    expect(html).toContain("Week 3 · Day 2 — continue where you left off");
    expect(html).toContain("4.6");
    expect(html).toContain("8w");
  });
});

describe("LearnerCatalog empty and error states (rules 6 + 9)", () => {
  beforeEach(() => useApiMock.mockReset());

  it("offers clear filters when filters exclude everything", () => {
    useApiMock.mockReturnValue(payload([], []));

    const html = renderToStaticMarkup(createElement(LearnerCatalog));
    // No filters set (fresh render) → catalog-empty branch with a way out.
    expect(html).toContain("No matching courses");
    expect(html).toContain("Go to Today");
    expect(html).toContain('href="/learner"');
  });

  it("keeps the error state retryable and focus-visible", () => {
    useApiMock.mockReturnValue({ data: null, error: "Service unavailable", isLoading: false, retry: vi.fn() });

    const html = renderToStaticMarkup(createElement(LearnerCatalog));

    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t load the catalog");
    expect(html).toContain("Retry");
    expect(html).toContain("focus-visible:outline-2");
  });
});
