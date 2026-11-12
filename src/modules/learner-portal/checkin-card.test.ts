import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckInCard } from "./checkin-card";

describe("CheckInCard", () => {
  it("keeps the check-in and history controls discoverable in the collapsed state", () => {
    const html = renderToStaticMarkup(createElement(CheckInCard, { courseId: "course-a" }));

    expect(html).toContain('aria-label="Daily check-in"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Daily check-in");
    expect(html).toContain("Recent check-ins");
    expect(html).not.toContain("No check-ins yet.");
  });
});
