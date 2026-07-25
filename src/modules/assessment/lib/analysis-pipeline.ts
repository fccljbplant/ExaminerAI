/**
 * Analysis Pipeline — post-test psychological evidence gathering.
 *
 * CHANGES: Now writes evidence for ALL 7 dimensions on EVERY test,
 * not just when strict conditions are met. The "no evidence" problem
 * was caused by overly strict conditions (e.g. only writing
 * explanatory_depth if avg length < 50 or > 300 — nothing in between).
 *
 * All 3 test types (practice, daily, weekly) now pass the same data
 * shape: conversation + score + topics. The pipeline derives all
 * dimensions from conversation data, so it works uniformly.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface PipelineInput {
  userId: string;
  testId: string;
  testType: "weekly_test" | "daily_test";
  week: number;
  score: number;
  topics: string[];
  conversation?: Array<{
    role: string;
    content: string;
    questionIndex?: number;
  }>;
  answers?: Array<{
    question: string;
    answer: string;
    score: number;
    confidenceRating?: "low" | "medium" | "high" | null;
    topic?: string;
  }>;
  pillar?: string;
  psychAnalysis?: string;
  engagementFeedback?: {
    avoidanceCount?: number;
    subjectChanges?: number;
    distractedQuestions?: number[];
  } | null;
  plagiarismScore?: number;
}

/** Run the full analysis pipeline. Best-effort — never throws. */
export async function runAnalysisPipeline(input: PipelineInput): Promise<void> {
  try {
    await Promise.allSettled([
      writeConfidenceRatings(input),
      writePsychEvidence(input),
      writeSkillMastery(input),
      recomputeWellbeingState(input.userId),
    ]);
    await autoCreateTouchpointOnTierTransition(input);
    logger.info("Analysis pipeline complete", {
      userId: input.userId, testType: input.testType, testId: input.testId, score: input.score,
    });
  } catch (err) {
    logger.warn("Analysis pipeline error", { error: err instanceof Error ? err.message : String(err) });
  }
}

// ============================================================
// 1. ConfidenceRating — calibration data
// ============================================================

async function writeConfidenceRatings(input: PipelineInput): Promise<void> {
  if (!input.answers) return;
  for (const ans of input.answers) {
    if (ans.confidenceRating) {
      try {
        await db.confidenceRating.create({
          data: {
            userId: input.userId,
            source: input.testType,
            rating: ans.confidenceRating === "low" ? 1 : ans.confidenceRating === "medium" ? 3 : 5,
            actualScore: ans.score,
            context: ans.topic || input.topics[0] || `Week ${input.week}`,
            week: input.week,
          },
        });
      } catch { /* best-effort */ }
    }
  }
}

// ============================================================
// 2. PsychEvidence — 7 dimensions, ALWAYS written
// ============================================================

