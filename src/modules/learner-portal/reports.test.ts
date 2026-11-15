import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ClaimCertificate,
  ComprehensiveReportView,
  GrowthReportView,
  PrivateReports,
} from "./reports";

const sections = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ title: `Topic ${i + 1}`, content: `Findings for topic ${i + 1}.` }));

describe("PrivateReports initial render (rules 4 + 8 + 11)", () => {
  it("explains privacy and keeps Generate the single brand action, disabled until identity loads", () => {
    const html = renderToStaticMarkup(createElement(PrivateReports));

    expect(html).toContain('aria-label="Private reports"');
    expect(html).toContain("generated on demand");
    expect(html).toContain("Generate my reports");
    expect(html).toContain('disabled=""'); // no fabricated identity before /api/auth/me answers
  });
});

describe("ComprehensiveReportView (rule 5 — curate, don't shrink)", () => {
  it("curates the first 4 sections and offers the full set one tap away", () => {
    const html = renderToStaticMarkup(
      createElement(ComprehensiveReportView, {
        report: { executiveSummary: "Strong quarter overall.", sections: sections(6) },
      }),
    );

    expect(html).toContain("Strong quarter overall.");
    expect(html).toContain("Topic 4");
    expect(html).not.toContain("Topic 5"); // hidden until asked for
    const toggle = html.split("<button ").slice(1).map((t) => t.split(">")[0]).find(() => true);
    expect(html).toContain("Show all 6 sections");
    expect(toggle).toContain("min-h-11");
    expect(toggle).toContain("focus-visible:outline-focus");
  });

  it("shows short reports whole — no toggle when nothing is curated away", () => {
    const html = renderToStaticMarkup(
      createElement(ComprehensiveReportView, { report: { sections: sections(3) } }),
    );
    expect(html).toContain("Topic 3");
    expect(html).not.toContain("Show all");
  });
});

describe("GrowthReportView (rule 10 — value leads)", () => {
  it("leads with the overview, lists strengths, growth areas and recommendations", () => {
    const html = renderToStaticMarkup(
      createElement(GrowthReportView, {
        report: {
          overview: "You reason well under exam pressure.",
          strengths: ["Load path intuition"],
          growthAreas: ["Timed practice volume"],
          recommendations: ["One timed set per week"],
        },
      }),
    );

    expect(html.indexOf("You reason well under exam pressure.")).toBeLessThan(html.indexOf("Strengths"));
    expect(html).toContain("Load path intuition");
    expect(html).toContain("Timed practice volume");
    expect(html).toContain("One timed set per week");
  });

  it("omits empty lists instead of rendering bare headings", () => {
    const html = renderToStaticMarkup(
      createElement(GrowthReportView, { report: { overview: "Only an overview." } }),
    );
    expect(html).not.toContain("Strengths");
    expect(html).not.toContain("Growth areas");
    expect(html).not.toContain("Recommendations");
  });
});

describe("ClaimCertificate (rules 6 + 12)", () => {
  it("is a 44px focusable action that names the course it claims for", () => {
    const html = renderToStaticMarkup(
      createElement(ClaimCertificate, { courseId: "c9", courseName: "Structural Basics" }),
    );
    const btn = html.split("<button ").slice(1).map((t) => t.split(">")[0]).find(() => true);
    expect(btn).toContain("min-h-11");
    expect(btn).toContain("focus-visible:outline-focus");
    expect(html).toContain("Claim certificate · Structural Basics");
  });
});
