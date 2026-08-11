// src/modules/learn/lib/learner-profile.ts — LearnProfile CRUD + streak management.
/**
 * LearnProfile is the per-user-per-course state: teaching level,
 * language, XP, learner level, streak, and the masteryMap JSON.
 * One row per (userId, courseId) — enforced by @@unique.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { TeachingLevel } from "../types";
import { awardXP } from "./xp-ledger";

/** Get the LearnProfile for a user+course, creating it if missing. */
export async function getOrCreateProfile(userId: string, courseId: string) {
 const existing = await db.learnProfile.findUnique({
 where: { userId_courseId: { userId, courseId } },
 });
 if (existing) return existing;

 return db.learnProfile.create({
 data: {
 userId,
 courseId,
 preferredLanguage: "en",
 teachingLevel: 4,
 masteryMap: {
 topicProgress: {
 current: { week: 1, day: 1 },
 history: [],
 slidesViewed: 0,
 resourcesShown: false,
 },
 } as unknown as Prisma.InputJsonValue,
 },
 });
}

/** Return a YYYY-MM-DD date key in the user's local timezone. */
function dateKey(d: Date = new Date()): string {
 // Use ISO date slice — but in local time, not UTC. Build manually.
 const y = d.getFullYear();
 const m = String(d.getMonth() + 1).padStart(2, "0");
 const day = String(d.getDate()).padStart(2, "0");
 return `${y}-${m}-${day}`;
}

/**
 * Update the streak for a user+course.
 * - Same-day activity: no change.
 * - Next-day activity: streak++ (and update longest if beaten).
 * - Gap of 2+ days: streak resets to 1.
 *
 * Awards XP_AMOUNTS.streak_day (20) on a new day.
 */
export async function updateStreak(
 userId: string,
 courseId: string,
): Promise<{ streakCurrent: number; streakLongest: number; awarded: boolean }> {
 const profile = await getOrCreateProfile(userId, courseId);
 const todayKey = dateKey();
 const lastKey = profile.lastActivityDate ? dateKey(profile.lastActivityDate) : null;

 if (lastKey === todayKey) {
 // Already counted today — no change.
 return {
 streakCurrent: profile.streakCurrent,
 streakLongest: profile.streakLongest,
 awarded: false,
 };
 }

 let newStreak = 1;
 if (lastKey) {
 const last = new Date(lastKey + "T00:00:00");
 const today = new Date(todayKey + "T00:00:00");
 const diffDays = Math.round((today.getTime() - last.getTime()) / 86_400_000);
 if (diffDays === 1) newStreak = profile.streakCurrent + 1;
 else if (diffDays <= 0) newStreak = profile.streakCurrent; // safety
 else newStreak = 1; // gap of 2+ days → reset
 }

 const newLongest = Math.max(profile.streakLongest, newStreak);

 await db.learnProfile.update({
 where: { id: profile.id },
 data: {
 streakCurrent: newStreak,
 streakLongest: newLongest,
 lastActivityDate: new Date(),
 },
 });

 // Award streak-day XP.
 await awardXP({
 userId,
 courseId,
 amount: 20,
 reason: "streak_day",
 referenceId: `streak:${todayKey}`,
 });

 return { streakCurrent: newStreak, streakLongest: newLongest, awarded: true };
}

/** Set the preferred teaching language for a course. */
export async function setLanguage(
 userId: string,
 courseId: string,
 language: string,
): Promise<void> {
 await getOrCreateProfile(userId, courseId);
 await db.learnProfile.update({
 where: { userId_courseId: { userId, courseId } },
 data: { preferredLanguage: language },
 });
}

/** Set the teaching level (1-4) for a course. */
export async function setTeachingLevel(
 userId: string,
 courseId: string,
 level: TeachingLevel,
): Promise<void> {
 await getOrCreateProfile(userId, courseId);
 await db.learnProfile.update({
 where: { userId_courseId: { userId, courseId } },
 data: { teachingLevel: level },
 });
}

/** Toggle leaderboard opt-in. */
export async function setLeaderboardOptIn(
 userId: string,
 courseId: string,
 optIn: boolean,
): Promise<void> {
 await getOrCreateProfile(userId, courseId);
 await db.learnProfile.update({
 where: { userId_courseId: { userId, courseId } },
 data: { leaderboardOptIn: optIn },
 });
}
