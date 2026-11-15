import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LearnerMessages, MessageRow, MessagesEmpty } from "./messages";

function msg(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    subject: null,
    body: "How do I approach question 3 on the load table?",
    sentAt: "2026-11-14T10:30:00.000Z",
    isRead: false,
    reply: null,
    from: { name: "Dr. Ayesha Khan", email: "ayesha@example.com" },
    to: { name: "Ali Raza", email: "ali@example.com" },
    ...overrides,
  };
}

describe("LearnerMessages initial render (rules 4 + 8 + 11)", () => {
  it("shows an honest disabled composer and a loading skeleton before data", () => {
    const html = renderToStaticMarkup(createElement(LearnerMessages));

    expect(html).toContain("No instructor assigned yet — messages need a course instructor.");
    expect(html).toContain('id="msg-body"');
    expect(html).toContain('disabled=""'); // textarea + send are inert without an instructor
    expect(html).toContain("Type your question");
    expect(html).toContain('aria-busy="true"');
  });

  it("keeps box filters inline as 44px chips with visible focus (rules 2 + 12)", () => {
    const html = renderToStaticMarkup(createElement(LearnerMessages));

    // The three box chips carry `capitalize`; Send does not.
    const chips = html
      .split("<button ")
      .slice(1)
      .map((tag) => tag.split(">")[0])
      .filter((tag) => tag.includes("capitalize"));
    expect(chips).toHaveLength(3);
    for (const chip of chips) {
      expect(chip).toContain("h-11");
      expect(chip).toContain("focus-visible:outline-2");
      expect(chip).toContain("focus-visible:outline-focus");
      expect(chip).toContain('aria-pressed=');
    }
  });

  it("makes Send the single brand-filled action (rule 11)", () => {
    const html = renderToStaticMarkup(createElement(LearnerMessages));
    const send = html.split("<button ").slice(1).map((tag) => tag.split(">")[0]).find((tag) => tag.includes("bg-brand px-3"));
    expect(send).toContain("bg-brand");
    expect(send).toContain("text-on-brand");
    expect(send).toContain("focus-visible:outline-focus");
  });
});

describe("MessagesEmpty (rule 9 — empty states point forward)", () => {
  it("points to the composer when an instructor exists", () => {
    const html = renderToStaticMarkup(createElement(MessagesEmpty, { instructorName: "Dr. Ayesha Khan", box: "received" }));
    expect(html).toContain("No received messages");
    expect(html).toContain("Ask Dr. Ayesha Khan a question above — replies land here.");
  });

  it("explains the enrollment precondition honestly when no instructor exists", () => {
    const html = renderToStaticMarkup(createElement(MessagesEmpty, { instructorName: null, box: "all" }));
    expect(html).toContain("No all messages");
    expect(html).toContain("Once you&#x27;re enrolled with an instructor, your conversation lives here.");
  });
});

describe("MessageRow (rules 7 + 10 + 12)", () => {
  it("leads with the correspondent and marks unread with a chip", () => {
    const html = renderToStaticMarkup(createElement(MessageRow, { msg: msg(), box: "received", onDelete: () => {} }));
    expect(html).toContain("From Dr. Ayesha Khan");
    expect(html).toContain(">new</span>");
    expect(html).toContain(msg().body);
  });

  it("shows the recipient instead for sent messages, without a new chip", () => {
    const html = renderToStaticMarkup(
      createElement(MessageRow, { msg: msg({ isRead: false }), box: "sent", onDelete: () => {} }),
    );
    expect(html).toContain("To Ali Raza");
    expect(html).not.toContain(">new</span>");
  });

  it("renders the instructor reply as a distinct block", () => {
    const html = renderToStaticMarkup(
      createElement(MessageRow, {
        msg: msg({ isRead: true, reply: "Start by summing the dead loads column by column." }),
        box: "received",
        onDelete: () => {},
      }),
    );
    expect(html).toContain("Reply:");
    expect(html).toContain("Start by summing the dead loads column by column.");
    expect(html).not.toContain(">new</span>"); // read messages carry no badge
  });

  it("keeps delete a 44px focus-visible target with a plain-language confirm (rules 6 + 12)", () => {
    const html = renderToStaticMarkup(createElement(MessageRow, { msg: msg(), box: "received", onDelete: () => {} }));
    const del = html.split("<button ").slice(1).map((tag) => tag.split(">")[0]).find((tag) => tag.includes("h-11 w-11"));
    expect(del).toContain('aria-label="Delete message"');
    expect(del).toContain("focus-visible:outline-2");
    // Event handlers do not render to static markup; pin the confirm copy at the source.
    const source = readFileSync(new URL("./messages.tsx", import.meta.url), "utf8");
    expect(source).toContain('"Delete this message? This cannot be undone."');
  });
});
