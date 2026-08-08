/**
 * src/lib/learner-badges.ts — Evidence-Locked Badge system.
 *
 * Badges are earned ONLY from verified, AI-graded actions — same principle
 * as the XP system. No "participation" badges, no "logged in 3 days" badges.
 * Every badge is a trust signal an employer can verify.
 *
 * Badge categories:
 *   - test:       Socratic test achievements (first test, streak, perfect score)
 *   - project:    Capstone project milestones (first task, week done, milestone signed)
 *   - skill:      Skill mastery (drills mastered, topics covered)
 *   - course:     Course completion (finish a course, finish with distinction)
 *   - streak:     Consistency (7-day, 30-day streaks)
 *
 * Storage: inside User.journeyProgress JSON (same as XP). Shape:
 *   [{ type: "xp", ... }, { type: "badge", badgeId, awardedAt }]
 *
 * Idempotent: awardBadge() checks for existing badge before awarding.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji for simplicity (🎓, 🏆, 🔥, ⭐, 🚀, etc.)
  category: "test" | "project" | "skill" | "course" | "streak";
  tier: "bronze" | "silver" | "gold" | "platinum";
  /** XP bonus awarded WITH the badge (stacks on top of normal XP). */
  xpBonus?: number;
}

export const BADGES: BadgeDef[] = [
  // ── TEST BADGES ──────────────────────────────────────────────
  { id: "first_test", name: "First Test", description: "Completed your first daily test.", icon: "📝", category: "test", tier: "bronze", xpBonus: 10 },
  { id: "first_weekly", name: "Weekly Warrior", description: "Completed your first weekly test.", icon: "⚔️", category: "test", tier: "bronze", xpBonus: 20 },
  { id: "perfect_daily", name: "Perfect Day", description: "Scored 100% on a daily test.", icon: "💯", category: "test", tier: "silver", xpBonus: 30 },
  { id: "perfect_weekly", name: "Flawless", description: "Scored 100% on a weekly test.", icon: "🏆", category: "test", tier: "gold", xpBonus: 50 },
  { id: "test_streak_7", name: "Test Streak", description: "Completed a daily test 7 days in a row.", icon: "🔥", category: "test", tier: "silver", xpBonus: 40 },
  { id: "test_streak_30", name: "Unstoppable", description: "Completed a daily test 30 days in a row.", icon: "⚡", category: "test", tier: "platinum", xpBonus: 100 },

  // ── PROJECT BADGES ───────────────────────────────────────────
  { id: "first_task", name: "First Steps", description: "Completed your first project task.", icon: "👣", category: "project", tier: "bronze", xpBonus: 10 },
  { id: "week_complete", name: "Week Done", description: "Completed all tasks in a project week.", icon: "✅", category: "project", tier: "silver", xpBonus: 40 },
  { id: "milestone_signed", name: "Milestone Approved", description: "Had a project milestone signed off by your mentor.", icon: "签字", category: "project", tier: "gold", xpBonus: 60 },
  { id: "project_complete", name: "Capstone Complete", description: "Finished your entire capstone project.", icon: "🎓", category: "project", tier: "platinum", xpBonus: 200 },

  // ── SKILL BADGES ─────────────────────────────────────────────
  { id: "first_drill", name: "Drill Master", description: "Mastered your first spaced-repetition drill.", icon: "🎯", category: "skill", tier: "bronze", xpBonus: 10 },
  { id: "drills_10", name: "Sharp Shooter", description: "Mastered 10 drill cards.", icon: "🏹", category: "skill", tier: "silver", xpBonus: 30 },
  { id: "drills_50", name: "Sharpshooter Elite", description: "Mastered 50 drill cards.", icon: "🎖️", category: "skill", tier: "gold", xpBonus: 80 },

  // ── COURSE BADGES ────────────────────────────────────────────
  { id: "course_complete", name: "Course Complete", description: "Finished an entire course.", icon: "🎓", category: "course", tier: "gold", xpBonus: 100 },
  { id: "course_distinction", name: "With Distinction", description: "Finished a course with score ≥ 85%.", icon: "🌟", category: "course", tier: "platinum", xpBonus: 150 },

  // ── STREAK BADGES ────────────────────────────────────────────
  { id: "streak_7", name: "Week Warrior", description: "7-day study streak.", icon: "📅", category: "streak", tier: "bronze", xpBonus: 20 },
  { id: "streak_30", name: "Monthly Master", description: "30-day study streak.", icon: "🗓️", category: "streak", tier: "silver", xpBonus: 50 },
  { id: "streak_100", name: "Centurion", description: "100-day study streak.", icon: "💯", category: "streak", tier: "gold", xpBonus: 150 },
];

