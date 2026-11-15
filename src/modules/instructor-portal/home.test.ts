import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeKpis, InstructorHome } from "./home";

describe("InstructorHome initial render (rule 8)", () => {
  it("scaffolds while loading — no fabricated KPIs", () => {
    const html = renderToStaticMarkup(createElement(InstructorHome));
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("In queue");
    expect(html).not.toContain("Instructor home");
  });
});

describe("HomeKpis (rule 7 — real counts, honest tones)", () => {
  it("renders the four fold KPIs from true totals", () => {
    const html = renderToStaticMarkup(
      createElement(HomeKpis, { queueCount: 12, returnedCount: 3, atRiskCount: 2, studentsTotal: 140 }),
    );
    expect(html).toContain("In queue");
    expect(html).toContain(">12<");
    expect(html).toContain("active submissions");
    expect(html).toContain("At risk");
    expect(html).toContain(">2<");
    expect(html).toContain("Students");
    expect(html).toContain(">140<");
    expect(html).toContain("Returned");
    expect(html).toContain(">3<");
    expect(html).toContain("waiting on the learner");
  });

  it("warns when learners are at risk, reassures when none are", () => {
    const atRisk = renderToStaticMarkup(
      createElement(HomeKpis, { queueCount: 4, returnedCount: 0, atRiskCount: 5, studentsTotal: 30 }),
    );
    expect(atRisk).toContain("bg-warning-subtle");

    const calm = renderToStaticMarkup(
      createElement(HomeKpis, { queueCount: 4, returnedCount: 0, atRiskCount: 0, studentsTotal: 30 }),
    );
    expect(calm).toContain("bg-success-subtle");
    expect(calm).not.toContain("bg-warning-subtle");
  });
});
