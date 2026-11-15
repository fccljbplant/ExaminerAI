import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReviewQueue } from "./review-queue";

describe("ReviewQueue initial render (rules 2 + 8 + 12)", () => {
  it("offers every status inline as chips — none hidden behind recall", () => {
    const html = renderToStaticMarkup(createElement(ReviewQueue));
    for (const label of ["All", "Submitted", "In review", "Resubmitted", "Returned"]) {
      expect(html).toContain(label);
    }
  });

  it("marks only the All chip as pressed on first render", () => {
    const html = renderToStaticMarkup(createElement(ReviewQueue));
    const chips = html
      .split("<button ")
      .slice(1)
      .map((tag) => tag.split("</button>")[0]);
    expect(chips).toHaveLength(5);
    const pressed = chips.filter((c) => c.includes('aria-pressed="true"'));
    expect(pressed).toHaveLength(1);
    expect(pressed[0].endsWith(">All")).toBe(true);
  });

  it("makes every chip a 44px ringed target", () => {
    const html = renderToStaticMarkup(createElement(ReviewQueue));
    for (const chip of html.split("<button ").slice(1)) {
      const tag = chip.split(">")[0];
      expect(tag).toContain("min-h-11");
      expect(tag).toContain("focus-visible:outline-focus");
    }
  });

  it("scaffolds the list while loading", () => {
    const html = renderToStaticMarkup(createElement(ReviewQueue));
    expect(html).toContain("Review queue");
    expect(html).toContain('aria-busy="true"');
  });
});
