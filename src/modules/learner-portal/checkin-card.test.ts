import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckInCard, CheckInSavedState } from "./checkin-card";

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

describe("CheckInSavedState", () => {
  it("announces the saved state and keeps an accessible edit action available", () => {
    const markup = renderToStaticMarkup(createElement(CheckInSavedState, { onEdit: vi.fn() }));

    expect(markup).toContain('<p role="status"');
    expect(markup).toContain('aria-label="Daily check-in"');
    expect(markup).not.toContain('<section aria-label="Daily check-in" role="status"');
    expect(markup.indexOf("</p>")).toBeLessThan(markup.indexOf("<button"));
    expect(markup).toContain("Today&#x27;s check-in is saved for this course.");
    expect(markup).toContain(">Edit check-in</button>");
    expect(markup).toContain("min-h-11");
    expect(markup).toContain("focus-visible:outline");
  });
});