async function writePsychEvidence(input: PipelineInput): Promise<void> {
  const evidenceRows: Array<{
    dimension: string;
    value: string;
    evidenceText: string;
    sourceType: string;
    sourceId: string;
    week: number;
  }> = [];

  // Extract student messages from conversation
  const studentMsgs = input.conversation?.filter(m => m.role === "student") || [];
  const examinerMsgs = input.conversation?.filter(m => m.role === "examiner") || [];
  const avgLen = studentMsgs.length > 0
    ? studentMsgs.reduce((a, m) => a + m.content.length, 0) / studentMsgs.length
    : 0;
  const allStudentText = studentMsgs.map(m => m.content.toLowerCase()).join(" ");

  // === 1. Calibration === (always write — infer from score vs conversation)
  {
    // If we have explicit confidence ratings, use them
    if (input.answers) {
      const withConfidence = input.answers.filter(a => a.confidenceRating);
      if (withConfidence.length > 0) {
        const avgConfidence = withConfidence.reduce((a, x) => a + (x.confidenceRating === "low" ? 1 : x.confidenceRating === "medium" ? 3 : 5), 0) / withConfidence.length;
        const avgActual = withConfidence.reduce((a, x) => a + x.score, 0) / withConfidence.length;
        const confidencePct = avgConfidence * 20;
        const gap = confidencePct - avgActual;
        let value = "well-calibrated";
        let evidenceText = `Confidence ${Math.round(confidencePct)}% vs actual ${Math.round(avgActual)}% — gap of ${Math.round(gap)} points.`;
        if (gap > 20) {
          value = "overconfident";
          evidenceText = `Overconfident: rated ${Math.round(confidencePct)}% but scored ${Math.round(avgActual)}% — Dunning-Kruger signal.`;
        } else if (gap < -20) {
          value = "underconfident";
          evidenceText = `Underconfident: rated ${Math.round(confidencePct)}% but scored ${Math.round(avgActual)}% — knows more than they think.`;
        }
        evidenceRows.push({ dimension: "calibration", value, evidenceText, sourceType: input.testType, sourceId: input.testId, week: input.week });
      } else {
        // No confidence ratings — infer from answer length + score
        evidenceRows.push({ dimension: "calibration", value: "no_self_rating", evidenceText: `No confidence self-rating collected for this ${input.testType}. Score: ${input.score}%.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
      }
    } else {
      // No answers array — infer from conversation
      evidenceRows.push({ dimension: "calibration", value: "no_self_rating", evidenceText: `No confidence self-rating collected for this ${input.testType}. Score: ${input.score}%. Consider adding confidence ratings to daily tests.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    }
  }

  // === 2. Explanatory depth === (always write — from answer length)
  {
    let value = "moderate_answers";
    let evidenceText = `Average answer length ${Math.round(avgLen)} chars across ${studentMsgs.length} answers.`;
    if (avgLen < 50) {
      value = "surface_answers";
      evidenceText = `Short answers (avg ${Math.round(avgLen)} chars) — surface-level responses. Probing likely revealed gaps in understanding.`;
    } else if (avgLen > 300) {
      value = "detailed_reasoning";
      evidenceText = `Detailed answers (avg ${Math.round(avgLen)} chars) — step-by-step explanations with reasoning.`;
    } else if (avgLen >= 50 && avgLen <= 300) {
      value = "moderate_depth";
      evidenceText = `Moderate answer length (avg ${Math.round(avgLen)} chars) — adequate explanations with some detail. Room for deeper reasoning.`;
    }
    evidenceRows.push({ dimension: "explanatory_depth", value, evidenceText, sourceType: input.testType, sourceId: input.testId, week: input.week });
  }

  // === 3. Gaming pattern === (always write — from plagiarism or absence)
  {
    if (input.plagiarismScore !== undefined && input.plagiarismScore > 50) {
      evidenceRows.push({ dimension: "gaming_pattern", value: "voice_inconsistency", evidenceText: `Plagiarism score ${input.plagiarismScore}% — significant voice inconsistency. Possible AI use on specific questions.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    } else if (input.plagiarismScore !== undefined) {
      evidenceRows.push({ dimension: "gaming_pattern", value: "authentic_voice", evidenceText: `Plagiarism score ${input.plagiarismScore}% — consistent voice across answers. No signs of AI assistance.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    } else {
      evidenceRows.push({ dimension: "gaming_pattern", value: "not_analyzed", evidenceText: `No plagiarism analysis for this ${input.testType}. Voice consistency not checked.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    }
  }

  // === 4. Attribution / mindset === (always write — from language analysis)
  {
    const growthSignals = ["learn", "practice", "try", "improve", "figure out", "understand", "next time", "work on", "get better"];
    const fixedSignals = ["can't", "cant", "im bad", "not good at", "never", "always fail", "stupid", "dont know how", "i don't know", "skip"];
    const growthCount = growthSignals.filter(s => allStudentText.includes(s)).length;
    const fixedCount = fixedSignals.filter(s => allStudentText.includes(s)).length;
    const avoidanceCount = input.engagementFeedback?.avoidanceCount || 0;

    if (growthCount > 0 && growthCount > fixedCount) {
      evidenceRows.push({ dimension: "attribution", value: "growth_mindset", evidenceText: `Growth-mindset language detected (${growthCount} signals): uses "learn", "practice", "improve". Attributes success to effort.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    } else if (fixedCount > 0 && fixedCount >= growthCount) {
      evidenceRows.push({ dimension: "attribution", value: "fixed_mindset", evidenceText: `Fixed-mindset language detected (${fixedCount} signals): uses "can't", "not good at". May attribute difficulty to innate ability.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    } else if (avoidanceCount > 1) {
      evidenceRows.push({ dimension: "attribution", value: "avoidant", evidenceText: `${avoidanceCount} avoidance answers ("I don't know" / "skip") — may indicate anxiety or fixed-mindset response.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    } else {
      evidenceRows.push({ dimension: "attribution", value: "neutral", evidenceText: `No strong growth or fixed mindset signals in this ${input.testType}. Student engaged neutrally with questions.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    }
  }

  // === 5. Cognitive load === (always write — from score)
  {
    if (input.score < 40) {
      evidenceRows.push({ dimension: "cognitive_load", value: "high_intrinsic", evidenceText: `Score ${input.score}% — high intrinsic cognitive load. The material may be too difficult at this point. Consider breaking into smaller pieces.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    } else if (input.score >= 90) {
      evidenceRows.push({ dimension: "cognitive_load", value: "low_germane", evidenceText: `Score ${input.score}% — material mastered, low cognitive load. Ready for advanced or applied work.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    } else {
      evidenceRows.push({ dimension: "cognitive_load", value: "moderate_load", evidenceText: `Score ${input.score}% — moderate cognitive load. Student is engaging with the material but hasn't fully mastered it yet.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
    }
  }

  // === 6. SRL phase === (always write — from conversation patterns)
  {
    let srlValue = "performance";
    let srlText = `Engaged with ${studentMsgs.length} answers (avg ${Math.round(avgLen)} chars).`;

    if (studentMsgs.length >= 2) {
      const firstAnswerLen = studentMsgs[0].content.length;
      const lastAnswerLen = studentMsgs[studentMsgs.length - 1].content.length;

      if (avgLen > 200) {
        srlValue = "reflection";
        srlText = `Detailed answers (avg ${Math.round(avgLen)} chars) — student is in the reflection phase, processing and connecting concepts.`;
      } else if (firstAnswerLen > 100 && lastAnswerLen < 50) {
        srlValue = "performance";
        srlText = `Started detailed (${firstAnswerLen} chars) but shortened over time (${lastAnswerLen} chars) — may indicate fatigue or waning engagement.`;
      } else if (avgLen < 50) {
        srlValue = "forethought";
        srlText = `Short answers (avg ${Math.round(avgLen)} chars) — student may be in the forethought phase, still building familiarity. Encourage elaboration.`;
      } else {
        srlValue = "performance";
        srlText = `Moderate engagement (avg ${Math.round(avgLen)} chars, ${studentMsgs.length} answers) — student is in the performance phase, actively working through the material.`;
      }
    } else {
      srlText = `Limited conversation data (${studentMsgs.length} answers) — insufficient for SRL phase inference.`;
    }

    evidenceRows.push({ dimension: "srl_phase", value: srlValue, evidenceText: srlText, sourceType: input.testType, sourceId: input.testId, week: input.week });
  }

  // === 7. Fluency / retention === (always write — from score trend or single score)
  {
    if (input.answers && input.answers.length >= 2) {
      const scores = input.answers.map(a => a.score);
      const first = scores[0];
      const last = scores[scores.length - 1];
      const trend = last - first;

      if (trend > 15) {
        evidenceRows.push({ dimension: "fluency", value: "improving_recall", evidenceText: `Score improved from ${first}% to ${last}% across questions — recall is strengthening during the test. Good retrieval practice.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
      } else if (trend < -15) {
        evidenceRows.push({ dimension: "fluency", value: "declining_recall", evidenceText: `Score dropped from ${first}% to ${last}% — possible fatigue or fading recall. Consider shorter sessions.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
      } else {
        evidenceRows.push({ dimension: "fluency", value: "stable_recall", evidenceText: `Consistent scores (${first}% → ${last}%) — stable recall. Knowledge is well-consolidated.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
      }
    } else {
      // Single score — infer from overall performance
      if (input.score >= 75) {
        evidenceRows.push({ dimension: "fluency", value: "fluent", evidenceText: `Score ${input.score}% — fluent recall of ${input.topics.join(", ") || "test topics"}. Knowledge is accessible and well-practiced.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
      } else if (input.score < 50) {
        evidenceRows.push({ dimension: "fluency", value: "fragmented_recall", evidenceText: `Score ${input.score}% — fragmented recall of ${input.topics.join(", ") || "test topics"}. Knowledge gaps are affecting fluency. Review needed.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
      } else {
        evidenceRows.push({ dimension: "fluency", value: "developing_fluency", evidenceText: `Score ${input.score}% — developing fluency with ${input.topics.join(", ") || "test topics"}. Some recall but not yet automatic.`, sourceType: input.testType, sourceId: input.testId, week: input.week });
      }
    }
  }

  // Write all evidence rows
  for (const row of evidenceRows) {
    try {
      await db.psychEvidence.create({
        data: {
          userId: input.userId,
          dimension: row.dimension,
          value: row.value,
          evidenceText: row.evidenceText,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          week: row.week,
        },
      });
    } catch (err) {
      logger.warn("Failed to write psych evidence", { dimension: row.dimension, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logger.info("Psych evidence written", { userId: input.userId, testId: input.testId, dimensions: evidenceRows.length });
}

// ============================================================
// 3. SkillMastery — per-topic mastery from test scores
// ============================================================

async function writeSkillMastery(input: PipelineInput): Promise<void> {
  const scores: number[] = [];

  // Extract per-answer scores if available
  if (input.answers && input.answers.length > 0) {
    scores.push(...input.answers.map(a => a.score));
  } else {
    // Single score for the whole test
    scores.push(input.score);
  }

  // Group by topic
  const byTopic = new Map<string, number[]>();
  if (input.answers) {
    for (const ans of input.answers) {
      const topic = ans.topic || input.topics[0] || "Uncategorized";
      if (!byTopic.has(topic)) byTopic.set(topic, []);
      byTopic.get(topic)!.push(ans.score);
    }
  } else {
    // Single score — assign to all topics
    for (const topic of input.topics) {
      byTopic.set(topic, [input.score]);
    }
  }

  // If no topics, use a single "Uncategorized"
  if (byTopic.size === 0) {
    byTopic.set("Uncategorized", [input.score]);
  }

  await Promise.all(Array.from(byTopic.entries()).map(async ([topic, topicScores]) => {
    await upsertSkillMastery(input.userId, topic, "Uncategorized", topicScores, input.week);
  }));
}

async function upsertSkillMastery(userId: string, topic: string, pillar: string, newScores: number[], week: number): Promise<void> {
  try {
    const existing = await db.skillMastery.findUnique({
      where: { userId_topic: { userId, topic } },
      select: { masteryLevel: true, evidenceCount: true, trend: true },
    });

    const newAvg = newScores.reduce((a, s) => a + s, 0) / newScores.length;
    const existingScoreMap: Record<string, number> = { "not-started": 25, "developing": 60, "proficient": 82, "mastered": 95 };
    const existingApprox = existingScoreMap[existing?.masteryLevel ?? "not-started"] ?? 50;
    const trend = !existing ? "stable"
      : newAvg - existingApprox > 10 ? "improving"
      : newAvg - existingApprox < -10 ? "declining"
      : "stable";

    const masteryLevel = newAvg >= 90 ? "mastered" : newAvg >= 75 ? "proficient" : newAvg >= 50 ? "developing" : "not-started";

    await db.skillMastery.upsert({
      where: { userId_topic: { userId, topic } },
      create: { userId, topic, pillar, masteryLevel, evidenceCount: newScores.length, lastAssessedWeek: week, trend },
      update: { pillar, masteryLevel, evidenceCount: { increment: newScores.length }, lastAssessedWeek: week, trend },
    });
  } catch (err) {
    logger.warn("SkillMastery upsert failed", { userId, topic, error: err instanceof Error ? err.message : String(err) });
  }
}

// ============================================================
// 4. WellbeingState — deterministic tier computation
// ============================================================

async function recomputeWellbeingState(userId: string): Promise<void> {
  try {
    // Get recent evidence (last 14 days)
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const evidence = await db.psychEvidence.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (evidence.length === 0) return;

    // Count concerning signals
    const concerning = evidence.filter(e =>
      e.value === "overconfident" ||
      e.value === "surface_answers" ||
      e.value === "voice_inconsistency" ||
      e.value === "fixed_mindset" ||
      e.value === "avoidant" ||
      e.value === "high_intrinsic" ||
      e.value === "declining_recall" ||
      e.value === "fragmented_recall"
    );

    const positive = evidence.filter(e =>
      e.value === "well-calibrated" ||
      e.value === "detailed_reasoning" ||
      e.value === "growth_mindset" ||
      e.value === "low_germane" ||
      e.value === "improving_recall" ||
      e.value === "fluent"
    );

    const ratio = concerning.length / Math.max(evidence.length, 1);
    let tier = "green";
    const reasons: string[] = [];

    if (ratio > 0.6) {
      tier = "red";
      reasons.push(`${concerning.length} concerning signals in last 14 days (out of ${evidence.length})`);
    } else if (ratio > 0.35) {
      tier = "amber";
      reasons.push(`${concerning.length} concerning signals in last 14 days`);
    } else {
      reasons.push(`${positive.length} positive signals, ${concerning.length} concerning`);
    }

    // Check for crisis flags
    const openFlags = await db.crisisFlag.count({ where: { userId, status: "open" } });
    if (openFlags > 0) {
      tier = "red";
      reasons.push(`${openFlags} open crisis flag(s)`);
    }

    await db.wellbeingState.upsert({
      where: { userId },
      create: { userId, tier, reasonsJson: JSON.stringify(reasons) },
      update: { tier, reasonsJson: JSON.stringify(reasons) },
    });
  } catch (err) {
    logger.warn("WellbeingState recompute failed", { userId, error: err instanceof Error ? err.message : String(err) });
  }
}

// ============================================================
// 5. Auto-create touchpoint on tier transition
// ============================================================

async function autoCreateTouchpointOnTierTransition(input: PipelineInput): Promise<void> {
  try {
    const wellbeing = await db.wellbeingState.findUnique({ where: { userId: input.userId } });
    if (!wellbeing) return;

    // Check if there was a transition in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTouchpoint = await db.mentorshipTouchpoint.findFirst({
      where: {
        userId: input.userId,
        type: "alert_response",
        createdAt: { gte: oneHourAgo },
      },
    });
    if (recentTouchpoint) return; // Already created

    if (wellbeing.tier === "red") {
      // Find teachers for this student's batch
      const student = await db.user.findUnique({ where: { id: input.userId }, select: { batchId: true } });
      if (student?.batchId) {
        const teachers = await db.user.findMany({
          where: { role: { in: ["teacher"] }, batchId: student.batchId, blocked: false },
          select: { id: true },
        });
        for (const teacher of teachers) {
          await db.mentorshipTouchpoint.create({
            data: {
              userId: input.userId,
              actorUserId: teacher.id,
              type: "alert_response",
              note: `Auto-created: student wellbeing dropped to RED after ${input.testType} (score ${input.score}%). Review recommended.`,
              outcome: "ongoing",
            },
          });
        }
      }
    }
  } catch { /* best-effort */ }
}
