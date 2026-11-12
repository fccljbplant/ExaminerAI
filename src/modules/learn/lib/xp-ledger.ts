// src/modules/learn/lib/xp-ledger.ts — XP ledger + learner-level progression.
/**
 * XP ledger + learner-level progression.
 * Every XP award is recorded as a row in `XPLedger` (immutable audit
 * trail). The user's `totalXP` and `learnerLevel` are denormalized
 * onto `LearnProfile` for fast reads.
 *
 * Level-up bonus: when an XP award causes the learner to cross into a
 * new level, an additional XP_AMOUNTS.level_raise (75) bonus is added.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { LEARNER_LEVELS, XP_AMOUNTS, type XPReason } from "../types";

export interface AwardXPInput {
 userId: string;
 courseId?: string;
 amount: number;
 reason: string; // human-readable reason or XPReason key
 referenceId?: string; // optional: slideId, topicKey, testId, etc.
}

type XpAwardClient = Pick<Prisma.TransactionClient, "xPLedger" | "learnProfile">;

/** Sum ledger entries through the supplied client (also works inside a transaction). */
async function getTotalXPWithClient(client: XpAwardClient, userId: string): Promise<number> {
 const rows = await client.xPLedger.aggregate({
  where: { userId },
  _sum: { amount: true },
 });
 return rows._sum.amount ?? 0;
}

/**
 * Append an entry to XPLedger and update LearnProfile.totalXP + learnerLevel
 * using the supplied Prisma client. Passing a transaction client makes the
 * ledger entry, denormalized profile total and any level-up bonus atomic.
 */
export async function awardXPWithClient(
 client: XpAwardClient,
 input: AwardXPInput,
): Promise<number> {
 await client.xPLedger.create({
  data: {
   userId: input.userId,
   courseId: input.courseId ?? null,
   amount: input.amount,
   reason: input.reason,
   referenceId: input.referenceId ?? null,
  },
 });

 if (input.courseId) {
  const profile = await client.learnProfile.findUnique({
   where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
  });
  if (profile) {
   const prevTotal = profile.totalXP;
   const newTotal = prevTotal + input.amount;
   const prevLevel = getLearnerLevel(prevTotal).name;
   const newLevelName = getLearnerLevel(newTotal).name;

   if (newLevelName !== prevLevel) {
    await client.learnProfile.update({
     where: { id: profile.id },
     data: {
      totalXP: newTotal + XP_AMOUNTS.level_raise,
      learnerLevel: newLevelName,
     },
    });
    await client.xPLedger.create({
     data: {
      userId: input.userId,
      courseId: input.courseId,
      amount: XP_AMOUNTS.level_raise,
      reason: "level_raise",
      referenceId: "level:" + newLevelName,
     },
    });
   } else {
    await client.learnProfile.update({
     where: { id: profile.id },
     data: { totalXP: newTotal },
    });
   }
  }
 }

 return getTotalXPWithClient(client, input.userId);
}

/** Award XP outside a transaction (legacy convenience wrapper). */
export async function awardXP(input: AwardXPInput): Promise<number> {
 return awardXPWithClient(db, input);
}

/** Sum all XPLedger entries for a user (across all courses). */
export async function getTotalXP(userId: string): Promise<number> {
 return getTotalXPWithClient(db, userId);
}

/** Return the LearnerLevel for a given XP total. Pure function. */
export function getLearnerLevel(totalXP: number): { name: string; minXp: number } {
 let current = LEARNER_LEVELS[0];
 for (const lvl of LEARNER_LEVELS) {
 if (totalXP >= lvl.minXp) current = lvl;
 else break;
 }
 return current;
}

/** Return recent XP entries (default: last 50). */
export async function getXPHistory(
 userId: string,
 courseId?: string,
 limit = 50,
): Promise<{
 id: string;
 amount: number;
 reason: string;
 referenceId: string | null;
 courseId: string | null;
 createdAt: Date;
}[]> {
 const rows = await db.xPLedger.findMany({
 where: { userId, ...(courseId ? { courseId } : {}) },
 orderBy: { createdAt: "desc" },
 take: limit,
 });
 return rows;
}

/** Award XP for a known reason (typed). Convenience wrapper. */
export async function awardTypedXPWithClient(
 client: XpAwardClient,
 userId: string,
 reason: XPReason,
 courseId?: string,
 referenceId?: string,
): Promise<number> {
 return awardXPWithClient(client, {
  userId,
  courseId,
  amount: XP_AMOUNTS[reason],
  reason,
  referenceId,
 });
}

/** Award XP for a known reason (typed). Convenience wrapper. */
export async function awardTypedXP(
 userId: string,
 reason: XPReason,
 courseId?: string,
 referenceId?: string,
): Promise<number> {
 return awardTypedXPWithClient(db, userId, reason, courseId, referenceId);
}
