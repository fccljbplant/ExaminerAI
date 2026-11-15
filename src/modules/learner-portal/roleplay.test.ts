import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CompletedPanel,
  RoleplayPractice,
  RoleplayRun,
  ScenarioCard,
  TurnBubble,
  TurnStatus,
} from "./roleplay";

const scenario = {
  id: "sc-1",
  key: "salary",
  title: "Salary negotiation",
  personaName: "Dana Chen",
  goal: "Reach a fair offer without losing the room.",
  turnBudget: 6,
  difficulty: "Medium",
};

describe("RoleplayPractice initial render (rule 8)", () => {
  it("scaffolds honestly: heading, purpose, skeletons — no fabricated scenarios", () => {
    const html = renderToStaticMarkup(createElement(RoleplayPractice));

    expect(html).toContain("Roleplay practice");
    expect(html).toContain("Every reply is scored");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Start scenario");
  });
});

describe("ScenarioCard (rules 2 + 10 + 12)", () => {
  const html = renderToStaticMarkup(
    createElement(ScenarioCard, { scenario, starting: false, disabled: false, onStart: () => {} }),
  );

  it("leads with the title and keeps difficulty, persona, budget and goal inline", () => {
    expect(html.indexOf("Salary negotiation")).toBeLessThan(html.indexOf("Persona: Dana Chen"));
    expect(html).toContain("Medium");
    expect(html).toContain("Persona: Dana Chen · 6 turns");
    expect(html).toContain("Reach a fair offer without losing the room.");
    expect(html).toContain("Start scenario");
  });

  it("is a large ringed target", () => {
    const btn = html.split("<button ")[1].split(">")[0];
    expect(btn).toContain("min-h-36");
    expect(btn).toContain("focus-visible:outline-focus");
  });

  it("shows progress while starting and disables the row of siblings", () => {
    const starting = renderToStaticMarkup(
      createElement(ScenarioCard, { scenario, starting: true, disabled: true, onStart: () => {} }),
    );
    expect(starting).toContain("Starting…");
    expect(starting).toContain('disabled=""');
  });
});

describe("TurnStatus (rules 7 + 9)", () => {
  it("stays calm while the budget is healthy", () => {
    const html = renderToStaticMarkup(createElement(TurnStatus, { completed: false, remaining: 5 }));
    expect(html).toContain("5 turns left");
    expect(html).not.toContain("border-danger");
  });

  it("shifts to the danger tone only at the last two turns", () => {
    const two = renderToStaticMarkup(createElement(TurnStatus, { completed: false, remaining: 2 }));
    expect(two).toContain("2 turns left");
    expect(two).toContain("border-danger/40");
  });

  it("pluralizes exactly one turn and reports completion", () => {
    expect(renderToStaticMarkup(createElement(TurnStatus, { completed: false, remaining: 1 }))).toContain("1 turn left");
    expect(renderToStaticMarkup(createElement(TurnStatus, { completed: true, remaining: 0 }))).toContain("Completed");
  });
});

describe("TurnBubble (rule 1 — chat stage pattern)", () => {
  it("tints student replies brand, personas bordered", () => {
    const student = renderToStaticMarkup(
      createElement(TurnBubble, { turn: { role: "student", content: "Let's find middle ground." } }),
    );
    expect(student).toContain("bg-brand text-on-brand");

    const persona = renderToStaticMarkup(
      createElement(TurnBubble, { turn: { role: "persona", content: "That number is hard for me." } }),
    );
    expect(persona).toContain("border border-line bg-surface text-fg");
    expect(persona).not.toContain("Score:");
  });

  it("carries the per-turn score and feedback on the persona bubble", () => {
    const html = renderToStaticMarkup(
      createElement(TurnBubble, {
        turn: { role: "persona", content: "Interesting.", score: 82, feedback: "Named a number without anchoring it." },
      }),
    );
    expect(html).toContain("Score: 82/100.");
    expect(html).toContain("Named a number without anchoring it.");
  });
});

describe("CompletedPanel (rules 6 + 11 + 12)", () => {
  const run: RoleplayRun = {
    id: "r1",
    scenarioId: "sc-1",
    status: "completed",
    score: 78,
    completedAt: "2026-11-15T00:00:00.000Z",
    turns: [
      { role: "student", content: "Hi" },
      { role: "persona", content: "Hello.", score: 90, feedback: "Warm opener." },
      { role: "persona", content: "Bye.", score: 66, feedback: "Closed without a summary." },
    ],
  };

  const html = renderToStaticMarkup(createElement(CompletedPanel, { run, onRestart: () => {} }));

  it("puts the average score up front and lists every scored turn's feedback", () => {
    expect(html.indexOf("average score:")).toBeGreaterThan(-1);
    expect(html).toContain("78");
    expect(html).toContain("90/100");
    expect(html).toContain("Warm opener.");
    expect(html).toContain("66/100");
    expect(html).toContain("Closed without a summary.");
  });

  it("offers one ringed 44px restart", () => {
    const btn = html.split("<button ")[1].split(">")[0];
    expect(btn).toContain("min-h-11");
    expect(btn).toContain("focus-visible:outline-focus");
    expect(html).toContain("Try again");
  });

  it("stays honest when the average has not been computed", () => {
    const unscored = renderToStaticMarkup(
      createElement(CompletedPanel, { run: { ...run, score: null }, onRestart: () => {} }),
    );
    expect(unscored).toContain("—");
  });
});
