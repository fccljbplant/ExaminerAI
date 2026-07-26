/**
 * AI Assistant — Escalation Engine (Section 3)
 *
 * One rule, two triggers, applies to every flag source (student wellbeing,
 * teacher load, crisis, safeguarding — all of it, one engine):
 *
 * RULE: Three tiers only: green / amber / red. No separate "crisis" tier —
 * a crisis-severity situation is red, distinguished by its LABEL TEXT
 * ("Student in crisis — needs immediate attention"), not a different color.
 *
 * TRIGGER 1 (duration): IF flag.tier == "warning" AND flag.daysSinceRaised >= 7
 *   → escalate to "red"
 *
 * TRIGGER 2 (repeat): IF flag.tier == "warning" AND this is a repeat occurrence
 *   of the same issue type for the same person within a short window:
 *   → escalate on shortened timer (2 days), or immediately on 3rd+ recurrence
 *
 * Runs as a scheduled job + on-write check for the repeat-occurrence trigger.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Escalation thresholds */
const AMBER_DURATION_DAYS = 7;       // amber → red after 7 days unresolved
const REPEAT_SHORTENED_DAYS = 2;     // repeat amber → red after 2 days
const REPEAT_IMMEDIATE_THRESHOLD = 3; // 3rd+ recurrence → red immediately

export type FlagTier = "green" | "warning" | "red";

export interface EscalatableFlag {
  id: string;
  tier: string;
  type: string;       // e.g. "psychological", "educational", "mentorship", "safeguarding"
  userId: string;     // the person the flag is about (student or teacher)
  status: string;     // "open", "acknowledged", "resolved", "dismissed"
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface EscalationResult {
  flagId: string;
  escalated: boolean;
  fromTier: string;
  toTier: string;
  reason: string;
  trigger: "duration" | "repeat" | "none";
}

/**
 * Check if a single flag should be escalated.
 * Pure function — does not write to DB. Call escalateFlag() to persist.
 */
export function shouldEscalate(
  flag: EscalatableFlag,
  repeatCount: number
): EscalationResult {
  // Only escalate amber flags that are still open/acknowledged
  if (flag.tier !== "warning") {
    return { flagId: flag.id, escalated: false, fromTier: flag.tier, toTier: flag.tier, reason: "Not amber", trigger: "none" };
  }
  if (flag.status === "resolved" || flag.status === "dismissed") {
    return { flagId: flag.id, escalated: false, fromTier: flag.tier, toTier: flag.tier, reason: "Already resolved/dismissed", trigger: "none" };
  }

  const daysSinceRaised = Math.floor((Date.now() - flag.createdAt.getTime()) / (24 * 60 * 60 * 1000));

  // TRIGGER 2 (repeat): 3rd+ recurrence → immediate escalation
  if (repeatCount >= REPEAT_IMMEDIATE_THRESHOLD) {
    return {
      flagId: flag.id,
      escalated: true,
      fromTier: "warning",
      toTier: "red",
      reason: `Immediate escalation: ${repeatCount}rd+ repeat occurrence of ${flag.type}`,
      trigger: "repeat",
    };
  }

  // TRIGGER 2 (repeat, shortened): repeat occurrence → 2-day timer
  if (repeatCount >= 2 && daysSinceRaised >= REPEAT_SHORTENED_DAYS) {
    return {
      flagId: flag.id,
      escalated: true,
      fromTier: "warning",
      toTier: "red",
      reason: `Shortened escalation: repeat occurrence (${repeatCount}x) of ${flag.type} after ${daysSinceRaised} days`,
      trigger: "repeat",
    };
  }

  // TRIGGER 1 (duration): amber for 7+ days → red
  if (daysSinceRaised >= AMBER_DURATION_DAYS) {
    return {
      flagId: flag.id,
      escalated: true,
      fromTier: "warning",
      toTier: "red",
      reason: `Duration escalation: ${flag.type} unresolved for ${daysSinceRaised} days`,
      trigger: "duration",
    };
  }

  return {
    flagId: flag.id,
    escalated: false,
    fromTier: "warning",
    toTier: "warning",
    reason: `Amber for ${daysSinceRaised} days, ${repeatCount} occurrences — not yet triggered`,
    trigger: "none",
  };
}

/**
 * Count repeat occurrences of the same flag type for the same person.
 * Looks back 30 days for the same (userId, type) combination.
 */
export async function countRepeatOccurrences(
  userId: string,
  flagType: string,
  excludeFlagId?: string
): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const count = await db.studentAlert.count({
    where: {
      userId,
      type: flagType,
      createdAt: { gt: thirtyDaysAgo },
      ...(excludeFlagId ? { id: { not: excludeFlagId } } : {}),
    },
  }).catch(() => 0); // Table might not exist in all environments

  return count;
}

/**
 * Escalate a single flag in the DB (StudentAlert).
 * Also updates WellbeingState to "red" if the flag is about a student.
 */
export async function escalateFlag(
  flagId: string,
  reason: string
): Promise<void> {
  try {
    // Update the StudentAlert
    await db.studentAlert.update({
      where: { id: flagId },
      data: {
        severity: "red",
      },
    });

    // Also update WellbeingState to red
    const flag = await db.studentAlert.findUnique({
      where: { id: flagId },
      select: { userId: true },
    });

    if (flag) {
      await db.wellbeingState.updateMany({
        where: { userId: flag.userId },
        data: {
          tier: "red",
          reasonsJson: JSON.stringify([reason]),
        },
      }).catch(() => {});
    }

    logger.info("Flag escalated to red", { flagId, reason });
  } catch (err) {
    logger.error("Failed to escalate flag", { flagId, error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Run the escalation engine on all open amber flags.
 * This is the scheduled job — call from a cron route or admin endpoint.
 *
 * Returns a summary of what was escalated.
 */
export async function runEscalationEngine(): Promise<{
  checked: number;
  escalated: number;
  results: EscalationResult[];
}> {
  // Get all open/acknowledged amber flags
  const amberFlags = await db.studentAlert.findMany({
    where: {
      severity: "warning",
      status: { in: ["open", "acknowledged"] },
    },
    select: {
      id: true,
      type: true,
      userId: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
    },
  }).catch(() => []);

  const results: EscalationResult[] = [];
  let escalated = 0;

  for (const flag of amberFlags) {
    // Count repeat occurrences
    const repeatCount = await countRepeatOccurrences(flag.userId, flag.type, flag.id);

    // Check if should escalate
    const result = shouldEscalate(
      { ...flag, tier: "warning" } as EscalatableFlag,
      repeatCount
    );

    results.push(result);

    if (result.escalated) {
      await escalateFlag(flag.id, result.reason);
      escalated++;
    }
  }

  logger.info("Escalation engine run complete", {
    checked: amberFlags.length,
    escalated,
  });

  return {
    checked: amberFlags.length,
    escalated,
    results,
  };
}

/**
 * On-write check: call this immediately when a new flag is created.
 * If it's a repeat occurrence, check if it should escalate immediately.
 */
export async function checkOnWriteEscalation(
  userId: string,
  flagType: string,
  flagId: string
): Promise<EscalationResult | null> {
  const repeatCount = await countRepeatOccurrences(userId, flagType, flagId);

  if (repeatCount >= REPEAT_IMMEDIATE_THRESHOLD) {
    const result: EscalationResult = {
      flagId,
      escalated: true,
      fromTier: "warning",
      toTier: "red",
      reason: `Immediate escalation on write: ${repeatCount}rd+ repeat occurrence of ${flagType}`,
      trigger: "repeat",
    };
    await escalateFlag(flagId, result.reason);
    return result;
  }

  return null;
}
