import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NoEnrollment } from "./home";

describe("LearnerHome empty state", () => {
  it("provides a primary heading when the learner has no course enrolments", () => {
    const html = renderToStaticMarkup(createElement(NoEnrollment));

    expect(html).toContain("<h1");
    expect(html).toContain("Start your first course");
    expect(html).toContain('href="/learner/learn"');
  });
});
