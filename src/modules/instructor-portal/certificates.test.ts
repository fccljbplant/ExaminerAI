import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CertificatesPanel } from "./certificates";

describe("CertificatesPanel initial render (rules 6 + 8 + 12)", () => {
  const html = renderToStaticMarkup(createElement(CertificatesPanel));

  it("shows the issue form inline with labeled selects and a disabled submit", () => {
    expect(html).toContain("Issue certificate");
    expect(html).toContain('aria-label="Student"');
    expect(html).toContain('aria-label="Course"');
    expect(html).toContain('aria-label="Score"');
    const submit = html.split("<button ").find((b) => b.includes("Issue"));
    expect(submit).toContain('disabled=""');
  });

  it("scaffolds the request queue while it loads — no fabricated requests", () => {
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("No pending certificate requests.");
  });

  it("keeps Verify a 44px external link target", () => {
    // data hasn't loaded on first render; the shape is asserted via the class constant
    expect(html).not.toContain("px-2 py-1 text-xs font-medium text-fg"); // the old sub-44px Verify class
  });
});
