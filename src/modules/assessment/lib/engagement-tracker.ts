/**
 * Lightweight engagement tracking — replaces the heavy per-message analysis
 * pipeline for AI Tutor sessions.
 *
 * PROBLEM: The old code ran runAnalysisPipeline on every AI Tutor message,
 * creating 10-20+ DB writes per message (PsychEvidence, ConfidenceRating,
 * SkillMastery, ChatSession, Interaction). With 1000 students × 10 messages/
 * day, that's 100,000-200,000 writes/day — DB flooding.
 *
 * SOLUTION: Track engagement with a SINGLE upsert to StudentHealthSummary.
 * The full analysis pipeline still runs on TEST completions (meaningful
 * assessment events), but AI Tutor messages just increment counters.
 *
 * This gives teachers a clear health overview from ONE row per student:
 *   - How active is the student this week vs last week?
 *   - What's their test score trend?
 *   - What language do they chat in?
 *   - Are they engaging consistently (streak)?
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { analyzeMessage, checkAlertThresholds } from "./psych-analyzer";

/** Detect the dominant language of a message (for tracking, not analysis). */
function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  // Check for common Roman Urdu/Hindi signals
  const urduSignals = ["hai", "hoon", "nahin", "nahi", "kya", "tum", "main", "hum", "ye", "woh", "karna", "karta", "hone", "accha", "theek", "zaroori", "samajh", "pata", "aap", "kyun", "kyunki", "agar", "toh", "bhi", "bahut", "thora"];
  const hasUrdu = urduSignals.some(w => new RegExp(`\\b${w}\\b`, "i").test(lower));
  if (hasUrdu) return "roman_urdu";
  return "english";
}

/** Check if we've crossed a week boundary since the last rollover.
 *  Uses Monday as the start of the week (matches getBootcampDayNumber). */
function needsWeekRollover(lastRollover: Date | null): boolean {
  if (!lastRollover) return true;
  const now = new Date();
  const lastMonday = new Date(lastRollover);
  lastMonday.setDate(lastRollover.getDate() - lastRollover.getDay() + 1); // Monday of last rollover week
  lastMonday.setHours(0, 0, 0, 0);

  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - now.getDay() + 1);
  thisMonday.setHours(0, 0, 0, 0);

  return thisMonday.getTime() > lastMonday.getTime();
}

/** Check if today is a new day for streak tracking. */
function isNewDay(lastActive: Date | null): boolean {
  if (!lastActive) return true;
  const last = new Date(lastActive);
  last.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() > last.getTime();
}

/** Check if the streak should be reset (missed a day). */
function shouldResetStreak(lastActive: Date | null): boolean {
  if (!lastActive) return false;
  const last = new Date(lastActive);
  last.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > 1; // missed more than 1 day = streak broken
}

/** Track a tutor engagement event — ONE upsert + psych analysis, no pipeline.
 *  Called on every AI Tutor message. Non-blocking + best-effort.
 *  Also runs lightweight psych analysis (heuristic, no AI call) + checks
 *  alert thresholds + creates StudentAlert rows if needed. */
