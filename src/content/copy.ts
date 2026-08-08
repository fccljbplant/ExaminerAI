/**
 * src/content/copy.ts — single source of truth for marketing + product messaging.
 *
 * WHY THIS FILE EXISTS:
 *   The old hero copy ("Your experts are busy building. We train the people
 *   who'll build next.") read as "we do it instead of you" — which betrays
 *   the actual model. Mentors are still in the loop; AI just carries the
 *   heavy part. This file centralizes the corrected voice so the same
 *   sentence never drifts back across pages.
 *
 * VOICE RULES (for anyone writing copy on this project):
 *   1. AI = hands. Mentors = judgment. Never imply judgment is optional.
 *   2. Banned words: "replace", "no engineers needed", "fully automated",
 *      "zero human effort", "train without mentors", "we do it so you
 *      don't have to".
 *   3. Preferred words: "share the burden", "help", "alongside", "support",
 *      "mentor-in-the-loop", "time back for the work only they can do".
 *
 *   Rule of thumb: if a line makes the mentor's judgment sound unnecessary,
 *   rewrite it.
 */

export const COPY = {
  /** Hero headline — the one promise the product makes. */
  heroTitle: "We don't replace your engineers. We share the training burden.",

  /** Hero subhead — explains the partnership split in one breath. */
  heroSub:
    "AI handles the daily teaching and examining, so your mentors can do " +
    "what only humans can — guide, encourage, and step in where AI flags " +
    "struggle. Your experts keep their time. Your trainees keep their humans.",

  /** Hero eyebrow — the category line above the headline. */
  heroEyebrow: "AI-DRIVEN TRAINING OS · B2C FOR LEARNERS · B2B FOR TEAMS",

  /** Primary CTA — B2C funnel entry. */
  ctaPrimary: "Share the burden — start free",

  /** Secondary CTA — B2B funnel entry. */
  ctaBusiness: "For teams: see how it helps",

  /** B2B strip — short value prop shown on marketing + business pages. */
  b2bStrip:
    "Share the burden — seats, assignments and readiness dashboards that " +
    "support your mentors, not sideline them.",

  /** Mentor Brief header — sets mentor expectations on first open. */
  mentorBrief: "You guide. AI does the legwork. Your trainees still get you.",

  /** Org Admin subtitle — the value prop for org-level buyers. */
  orgSubtitle: "Your engineers get their time back — mentorship stays human.",

  /** Problem framing line — the "why this product exists" sentence. */
  problemLine: "Engineers shouldn't have to train interns alone.",

  /** Learner-facing promise — what the learner sees on their dashboard. */
  learnerPromise:
    "AI checks your progress daily — and knows exactly when to bring your mentor in.",

  /** Old hero line — kept here so we can grep for stragglers and remove them. */
  _legacyHero: "Your experts are busy building. We train the people who'll build next.",

  /** Stats row — proof points under the hero. */
  stats: [
    { value: "~7h", label: "returned to each mentor / week" },
    { value: "100%", label: "mentor-in-the-loop" },
    { value: "61%", label: "completion (industry: 15%)" },
  ],
} as const;

/**
 * Check whether a string contains any banned voice words. Use in CI to
 * catch regressions — if a string fails this check, rewrite it.
 *
 *   if (hasBannedVoiceWord(someString)) throw new Error("rewrite this copy");
 */
export function hasBannedVoiceWord(text: string): boolean {
  const banned = [
    "no engineers needed",
    "fully automated training",
    "train without mentors",
    "zero human effort",
    "we do it so you don't have to",
  ];
  const lower = text.toLowerCase();
  return banned.some((phrase) => lower.includes(phrase));
}
