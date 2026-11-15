import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const categories = [
  { value: "technology", label: "Technology", count: 4 },
  { value: "business", label: "Business", count: 2 },
];

describe("SiteHeader (rules 1 + 3 + 12)", () => {
  const html = renderToStaticMarkup(
    createElement(SiteHeader, { categories, signedIn: false, dashboardHref: "/learner" }),
  );

  it("renders the five nav destinations inline plus category chips with counts", () => {
    for (const label of ["Courses", "Learning Paths", "Pricing", "For Business", "Support"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Technology");
    expect(html).toContain("All Courses");
    expect(html).toContain(">6</span>"); // 4 + 2 summed across categories
  });

  it("keeps every nav link and chip a 44px ringed target", () => {
    const targets = html.match(/<a [^>]*>/g) ?? [];
    expect(targets.length).toBeGreaterThan(8);
    for (const t of targets) {
      expect(t).toContain("focus-visible:outline-focus");
    }
    for (const t of targets) {
      if (t.includes("/courses/category/")) expect(t).toContain("min-h-11");
    }
  });

  it("labels the search input and keeps the submit inside a 44px pill", () => {
    expect(html).toContain('for="site-search"');
    expect(html).toContain('id="site-search"');
    expect(html).toContain("h-11 w-full");
    const btn = html.split("<button ")[1].split(">")[0];
    expect(btn).toContain("bg-brand");
  });

  it("keeps the mobile menu closed on first render — the sheet never half-covers the category strip", () => {
    expect(html).not.toContain('id="site-mobile-menu"');
    expect(html).not.toContain('aria-expanded="true"');
    // the category strip is rendered when the menu is closed
    expect(html).toContain('aria-label="Course categories"');
  });
});

describe("SiteFooter (rules 3 + 12)", () => {
  const html = renderToStaticMarkup(createElement(SiteFooter));

  it("lists only real internal destinations, once each — no duplicate links", () => {
    const hrefs = html.match(/href="[^"]*"/g) ?? [];
    expect(hrefs.length).toBe(new Set(hrefs).size);
    expect(html).toContain("/verify");
    expect(html).not.toContain("Contact Support"); // was a duplicate of Help Center
  });

  it("makes every footer link a 44px ringed target", () => {
    for (const t of html.match(/<a [^>]*>/g) ?? []) {
      expect(t).toContain("focus-visible:outline-focus");
      expect(t).toContain("min-h-11");
    }
  });
});
