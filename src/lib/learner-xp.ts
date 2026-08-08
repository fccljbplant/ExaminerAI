/**
 * src/lib/learner-xp.ts — Evidence-Locked XP system (learners only).
 *
 * WHAT THIS IS
 * ===========
 * XP earned ONLY from verified, AI-graded actions — never from
 * engagement metrics like posting, commenting, or logging in.
 *
 * Why "evidence-locked"? Because the XP is a trust signal for
 * employers, not an engagement bait. A learner with 2,000 XP has
 * demonstrably passed 20+ Socratic assessments — not just been
 * "active" on the platform.
 *
 * WHAT EARNS XP (and how much)
 * ============================
 *   Daily test completed       +20 XP  (only on pass, score >= 60)
 *   Daily test aced            +30 XP  (bonus for score >= 90)
 *   Weekly test completed      +50 XP  (only on pass, score >= 60)
 *   Weekly test aced           +80 XP  (bonus for score >= 90)
 *   Drill card mastered        +10 XP  (spaced-repetition mastery)
 *   Project week completed     +40 XP  (all week's tasks done)
 *   Project milestone signed off by mentor  +60 XP
 *
 * WHAT DOES NOT EARN XP
 * =====================
 *   - Logging in
 *   - Posting a comment
 *   - Messaging the mentor
 *   - Watching a video
 *   - "Engaging" with content
 *
 * These are important activities, but they don't demonstrate
 * competence. Awarding XP for them would dilute the trust signal.
 *
 * LEVELS (casual, not sweaty)
 * ===========================
 *   Level 1:    0 — 99 XP      "Just started"
 *   Level 2:  100 — 299 XP     "Finding their feet"
 *   Level 3:  300 — 599 XP     "Building confidence"
 *   Level 4:  600 — 999 XP     "Getting solid"
 *   Level 5: 1000 — 1499 XP    "Capstone-ready"
 *   Level 6: 1500 — 2199 XP    "Job-ready"
 *   Level 7: 2200+ XP          "Mentor-tier"
 *
 * Voice rule: levels are described in casual-yet-professional terms.
 * No "Beginner / Intermediate / Advanced" — that's LMS-speak. The
 * labels read like a calm colleague's assessment.
 *
 * STORAGE
 * =======
 * XP awards are stored inside the existing `User.journeyProgress` JSON
 * field (which already defaults to "[]"). The shape:
 *   [
 *     { type: "xp", reason: "DAILY_TEST_PASSED", refId: "test_123", amount: 20, at: "2026-08-08T..." },
 *     ...
 *   ]
 * No schema migration needed.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// ── XP awards (single source of truth) ────────────────────────────
export const XP_AWARDS = {
  DAILY_TEST_PASSED: 20,
  DAILY_TEST_ACED: 30,        // bonus on top of DAILY_TEST_PASSED
  WEEKLY_TEST_PASSED: 50,
  WEEKLY_TEST_ACED: 80,       // bonus on top of WEEKLY_TEST_PASSED
  DRILL_MASTERED: 10,
  PROJECT_WEEK_COMPLETED: 40,
  PROJECT_MILESTONE_SIGNED: 60,
} as const;

export type XPAwardReason = keyof typeof XP_AWARDS;

interface XPAwardEntry {
  type: "xp";
  reason: XPAwardReason;
  refId?: string;
  amount: number;
  at: string; // ISO timestamp
}

// ── Levels (the casual-but-professional progression) ─────────────
export interface Level {
  level: number;
  minXp: number;
  maxXp: number | null;
  label: string;
  hint: string;
}

export const LEVELS: Level[] = [
  { level: 1, minXp: 0,    maxXp: 99,    label: "Just started",        hint: "Welcome. Take your first daily test to earn XP." },
  { level: 2, minXp: 100,  maxXp: 299,   label: "Finding their feet",  hint: "Daily tests are adding up. Keep the streak." },
  { level: 3, minXp: 300,  maxXp: 599,   label: "Building confidence", hint: "You've passed a weekly test. The hard part's behind you." },
  { level: 4, minXp: 600,  maxXp: 999,   label: "Getting solid",       hint: "Multiple weeks down. Project is taking shape." },
  { level: 5, minXp: 1000, maxXp: 1499,  label: "Capstone-ready",      hint: "You can present your project with confidence." },
  { level: 6, minXp: 1500, maxXp: 2199,  label: "Job-ready",           hint: "Your capstone is signed off. Time to apply." },
  { level: 7, minXp: 2200, maxXp: null,  label: "Mentor-tier",         hint: "You could mentor a peer through this course." },
];

/** Get the level for a given XP total. */
export function levelForXp(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) return LEVELS[i];
  }
  return LEVELS[0];
}

