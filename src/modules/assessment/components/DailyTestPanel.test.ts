import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyTestPanel } from "./DailyTestPanel";

describe("DailyTestPanel loading experience", () => {
  it("announces the initial loading state to assistive technology", () => {
    const html = renderToStaticMarkup(
      createElement(DailyTestPanel, { courseId: "course-a" }),
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading your daily check-in");
    expect(html).toContain('aria-hidden="true"');
  });
});
