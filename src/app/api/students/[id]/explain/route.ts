import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import crypto from "crypto";

/** GET /api/students/[id]/explain — AI-generated narrative summary
 *  of a student's trajectory.
 *
 *  Uses the configured AI model (callAI) — the AI Assistant.
 *  Cached via AICache model, invalidated when new academic data arrives.
 *
 *  The narrative is:
 *  - 4-6 sentences, plain language
 *  - Notes what changed and when
 *  - Notes uncertainty rather than smoothing over it
 *  - Never states a clinical or psychological diagnosis
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // IDOR protection
  try {
    await assertCanAccessStudent(payload, id);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  // Demo AI enable/disable check (admin-configurable)
  const isDemoUser = payload.email.includes("@demo.ai") || payload.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled by the administrator." }, { status: 403 });
  }

  // Per-user daily rate limit (assistant category — student-detail tools)
  const category = categoryForFeature("student-explain");
  const limit = await checkUserAILimit(payload.sub, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI Assistant limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
      category,
      used: limit.used,
      limit: limit.limit,
      resetAt: limit.resetAt.toISOString(),
    }, { status: 429 });
  }

  // Fetch academic history (chronological)
  const [student, skillMastery, interactions, weeklyTests] = await Promise.all([
    db.user.findUnique({
      where: { id },
      select: { id: true, name: true, currentWeek: true, createdAt: true, lastLogin: true },
    }),
    db.skillMastery.findMany({
      where: { userId: id },
    }),
    db.interaction.findMany({
      where: { userId: id },
      orderBy: { date: "asc" },
      take: 50,
      select: { correctness: true, topic: true, date: true, week: true },
    }),
    db.weeklyTest.findMany({
      where: { userId: id, status: "completed" },
      orderBy: { week: "asc" },
      select: { score: true, week: true, completedAt: true },
    }),
  ]);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Build cache key: studentId + latest activity timestamp
  const latestEvidenceDate = weeklyTests.length > 0
    ? weeklyTests[weeklyTests.length - 1].completedAt?.toISOString() || student.createdAt.toISOString()
    : student.createdAt.toISOString();
  const cacheKey = crypto.createHash("sha256").update(`explain:${id}:${latestEvidenceDate}`).digest("hex");

  // Check cache
  const cached = await db.aICache.findUnique({ where: { cacheKey } });
  if (cached) {
    // Bump hit count
    await db.aICache.update({ where: { id: cached.id }, data: { hitCount: { increment: 1 } } }).catch(() => {});
    return NextResponse.json({ narrative: cached.response, cached: true });
  }

  // Build the prompt
  const evidenceSummary = {
    student: { name: student.name, currentWeek: student.currentWeek, enrolledAt: student.createdAt },
    skillMastery: skillMastery.map(m => ({ topic: m.topic, level: m.masteryLevel, trend: m.trend })),
    interactions: interactions.map(i => ({ score: i.correctness, topic: i.topic, week: i.week, date: i.date })),
    weeklyTests: weeklyTests.map(t => ({ score: t.score, week: t.week, date: t.completedAt })),
  };

  const systemPrompt = `Write a short (4-6 sentence) narrative for an instructor about one student's trajectory this course. Plain language, not a data recitation. Note what changed and when. Note anything you're uncertain about rather than smoothing over it. Use "the data suggests" or "appears to" language for behavioral observations. Write in Roman (Latin) script, matching the student's dominant language from their answers if not English.`;

  const userPrompt = `Student: ${student.name} (Week ${student.currentWeek})

Evidence history (chronological):
${JSON.stringify(evidenceSummary, null, 2)}

Write the narrative:`;

  try {
    const result = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], { feature: "student-explain", temperature: 0.4, maxTokens: 300, userId: payload.sub });

    const narrative = result.text?.trim() || "Unable to generate narrative at this time.";

    // Cache the result
    await db.aICache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        response: narrative,
        provider: "deepseek",
        promptTokens: 0,
        completionTokens: 0,
      },
      update: {
        response: narrative,
        createdAt: new Date(), // refresh timestamp
      },
    }).catch(() => {});

    return NextResponse.json({ narrative, cached: false });
  } catch (err) {
    logger.error("Student explain AI call failed", { studentId: id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ narrative: "Unable to generate narrative at this time. Please try again later.", cached: false });
  }
}
