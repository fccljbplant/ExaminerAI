import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContinueCard, NoEnrollment } from "./home";

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


describe("LearnerHome metric strip", () => {
  it("makes the horizontally scrollable metrics keyboard reachable and discoverable", async () => {
    const { StatStrip } = await import("@/modules/ui/kpi");
    const html = renderToStaticMarkup(
      createElement(StatStrip, { scrollHint: "Swipe to view all metrics" },
        createElement("div", null, "Streak"),
        createElement("div", null, "Total XP"),
      ),
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Key metrics. Scroll horizontally to view all metrics.");
    expect(html).toContain("Swipe to view all metrics");
    expect(html).toContain("md:hidden");
    expect(html).toContain("focus-visible:outline-2");
  });
});
