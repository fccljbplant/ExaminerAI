import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckInSavedState } from "./checkin-card";

describe("CheckInSavedState accessibility", () => {
  it("announces the saved message without placing an interactive control inside the status region", () => {
    const html = renderToStaticMarkup(createElement(CheckInSavedState, { onEdit: vi.fn() }));

    expect(html).toContain('<p role="status"');
    expect(html).toContain("Today&#x27;s check-in is saved for this course.");
    expect(html).toContain(">Edit check-in</button>");
    expect(html).not.toContain('<section aria-label="Daily check-in" role="status"');
    expect(html.indexOf("</p>")).toBeLessThan(html.indexOf("<button"));
  });
});