/** Get the XP progress within the current level (0-100%). */
export function levelProgress(xp: number): { current: number; needed: number; pct: number; toNext: number } {
  const lvl = levelForXp(xp);
  if (lvl.maxXp === null) {
    return { current: xp - lvl.minXp, needed: 0, pct: 100, toNext: 0 };
  }
  const needed = lvl.maxXp - lvl.minXp + 1;
  const current = xp - lvl.minXp;
  return {
    current,
    needed,
    pct: Math.min(100, Math.round((current / needed) * 100)),
    toNext: Math.max(0, lvl.maxXp + 1 - xp),
  };
}

/** Parse the journeyProgress JSON safely. Returns [] on any error. */
function parseJourney(raw: string | null | undefined): XPAwardEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is XPAwardEntry =>
        typeof item === "object" && item !== null && item.type === "xp",
    );
  } catch {
    return [];
  }
}

/** Serialize back to JSON, preserving non-XP entries already in the array. */
function serializeJourney(existing: unknown[], xpEntries: XPAwardEntry[]): string {
  // Keep non-XP entries (the field may be used for other journey data too).
  const nonXp = existing.filter(
    (item) => typeof item !== "object" || item === null || (item as any).type !== "xp",
  );
  return JSON.stringify([...nonXp, ...xpEntries]);
}

/**
 * Award XP to a learner. Idempotent — if the same `reason` + `refId`
 * has already been awarded, this is a no-op. This prevents double-XP
 * bugs when a webhook fires twice or a user refreshes mid-grading.
 */
export async function awardXP(params: {
  userId: string;
  reason: XPAwardReason;
  refId?: string;
}): Promise<{ awarded: number; newTotal: number; level: Level } | null> {
  const { userId, reason, refId } = params;
  const amount = XP_AWARDS[reason];

  try {
    // Read current journey.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { journeyProgress: true },
    });
    if (!user) return null;

    const entries = parseJourney(user.journeyProgress);

    // Idempotency check.
    if (refId) {
      const alreadyAwarded = entries.some(
        (e) => e.reason === reason && e.refId === refId,
      );
      if (alreadyAwarded) {
        logger.info("XP award skipped (already awarded)", { userId, reason, refId });
        return null;
      }
    }

    // Append the new award.
    const newEntry: XPAwardEntry = {
      type: "xp",
      reason,
      refId: refId || undefined,
      amount,
      at: new Date().toISOString(),
    };
    const updatedEntries = [...entries, newEntry];

    // Preserve any non-XP entries already in the journey JSON.
    let existingParsed: unknown[] = [];
    try { existingParsed = JSON.parse(user.journeyProgress || "[]"); } catch { /* ignore */ }
    const newJson = serializeJourney(existingParsed, updatedEntries);

    await db.user.update({
      where: { id: userId },
      data: { journeyProgress: newJson },
    });

    const newTotal = updatedEntries.reduce((sum, e) => sum + e.amount, 0);
    const level = levelForXp(newTotal);

    logger.info("XP awarded", { userId, reason, amount, newTotal, level: level.level });

    return { awarded: amount, newTotal, level };
  } catch (err) {
    logger.warn("XP award failed", {
      userId,
      reason,
      refId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Get a learner's current XP total + level + progress to next level. */
export async function getLearnerXP(userId: string): Promise<{
  total: number;
  level: Level;
  progress: { current: number; needed: number; pct: number; toNext: number };
  recentAwards: XPAwardEntry[];
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { journeyProgress: true },
  });
  const entries = parseJourney(user?.journeyProgress);
  const xp = entries.reduce((sum, e) => sum + e.amount, 0);

  return {
    total: xp,
    level: levelForXp(xp),
    progress: levelProgress(xp),
    recentAwards: entries.slice(-5).reverse(), // last 5 awards, newest first
  };
}
