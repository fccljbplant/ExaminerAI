import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AIAssistantBox } from "./assistant-box";

describe("AIAssistantBox initial render (rules 6 + 8 + 11 + 12)", () => {
  it("suggests real questions instead of an empty box", () => {
    const html = renderToStaticMarkup(createElement(AIAssistantBox));
    expect(html).toContain("AI assistant");
    expect(html).toContain("who is struggling this week?");
    expect(html).toContain("draft a check-in prompt");
  });

  it("labels the input visibly for screen readers and rings both controls", () => {
    const html = renderToStaticMarkup(createElement(AIAssistantBox));
    expect(html).toContain('for="class-ai-input"');
    expect(html).toContain('id="class-ai-input"');
    expect(html).toContain('aria-label="Assistant conversation"');
    const input = html.split("<input ")[1].split(">")[0];
    expect(input).toContain("focus-visible:outline-focus");
    const btn = html.split("<button ")[1].split(">")[0];
    expect(btn).toContain("h-11");
    expect(btn).toContain("focus-visible:outline-focus");
  });

  it("keeps Ask as the single primary action, disabled until there is a question", () => {
    const html = renderToStaticMarkup(createElement(AIAssistantBox));
    const btn = html.split("<button ")[1].split(">")[0];
    expect(btn).toContain("bg-brand");
    expect(btn).toContain('disabled=""');
  });
});
