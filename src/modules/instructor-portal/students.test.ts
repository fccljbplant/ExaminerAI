import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RosterEmpty, RosterRow, StudentsRoster } from "./students";

const useApiMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/learner-portal/use-api", () => ({ useApi: useApiMock }));

function student(overrides: Record<string, unknown> = {}) {
  return {
    id: "stu-7",
    name: "Bilal Ahmed",
    email: "bilal@example.com",
    attentionScore: 42,
    attentionReasons: ["3 missed check-ins"],
    progress: 62,
    latestScore: 55,
    lastCheckIn: "2026-11-09T09:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => useApiMock.mockReset());

describe("StudentsRoster (rules 2 + 8 + 12)", () => {
  it("renders a skeleton and an honest loading count — never a fabricated 0 — while loading", () => {
    useApiMock.mockReturnValue({ data: null, error: null, isLoading: true, retry: vi.fn() });
    const html = renderToStaticMarkup(createElement(StudentsRoster));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading student count"');
    expect(html).not.toMatch(/>0<\/span>/); // no fake zero while data is in flight
  });

  it("keeps filter chips inline, 44px and focus-visible (rules 2 + 12)", () => {
    useApiMock.mockReturnValue({ data: null, error: null, isLoading: true, retry: vi.fn() });
    const html = renderToStaticMarkup(createElement(StudentsRoster));

    const chips = html
      .split("<button ")
      .slice(1)
      .map((tag) => tag.split(">")[0])
      .filter((tag) => tag.includes("rounded-full"));
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip).toContain("min-h-11");
      expect(chip).toContain("focus-visible:outline-2");
      expect(chip).toContain("focus-visible:outline-focus");
      expect(chip).toContain('aria-pressed=');
    }
  });

  it("answers a load failure with the reason and a 44px retry (rule 8)", () => {
    useApiMock.mockReturnValue({ data: null, error: "Network unreachable", isLoading: false, retry: vi.fn() });
    const html = renderToStaticMarkup(createElement(StudentsRoster));

    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t load students");
    expect(html).toContain("Network unreachable");
    const retry = html.split("<button ").slice(1).map((tag) => tag.split(">")[0]).find((tag) => tag.includes("px-4"));
    expect(retry).toContain("min-h-11");
    expect(retry).toContain("focus-visible:outline-focus");
  });

  it("renders rows and the true total once data lands", () => {
    useApiMock.mockReturnValue({
      data: { items: [student()], total: 1 },
      error: null,
      isLoading: false,
      retry: vi.fn(),
    });
    const html = renderToStaticMarkup(createElement(StudentsRoster));

    expect(html).toContain("Bilal Ahmed");
    expect(html).toContain("3 missed check-ins");
    expect(html).toContain(">1</span>");
    expect(html).toContain('href="/instructor/students/stu-7"');
  });
});

describe("RosterRow (rules 7 + 10 + 12)", () => {
  it("leads with the learner, reason as meta, real progress unit", () => {
    const html = renderToStaticMarkup(createElement(RosterRow, { s: student() }));
    expect(html).toContain("Bilal Ahmed");
    expect(html).toContain("3 missed check-ins");
    expect(html).toContain("62%");
    expect(html).toContain("width:62%");
  });

  it("says On track when there is no attention reason — never invents one", () => {
    const html = renderToStaticMarkup(
      createElement(RosterRow, { s: student({ attentionReasons: [], attentionScore: 0 }) }),
    );
    expect(html).toContain("On track");
  });

  it("tones at-risk rows with a warning chip + icon and points count (rule 7)", () => {
    const html = renderToStaticMarkup(createElement(RosterRow, { s: student() }));
    const chip = html.split("<span ").slice(1).map((tag) => tag.split(">")[0]).find((tag) => tag.includes("warning-subtle"));
    expect(chip).toBeDefined();
    expect(html).toContain("42 pts");
    expect(html).toContain("lucide-triangle-alert"); // icon ships with the chip
  });

  it("tones healthy rows with a success chip + check icon (rule 7)", () => {
    const html = renderToStaticMarkup(
      createElement(RosterRow, { s: student({ attentionScore: 5, attentionReasons: [] }) }),
    );
    const chip = html.split("<span ").slice(1).map((tag) => tag.split(">")[0]).find((tag) => tag.includes("success-subtle"));
    expect(chip).toBeDefined();
    expect(html).toContain(">OK</span>");
    expect(html).toContain("lucide-check");
  });

  it("keeps the whole row a 44px+ focus-visible drill-down target (rule 12)", () => {
    const html = renderToStaticMarkup(createElement(RosterRow, { s: student() }));
    const link = html.split("<a ").slice(1).map((tag) => tag.split(">")[0]).find(() => true);
    expect(link).toContain("min-h-14");
    expect(link).toContain("focus-visible:outline-2");
    expect(link).toContain("focus-visible:outline-focus");
  });
});

describe("RosterEmpty (rule 9 — empty states end somewhere)", () => {
  it("offers a way out of a narrowed search view", () => {
    const html = renderToStaticMarkup(
      createElement(RosterEmpty, { onlyRisk: false, hasSearch: true, onClear: () => {} }),
    );
    expect(html).toContain("No students match your search");
    const clear = html.split("<button ").slice(1).map((tag) => tag.split(">")[0]).pop();
    expect(html).toContain("Clear search &amp; filters");
    expect(clear).toContain("min-h-11");
    expect(clear).toContain("focus-visible:outline-focus");
  });

  it("celebrates an all-clear roster and still offers the filter exit", () => {
    const html = renderToStaticMarkup(
      createElement(RosterEmpty, { onlyRisk: true, hasSearch: false, onClear: () => {} }),
    );
    expect(html).toContain("No at-risk students");
    expect(html).toContain("Everyone is on track — nice work.");
    expect(html).toContain("Clear search &amp; filters");
  });

  it("shows no clear action on an unfiltered empty roster", () => {
    const html = renderToStaticMarkup(
      createElement(RosterEmpty, { onlyRisk: false, hasSearch: false, onClear: () => {} }),
    );
    expect(html).not.toContain("<button");
  });
});
