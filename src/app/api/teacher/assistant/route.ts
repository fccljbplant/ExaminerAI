import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import { buildTeacherBatchSummary } from "@/lib/teacher-batch-summary";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/teacher/assistant — free-text question about the batch,
 *  answered from existing data (PsychEvidence, ConfidenceRating,
 *  SkillMastery, MentorshipTouchpoint, CrisisFlag).
 *
 *  Uses the configured AI model (callAI) — the AI Assistant.
 *
 *  The response must:
 *  - Cite which students and which specific signal led to the answer
 *  - If the data doesn't support a confident answer, say so
 *  - Never speculate about a student's internal state beyond evidence
 */

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("using AI Assistant"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }

  const auth = await requireRole([
    UserRole.TEACHER, UserRole.TEACHING_ASSISTANT,
    UserRole.COURSE_COORDINATOR, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { question, batchScope } = body as { question?: string; batchScope?: string[] };

  if (!question?.trim()) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }
  if (question.length > 1000) {
    return NextResponse.json({ error: "Question too long (max 1000 characters)" }, { status: 400 });
  }

  const teacherId = auth.ctx.payload.sub;

  // Build batch summary (shared helper — same data as the Psych/Edu tabs)
  // Wrap in try-catch: the batch summary might fail if schema relations
  // don't match. Fall back to a simple student list from /api/stats data.
  let summary;
  try {
    summary = await buildTeacherBatchSummary(teacherId, batchScope);
  } catch (summaryErr) {
    logger.error("Batch summary failed, falling back to simple stats", {
      teacherId,
      error: summaryErr instanceof Error ? summaryErr.message : String(summaryErr),
    });
    // Fallback: get basic student list — NO relations (safe for all schemas)
    // For admin/principal/demo roles, getTeacherBatchIds returns null (all batches).
    // We must NOT pass `batchId: { in: null || [] }` (= zero students).
    const { db } = await import("@/lib/db");
    const { getTeacherBatchIds } = await import("@/lib/batch-teachers");
    const batchIds = await getTeacherBatchIds(teacherId, auth.ctx.payload.role);
    // null = admin role → see all students. [] = teacher with no batches → see nothing.
    const batchFilter = batchIds === null ? {} : { batchId: { in: batchIds } };
    const students = await db.user.findMany({
      where: { role: "student", ...batchFilter, blocked: false },
      select: { id: true, name: true, currentWeek: true },
      take: 200,
    });
    summary = {
      totalStudents: students.length,
      students: students.map(s => ({
        userId: s.id,
        name: s.name,
        currentWeek: s.currentWeek,
        progress: 0,
        wellbeingTier: "green",
        calibrationGap: 0,
        daysSinceTouchpoint: 0,
        openCrisisFlags: 0,
        latestWeeklyTestScore: null,
        skillMastery: [],
        psychEvidence: [],
      })),
    };
  }

  if (summary.students.length === 0) {
    return NextResponse.json({
      answer: "You don't have any students assigned to your batch yet. Once students are assigned, I can analyze their patterns for you.",
      references: [],
    });
  }

  // Build a compact JSON for the AI (not the full summary — just what's needed)
  const compactSummary = summary.students.map(s => ({
    name: s.name,
    week: s.currentWeek,
    progress: s.progress,
    tier: s.wellbeingTier,
    calibrationGap: s.calibrationGap,
    daysSinceContact: s.daysSinceTouchpoint,
    crisisFlags: s.openCrisisFlags,
    latestScore: s.latestWeeklyTestScore,
    masteryTrends: s.skillMastery.reduce((acc, m) => {
      if (m.trend === "declining") acc.declining.push(m.topic);
      if (m.trend === "improving") acc.improving.push(m.topic);
      return acc;
    }, { declining: [] as string[], improving: [] as string[] }),
    psychSignals: s.psychEvidence.slice(0, 3).map(e => `${e.dimension}: ${e.value}`),
  }));

  const systemPrompt = `You are helping a teacher understand their batch. You are given structured data, not raw student work. Answer the specific question asked.

Rules:
1. Cite which students and which specific signal led to your answer.
2. If the data doesn't support a confident answer, say so — do not speculate about a student's internal state beyond what the evidence shows.
3. Use "the data suggests" or "appears to" language for behavioral observations.
4. Never state a clinical or psychological diagnosis.
5. Write in Roman (Latin) script. If the question is in another language, respond in that language in Roman script.
6. Keep the answer concise — 3-5 sentences for specific questions, up to 8 for broad questions.
7. End with a "References:" section listing the student names and data points you cited, one per line, so the teacher can click through.

Example answer format:
"Three students show declining mastery trends this week: Alex (database queries), Sam (API design), and Jordan (authentication). Alex also has a calibration gap of +15 (overconfident), suggesting they may not realize they're struggling. Consider a group review session on these topics.

References:
- Alex: declining mastery in 'database queries', calibration gap +15
- Sam: declining mastery in 'API design'
- Jordan: declining mastery in 'authentication'"`;

  const userPrompt = `Batch data (${summary.totalStudents} students):
${JSON.stringify(compactSummary, null, 2)}

Question: "${question}"

Answer:`;

  try {
    const result = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      feature: "teacher_assistant",
      temperature: 0.3, // low temp — analytical, not creative
      maxTokens: 800,
    });

    const answer = result.text?.trim() || "I wasn't able to generate an answer. Please try rephrasing your question.";

    // Extract references (student names mentioned in the answer)
    const mentionedStudents = summary.students.filter(s =>
      answer.toLowerCase().includes(s.name.toLowerCase())
    );
    const references = mentionedStudents.map(s => ({
      userId: s.userId,
      name: s.name,
      tier: s.wellbeingTier,
      week: s.currentWeek,
    }));

    return NextResponse.json({
      answer,
      references,
      queryTimestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Teacher AI Assistant call failed", { teacherId, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      answer: "I wasn't able to process your question right now. Please try again in a moment.",
      references: [],
    });
  }
}