const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(BADGES.map(b => [b.id, b]));

export function getBadge(badgeId: string): BadgeDef | null {
  return BADGE_MAP[badgeId] || null;
}

// ── Journey storage (shared with XP system) ────────────────────
interface XPAwardEntry {
  type: "xp";
  reason: string;
  refId?: string;
  amount: number;
  at: string;
}

interface BadgeAwardEntry {
  type: "badge";
  badgeId: string;
  awardedAt: string;
}

function parseJourney(raw: string | null | undefined): { xp: XPAwardEntry[]; badges: BadgeAwardEntry[]; other: unknown[] } {
  if (!raw) return { xp: [], badges: [], other: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { xp: [], badges: [], other: [] };
    const xp: XPAwardEntry[] = [];
    const badges: BadgeAwardEntry[] = [];
    const other: unknown[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      if (item.type === "xp") xp.push(item);
      else if (item.type === "badge") badges.push(item);
      else other.push(item);
    }
    return { xp, badges, other };
  } catch {
    return { xp: [], badges: [], other: [] };
  }
}

function serializeJourney(xp: XPAwardEntry[], badges: BadgeAwardEntry[], other: unknown[]): string {
  return JSON.stringify([...other, ...xp, ...badges]);
}

/**
 * Award a badge to a learner. Idempotent — if the badge is already
 * awarded, this is a no-op. Returns the badge + whether it was newly
 * awarded (so the UI can fire the celebration animation).
 */
export async function awardBadge(params: {
  userId: string;
  badgeId: string;
}): Promise<{ badge: BadgeDef; newlyAwarded: boolean } | null> {
  const { userId, badgeId } = params;
  const badge = getBadge(badgeId);
  if (!badge) {
    logger.warn("Unknown badge ID", { badgeId, userId });
    return null;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { journeyProgress: true },
    });
    if (!user) return null;

    const { xp, badges, other } = parseJourney(user.journeyProgress);

    // Idempotency check
    if (badges.some(b => b.badgeId === badgeId)) {
      return { badge, newlyAwarded: false };
    }

    // Award the badge
    const newEntry: BadgeAwardEntry = {
      type: "badge",
      badgeId,
      awardedAt: new Date().toISOString(),
    };
    const updatedBadges = [...badges, newEntry];
    const newJson = serializeJourney(xp, updatedBadges, other);

    await db.user.update({
      where: { id: userId },
      data: { journeyProgress: newJson },
    });

    logger.info("Badge awarded", { userId, badgeId, badgeName: badge.name });

    // Create a notification for the badge award
    try {
      await db.notification.create({
        data: {
          userId,
          type: "badge_earned",
          title: `Badge earned: ${badge.name}`,
          body: `${badge.description}${badge.xpBonus ? ` (+${badge.xpBonus} XP bonus)` : ""}`,
          link: "/app?view=progress",
          read: false,
        },
      });
    } catch { /* non-blocking */ }

    return { badge, newlyAwarded: true };
  } catch (err) {
    logger.warn("Badge award failed", {
      userId,
      badgeId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Get all badges a learner has earned, sorted by award date (newest first).
 */
export async function getLearnerBadges(userId: string): Promise<Array<BadgeAwardEntry & { badge: BadgeDef }>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { journeyProgress: true },
  });
  const { badges } = parseJourney(user?.journeyProgress);
  return badges
    .map(b => ({ ...b, badge: getBadge(b.badgeId)! }))
    .filter(b => b.badge) // filter out unknown badge IDs (deleted badges)
    .sort((a, b) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime());
}

/**
 * Check if a learner has a specific badge.
 */
export async function hasBadge(userId: string, badgeId: string): Promise<boolean> {
  const badges = await getLearnerBadges(userId);
  return badges.some(b => b.badgeId === badgeId);
}

/**
 * Get badge stats for a learner: count by tier, total earned, latest.
 */
export async function getBadgeStats(userId: string): Promise<{
  total: number;
  byTier: Record<string, number>;
  latest: (BadgeAwardEntry & { badge: BadgeDef }) | null;
}> {
  const badges = await getLearnerBadges(userId);
  const byTier: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  for (const b of badges) {
    byTier[b.badge.tier] = (byTier[b.badge.tier] || 0) + 1;
  }
  return {
    total: badges.length,
    byTier,
    latest: badges[0] || null,
  };
}
