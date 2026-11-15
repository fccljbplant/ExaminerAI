import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LearnerExams } from "./exams";

const HREFS = ["/learner/practice", "/learner/exams/daily", "/learner/exams/weekly"];

describe("LearnerExams (rules 1 + 2 + 3 + 12)", () => {
  const html = renderToStaticMarkup(createElement(LearnerExams));

  it("offers the three Socratic modes inline as cards", () => {
    for (const href of HREFS) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("Socratic practice");
    expect(html).toContain("Socratic daily test");
    expect(html).toContain("Socratic weekly test");
  });

  it("gives every card a visible keyboard focus ring (rule 12)", () => {
    const cards = html
      .split("<a ")
      .slice(1)
      .map((tag) => tag.split(">")[0])
      .filter((tag) => tag.includes("rounded-xl"));
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card).toContain("focus-visible:outline-2");
      expect(card).toContain("focus-visible:outline-focus");
    }
  });

  it("keeps icon chips in one family — brand tone, no per-item rainbow (rule 3)", () => {
    const chips = html
      .split("<span ")
      .slice(1)
      .map((tag) => tag.split(">")[0])
      .filter((tag) => tag.includes("h-9 w-9"));
    expect(chips).toHaveLength(4); // explainer (surface on tinted panel) + three mode cards
    const cardChips = chips.filter((chip) => !chip.includes("shrink-0"));
    expect(cardChips).toHaveLength(3);
    for (const chip of cardChips) {
      expect(chip).toContain("bg-brand-subtle");
    }
    expect(html).not.toContain("bg-warning-subtle");
    expect(html).not.toContain("bg-info-subtle");
  });

  it("answers how testing works before the user has to ask (rule 9)", () => {
    expect(html).toContain("How testing works:");
    expect(html).toContain("daily Socratic test");
  });
});
