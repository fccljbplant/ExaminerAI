/**
 * GET /api/learn/me/badges?courseId=...
 *
 * Returns the authed user's earned badges. Optionally filtered by course.
 *
 * Badges are awarded by other parts of the system (XP thresholds,
 * streaks, course completion). This endpoint is read-only — it just
 * lists what's been earned.
 *
 * Returns: { badges: [{ id, code, name, description, icon, rarity, awardedAt, courseId }] }
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");

  const userBadges = await db.userBadge.findMany({
    where: { userId: user.sub, ...(courseId ? { courseId } : {}) },
    orderBy: { awardedAt: "desc" },
    include: { badge: true },
  });

  // Also auto-award streak + XP badges based on current profile state.
  // (Best-effort — wraps each in a try/catch so a failure here doesn't break the listing.)
  const profiles = courseId
    ? await db.learnProfile.findMany({ where: { userId: user.sub, courseId } })
    : await db.learnProfile.findMany({ where: { userId: user.sub } });
  for (const p of profiles) {
    // Streak-3 badge
    if (p.streakCurrent >= 3) {
      await ensureBadge(user.sub, "streak_3", "3-Day Streak", "Studied 3 days in a row.", "🔥", "common", p.courseId);
    }
    if (p.streakCurrent >= 7) {
      await ensureBadge(user.sub, "streak_7", "7-Day Streak", "A full week of daily practice!", "⚡", "rare", p.courseId);
    }
    // XP-threshold badges
    if (p.totalXP >= 100) {
      await ensureBadge(user.sub, "xp_100", "First 100 XP", "Crossed the 100 XP mark.", "⭐", "common", p.courseId);
    }
    if (p.totalXP >= 1000) {
      await ensureBadge(user.sub, "xp_1000", "Quadruple Digits", "Earned 1,000 XP. You're flying.", "🚀", "rare", p.courseId);
    }
    if (p.totalXP >= 5000) {
      await ensureBadge(user.sub, "xp_5000", "XP Mountain", "5,000 XP — you're in rarefied air.", "🏔️", "epic", p.courseId);
    }
  }

  // Re-fetch with newly-awarded badges.
  const finalBadges = await db.userBadge.findMany({
    where: { userId: user.sub, ...(courseId ? { courseId } : {}) },
    orderBy: { awardedAt: "desc" },
    include: { badge: true },
  });

  const badges = finalBadges.map((ub) => ({
    id: ub.id,
    code: ub.badge.code,
    name: ub.badge.name,
    description: ub.badge.description,
    icon: ub.badge.icon,
    rarity: ub.badge.rarity,
    awardedAt: ub.awardedAt,
    courseId: ub.courseId,
  }));

  return apiSuccess({ badges });
}

/** Idempotently award a badge to a user (no-op if already earned). */
async function ensureBadge(
  userId: string,
  code: string,
  name: string,
  description: string,
  icon: string,
  rarity: string,
  courseId: string,
): Promise<void> {
  try {
    const badge = await db.badgeDefinition.upsert({
      where: { code },
      update: {},
      create: { code, name, description, icon, rarity },
    });
    // courseId is required in the @@unique([userId, badgeId, courseId]) — but
    // Prisma treats null courseId as distinct. Pass the courseId explicitly.
    await db.userBadge.upsert({
      where: { userId_badgeId_courseId: { userId, badgeId: badge.id, courseId } },
      update: {},
      create: { userId, badgeId: badge.id, courseId },
    });
  } catch {
    // best-effort — badge award failures must not break the listing
  }
}