export async function trackTutorEngagement(args: {
  userId: string;
  topic?: string;
  messageText: string;
}): Promise<void> {
  const { userId, topic, messageText } = args;
  const language = detectLanguage(messageText);
  const now = new Date();

  // Run lightweight psych analysis (pure heuristic, <1ms, no AI call)
  const psych = analyzeMessage(messageText);

  try {
    // Fetch current summary (if exists)
    const existing = await db.studentHealthSummary.findUnique({ where: { userId } });

    // Check if we need weekly rollover
    const rollover = needsWeekRollover(existing?.weekRolloverAt ?? null);

    // Check streak
    let newStreak = existing?.engagementStreak ?? 0;
    if (isNewDay(existing?.lastActiveDate ?? null)) {
      if (shouldResetStreak(existing?.lastActiveDate ?? null)) {
        newStreak = 1; // reset
      } else {
        newStreak += 1; // continue streak
      }
    }

    // Compute new psych scores (running average with exponential decay)
    const currentMood = existing?.moodScore ?? 50;
    const currentEngagement = existing?.engagementScore ?? 50;
    // Weighted: 70% old, 30% new (smooths out single-message spikes)
    const newMoodScore = Math.round(currentMood * 0.7 + psych.moodScore * 0.3);
    const newEngagementScore = Math.round(currentEngagement * 0.7 + psych.engagementScore * 0.3);

    // Increment psych counters (with rollover if needed)
    const newFrustrationCount = rollover ? (psych.frustrationSignal ? 1 : 0) : (existing?.frustrationCount ?? 0) + (psych.frustrationSignal ? 1 : 0);
    const newAvoidanceCount = rollover ? (psych.avoidanceSignal ? 1 : 0) : (existing?.avoidanceCount ?? 0) + (psych.avoidanceSignal ? 1 : 0);
    const newEnthusiasmCount = rollover ? (psych.enthusiasmSignal ? 1 : 0) : (existing?.enthusiasmCount ?? 0) + (psych.enthusiasmSignal ? 1 : 0);

    await db.studentHealthSummary.upsert({
      where: { userId },
      create: {
        userId,
        tutorMessagesThisWeek: 1,
        tutorMessagesTotal: 1,
        lastTutorActiveAt: now,
        lastTutorLanguage: language,
        lastTutorTopic: topic || null,
        lastActiveDate: now,
        engagementStreak: 1,
        weekRolloverAt: now,
        moodScore: psych.moodScore,
        engagementScore: psych.engagementScore,
        frustrationCount: psych.frustrationSignal ? 1 : 0,
        avoidanceCount: psych.avoidanceSignal ? 1 : 0,
        enthusiasmCount: psych.enthusiasmSignal ? 1 : 0,
      },
      update: {
        // Weekly rollover: move this week's counts to last week, reset this week
        ...(rollover
          ? {
              tutorMessagesLastWeek: existing?.tutorMessagesThisWeek ?? 0,
              tutorMessagesThisWeek: 1,
              testsLastWeek: existing?.testsThisWeek ?? 0,
              testsThisWeek: 0,
              avgScoreLastWeek: existing?.avgScoreThisWeek ?? null,
              avgScoreThisWeek: null,
              weekRolloverAt: now,
              frustrationCount: psych.frustrationSignal ? 1 : 0,
              avoidanceCount: psych.avoidanceSignal ? 1 : 0,
              enthusiasmCount: psych.enthusiasmSignal ? 1 : 0,
            }
          : {
              tutorMessagesThisWeek: { increment: 1 },
              frustrationCount: newFrustrationCount,
              avoidanceCount: newAvoidanceCount,
              enthusiasmCount: newEnthusiasmCount,
            }
        ),
        tutorMessagesTotal: { increment: 1 },
        lastTutorActiveAt: now,
        lastTutorLanguage: language,
        ...(topic ? { lastTutorTopic: topic } : {}),
        lastActiveDate: now,
        engagementStreak: newStreak,
        moodScore: newMoodScore,
        engagementScore: newEngagementScore,
      },
    });

    // Check alert thresholds + create alerts if needed
    const updatedSummary = await db.studentHealthSummary.findUnique({ where: { userId } });
    if (updatedSummary) {
      const alertRecommendations = checkAlertThresholds({
        moodScore: updatedSummary.moodScore,
        engagementScore: updatedSummary.engagementScore,
        frustrationCount: updatedSummary.frustrationCount,
        avoidanceCount: updatedSummary.avoidanceCount,
        enthusiasmCount: updatedSummary.enthusiasmCount,
        avgScoreThisWeek: updatedSummary.avgScoreThisWeek,
        avgScoreLastWeek: updatedSummary.avgScoreLastWeek,
        engagementStreak: updatedSummary.engagementStreak,
        tutorMessagesThisWeek: updatedSummary.tutorMessagesThisWeek,
        lastActiveDate: updatedSummary.lastActiveDate,
      });

      // Set alert flags on the summary
      const needsPsych = alertRecommendations.some(a => a.type === "psychological");
      const needsEducational = alertRecommendations.some(a => a.type === "educational");
      const needsMentorship = alertRecommendations.some(a => a.type === "mentorship");
      const alertReasons = alertRecommendations.map(a => a.reason);

      if (needsPsych || needsEducational || needsMentorship) {
        await db.studentHealthSummary.update({
          where: { userId },
          data: {
            needsPsychAlert: needsPsych,
            needsEducationalAlert: needsEducational,
            needsMentorshipAlert: needsMentorship,
            alertReasonsJson: JSON.stringify(alertReasons),
          },
        }).catch(() => {/* non-blocking */});
      }

      // Create StudentAlert rows for NEW alerts (check if an open alert of the same type already exists)
      for (const alert of alertRecommendations) {
        const existingAlert = await db.studentAlert.findFirst({
          where: { userId, type: alert.type, status: "open" },
        });
        if (!existingAlert) {
          await db.studentAlert.create({
            data: {
              userId,
              type: alert.type,
              severity: alert.severity,
              reason: alert.reason,
              metric: alert.metric,
              metricValue: alert.metricValue,
            },
          }).catch(() => {/* non-blocking — don't crash on duplicate */});
        }
      }
    }
  } catch (err) {
    // Non-blocking — best-effort tracking
    logger.warn("trackTutorEngagement failed", {
      userId, error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Track a test completion — updates test counts + score averages.
 *  Called on daily test / weekly test / practice completion. */
export async function trackTestCompletion(args: {
  userId: string;
  score: number;
  testType: string;
}): Promise<void> {
  const { userId, score } = args;
  const now = new Date();

  try {
    const existing = await db.studentHealthSummary.findUnique({ where: { userId } });
    const rollover = needsWeekRollover(existing?.weekRolloverAt ?? null);

    // Compute new weekly average
    const currentTestsThisWeek = rollover ? 0 : (existing?.testsThisWeek ?? 0);
    const currentAvgThisWeek = rollover ? null : existing?.avgScoreThisWeek;
    const newTestsThisWeek = currentTestsThisWeek + 1;
    const newAvgThisWeek = currentAvgThisWeek !== null && currentAvgThisWeek !== undefined
      ? ((currentAvgThisWeek * currentTestsThisWeek) + score) / newTestsThisWeek
      : score;

    // Compute overall average
    const totalTests = (existing?.testsThisWeek ?? 0) + (existing?.testsLastWeek ?? 0) + 1;
    const currentOverall = existing?.avgScoreOverall;
    const newOverall = currentOverall !== null && currentOverall !== undefined
      ? ((currentOverall * (totalTests - 1)) + score) / totalTests
      : score;

    let newStreak = existing?.engagementStreak ?? 0;
    if (isNewDay(existing?.lastActiveDate ?? null)) {
      if (shouldResetStreak(existing?.lastActiveDate ?? null)) {
        newStreak = 1;
      } else {
        newStreak += 1;
      }
    }

    await db.studentHealthSummary.upsert({
      where: { userId },
      create: {
        userId,
        testsThisWeek: 1,
        avgScoreThisWeek: score,
        avgScoreOverall: score,
        lastActiveDate: now,
        engagementStreak: 1,
        weekRolloverAt: now,
      },
      update: {
        ...(rollover
          ? {
              testsLastWeek: existing?.testsThisWeek ?? 0,
              testsThisWeek: 1,
              avgScoreLastWeek: existing?.avgScoreThisWeek ?? null,
              weekRolloverAt: now,
            }
          : {
              testsThisWeek: { increment: 1 },
            }
        ),
        avgScoreThisWeek: newAvgThisWeek,
        avgScoreOverall: newOverall,
        lastActiveDate: now,
        engagementStreak: newStreak,
        // Sync wellbeing tier from WellbeingState if it exists
        ...(existing?.wellbeingTier ? {} : {}),
      },
    });

    // Sync wellbeing tier from WellbeingState
    const wellbeing = await db.wellbeingState.findUnique({ where: { userId } });
    if (wellbeing) {
      await db.studentHealthSummary.update({
        where: { userId },
        data: { wellbeingTier: wellbeing.tier },
      }).catch(() => {/* non-blocking */});
    }
  } catch (err) {
    logger.warn("trackTestCompletion failed", {
      userId, error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Get the health summary for a student (or all students for teacher view). */
export async function getHealthSummary(userId: string) {
  return db.studentHealthSummary.findUnique({ where: { userId } });
}

export async function getBatchHealthSummaries(userIds: string[]) {
  return db.studentHealthSummary.findMany({
    where: { userId: { in: userIds } },
    orderBy: { lastActiveDate: "desc" },
  });
}
