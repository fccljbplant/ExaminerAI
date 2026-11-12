import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TestChatUI } from "./TestChatUI";

describe("TestChatUI accessible learning layout", () => {
  it("renders topic context, question progress and an accessible answer composer", () => {
    const html = renderToStaticMarkup(
      createElement(TestChatUI, {
        conversation: [{
          role: "examiner",
          content: "Explain how this component works.",
          timestamp: "2026-11-12T00:00:00.000Z",
          questionIndex: 1,
        }],
        input: "",
        onInputChange: () => undefined,
        onSend: () => undefined,
        busy: false,
        currentQuestion: 1,
        questionCountLabel: "Question 2 of 3",
        questionTotal: 3,
        topicBadge: "React fundamentals",
      }),
    );

    expect(html).toContain("React fundamentals");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemax="3"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-label="Test conversation"');
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain('style="max-height:40vh;min-height:min(220px, 40vh)"');
    expect(html).toContain('for="test-answer-input"');
    expect(html).toContain('id="test-answer-input"');
    expect(html).toContain("Your answer");
  });

  it("does not render a misleading progress meter when the question total is unknown", () => {
    const html = renderToStaticMarkup(
      createElement(TestChatUI, {
        conversation: [],
        input: "",
        onInputChange: () => undefined,
        onSend: () => undefined,
        busy: false,
      }),
    );

    expect(html).not.toContain('role="progressbar"');
  });

  it("bounds the conversation scroll region and exposes its busy state", () => {
    const html = renderToStaticMarkup(
      createElement(TestChatUI, {
        conversation: [],
        input: "An answer",
        onInputChange: () => undefined,
        onSend: () => undefined,
        busy: true,
        maxHeight: "55vh",
      }),
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('style="max-height:55vh;min-height:min(220px, 55vh)"');
  });
});
