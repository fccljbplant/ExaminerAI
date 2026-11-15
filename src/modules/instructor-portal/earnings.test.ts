import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonthlyTrend } from "./earnings";

const monthlyData = [
  { month: "2026-09", earnings: 1200, sales: 3 },
  { month: "2026-10", earnings: 0, sales: 0 },
  { month: "2026-11", earnings: 800, sales: 1 },
];

describe("MonthlyTrend (rules 7 + 10 + 11)", () => {
  const html = renderToStaticMarkup(createElement(MonthlyTrend, { monthlyData }));

  it("scales bars from the best month and keeps zero months honest", () => {
    expect(html).toContain("width:100%"); // 1200/1200
    expect(html).toContain("width:0%"); // zero month, not fabricated
    expect(html).toContain("width:66.66666666666666%"); // 800/1200
  });

  it("labels the sales count instead of a bare parenthetical", () => {
    expect(html).toContain("1,200 · 3 sales");
    expect(html).toContain("800 · 1 sale"); // singular pluralized correctly
    expect(html).not.toContain("(3)");
  });

  it("announces each month for screen readers", () => {
    expect(html).toContain('aria-label="2026-11: 800 from 1 sale"');
    expect(html).toContain('aria-label="2026-10: 0 from 0 sales"');
  });
});
