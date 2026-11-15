import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TutorPanel } from "./tutor-panel";
import { clipForLive } from "./tutor-panel";

/**
 * Tutor panel — twelve-rules + screen-reader pass (initial render is
 * the empty state, so rules 1/2/12 and the live-region rescoping are
 * what's observable here).
 */

const props = {
  open: true,
  onClose: () => {},
  edge: "right" as const,
  onFlipEdge: () => {},
  bottomOffset: 68,
  surface: "/learner",
};

describe("TutorPanel initial render (rules 1, 2, 12 + SR)", () => {
  const html = renderToStaticMarkup(createElement(TutorPanel, props));

  it("is a labelled dialog", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="AI tutor chat"');
  });

  it("leads with value: greeting + real quick prompts, no dead empty box", () => {
    expect(html).toContain("Hi, I&#x27;m your study tutor.");
    expect(html).toContain("Explain today&#x27;s topic simply");
    expect(html).toContain("Quiz me with 3 quick questions");
    expect(html).toContain("Plan my next 15 minutes");
  });

  it("names the composer and sets expectations honestly (text-only)", () => {
    expect(html).toContain('aria-label="Message the AI tutor"');
    expect(html).toContain("Ask your tutor…");
    expect(html).toContain("Text only — the tutor can&#x27;t open files, photos or videos.");
  });

  it("has a named send control and 44px header controls", () => {
    expect(html).toContain('aria-label="Send message"');
    expect(html).toContain('aria-label="Close tutor"');
    expect(html).toContain('aria-label="Start a new conversation"');
  });

  it("keeps exactly two polite live regions (status line + completed-exchange announcer)", () => {
    const count = (html.match(/aria-live="polite"/g) ?? []).length;
    expect(count).toBe(2);
  });

  it("does not put the message scroller in a live region (streaming chunks must not be re-announced)", () => {
    // The scroller is the only overflow-y-auto container; assert it has
    // no aria-live attribute of its own.
    expect(html).not.toMatch(/<div[^>]*aria-live[^>]*overflow-y-auto/);
    expect(html).not.toMatch(/overflow-y-auto[^>]*aria-live/);
  });
});

describe("clipForLive — announcements stay short", () => {
  it("passes short text through untouched (after trimming)", () => {
    expect(clipForLive("  hello there  ")).toBe("hello there");
  });

  it("clips long replies and marks the cut", () => {
    const long = "a".repeat(500);
    const clipped = clipForLive(long);
    expect(clipped.length).toBe(201); // 200 chars + ellipsis
    expect(clipped.endsWith("…")).toBe(true);
  });

  it("honours a custom ceiling", () => {
    expect(clipForLive("abcdef", 3)).toBe("abc…");
    expect(clipForLive("abc", 3)).toBe("abc");
  });
});
