import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ActivityStrip,
  Badges,
  Credentials,
  LearnerProgress,
  ProgressData,
  ProgressError,
  WeeklyTests,
  WeakTopics,
} from "./progress";

const base: ProgressData = {
  learner: { totalXP: 0, level: "L1", streakCurrent: 0, streakLongest: 0 },
  courses: [],
  activity: [],
  badges: [],
  certificates: [],
  weakTopics: [],
  reportCards: [],
  weeklyTests: [],
  checkins: [],
};

describe("LearnerProgress initial render (rule 8)", () => {
  it("scaffolds while loading — no fabricated numbers", () => {
    const html = renderToStaticMarkup(createElement(LearnerProgress));
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Total XP");
    expect(html).not.toContain("Badges");
  });
});

describe("ActivityStrip (rules 7 + 8)", () => {
  it("answers the empty case with words, not an empty chart", () => {
    const html = renderToStaticMarkup(createElement(ActivityStrip, { activity: [] }));
    expect(html).toContain("No activity yet");
    expect(html).not.toContain('role="img"');
  });

  it("totals the XP and scales bars from the busiest day", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityStrip, {
        activity: [
          { date: "2026-11-12", xp: 10 },
          { date: "2026-11-13", xp: 0 },
          { date: "2026-11-14", xp: 30 },
        ],
      }),
    );
    expect(html).toContain("40 XP earned");
    expect(html).toContain('aria-label="Daily XP for the last 14 days, 40 total"');
    expect(html).toContain("height:33%"); // 10/30
    expect(html).toContain("height:6%"); // zero day keeps a visible floor
    expect(html).toContain("height:100%"); // 30/30
    expect(html).toContain("bg-bg-subtle"); // the zero day is muted, not brand
  });
});

describe("WeeklyTests (rule 7 — status says what and why)", () => {
  it("stays out of the way when there is nothing to show", () => {
    expect(renderToStaticMarkup(createElement(WeeklyTests, { tests: [] }))).toBe("");
  });

  it("tones by the 60 pass mark and stays honest about unscored weeks", () => {
    const html = renderToStaticMarkup(
      createElement(WeeklyTests, {
        tests: [
          { week: 1, score: 72 },
          { week: 2, score: 45 },
          { week: 3, score: null },
        ],
      }),
    );
    expect(html).toContain("bg-success");
    expect(html).toContain("bg-warning");
    expect(html).toContain("72%");
    expect(html).toContain("45%");
    expect(html).toContain("—"); // unscored, not a fabricated 0%
  });
});

describe("WeakTopics (rules 7 + 10)", () => {
  it("says why each topic is listed — pillar and mastery level", () => {
    const html = renderToStaticMarkup(
      createElement(WeakTopics, {
        topics: [{ topic: "Load paths", pillar: "Technical", masteryLevel: "Developing", trend: "up" }],
      }),
    );
    expect(html).toContain("Load paths");
    expect(html).toContain("Technical · Developing");
    expect(html).toContain('aria-label="trending up"');
    expect(html).toContain('role="img"'); // the trend icon announces for screen readers
  });

  it("reassures when nothing is weak", () => {
    expect(
      renderToStaticMarkup(createElement(WeakTopics, { topics: [] })),
    ).toContain("No weak topics detected");
  });
});

describe("Credentials (rules 8 + 12)", () => {
  const cert = {
    id: "cert-1",
    courseName: "Structural Basics",
    grade: "A",
    score: 92,
    issuedAt: "2026-10-01T00:00:00.000Z",
    verifyUrl: "https://verify.example/cert-1",
  };

  it("separates date, grade and score; Verify is a 44px ringed external link", () => {
    const html = renderToStaticMarkup(
      createElement(Credentials, { certificates: [cert], courses: [] }),
    );
    expect(html).toContain("· A · 92%");
    const link = html.split("<a ")[1].split(">")[0];
    expect(link).toContain("min-h-11");
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).toContain("focus-visible:outline-focus");
    expect(html).toContain("Verify");
  });

  it("shows the grade badge instead when there is no verify URL", () => {
    const html = renderToStaticMarkup(
      createElement(Credentials, {
        certificates: [{ ...cert, id: "cert-2", verifyUrl: null }],
        courses: [],
      }),
    );
    expect(html).not.toContain("Verify");
    expect(html).toContain(">A</span>");
  });

  it("offers the claim flow for completed courses with no certificate yet", () => {
    const html = renderToStaticMarkup(
      createElement(Credentials, {
        certificates: [],
        courses: [
          { courseId: "c1", courseName: "Structural Basics", percent: 100, position: null, totalWeeks: 6, totalXP: 1200, streakCurrent: 3 },
        ],
      }),
    );
    expect(html).toContain("claim your credential");
    expect(html).toContain("Claim certificate · Structural Basics");
  });

  it("explains itself when empty", () => {
    expect(
      renderToStaticMarkup(createElement(Credentials, { certificates: [], courses: [] })),
    ).toContain("Complete a course to earn a verified credential.");
  });
});

describe("Badges (rule 8)", () => {
  it("welcomes the future holder when empty", () => {
    expect(renderToStaticMarkup(createElement(Badges, { badges: [] }))).toContain(
      "Badges appear here as you hit milestones.",
    );
  });

  it("shows name and rarity per badge", () => {
    const html = renderToStaticMarkup(
      createElement(Badges, {
        badges: [
          { id: "b1", awardedAt: "2026-10-01", code: "streak7", name: "Week Warrior", description: "7-day streak", icon: "flame", rarity: "rare" },
        ],
      }),
    );
    expect(html).toContain("Week Warrior");
    expect(html).toContain("rare");
  });
});

describe("ProgressError (rules 6 + 12)", () => {
  it("keeps a way out with a ringed 44px retry", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressError, { message: "Network offline", onRetry: () => {} }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("load your progress");
    expect(html).toContain("Network offline");
    const btn = html.split("<button ")[1].split(">")[0];
    expect(btn).toContain("h-11");
    expect(btn).toContain("focus-visible:outline-focus");
  });
});
