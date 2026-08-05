import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import crypto from "crypto";

/** GET /api/students/[id]/narrative — living-book narrative.
 *
 *  One paragraph per week, grounded in that week's evidence only.
 *  Past weeks are cached (don't regenerate); only current week
 *  regenerates on new evidence.
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try { await assertCanAccessStudent(payload, id); } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  // Demo AI enable/disable check (admin-configurable)
  const isDemoUser = payload.email.includes("@demo.ai") || payload.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled by the administrator." }, { status: 403 });
  }

  // Per-user daily rate limit (assistant category — student-detail tools)
  const category = categoryForFeature("narrative-week");
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

  const [student, interactions, weeklyTests] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { name: true, currentWeek: true, createdAt: true } }),
    db.interaction.findMany({ where: { userId: id }, orderBy: { date: "asc" }, take: 100, select: { correctness: true, topic: true, week: true } }),
    db.weeklyTest.findMany({ where: { userId: id, status: "completed" }, orderBy: { week: "asc" }, select: { score: true, week: true } }),
  ]);

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  // Group evidence by week
  const weeks = new Set<number>();
  interactions.forEach(i => { if (i.week) weeks.add(i.week); });
  weeklyTests.forEach(t => weeks.add(t.week));
  const sortedWeeks = Array.from(weeks).sort((a, b) => a - b);

  const narratives: Array<{ week: number; text: string; cached: boolean }> = [];

  for (const week of sortedWeeks) {
    const weekInteractions = interactions.filter(i => i.week === week);
    const weekTest = weeklyTests.find(t => t.week === week);

    // Cache key per week (invalidated when new academic data for that week arrives)
    const cacheKey = crypto.createHash("sha256").update(`narrative:${id}:week${week}`).digest("hex");

    const isCurrentWeek = week === student.currentWeek;
    // Past weeks: try cache. Current week: always regenerate (or use cache if no new evidence)
    if (!isCurrentWeek) {
      const cached = await db.aICache.findUnique({ where: { cacheKey } });
      if (cached) {
        narratives.push({ week, text: cached.response, cached: true });
        continue;
      }
    } else {
      const cached = await db.aICache.findUnique({ where: { cacheKey } });
      if (cached) {
        narratives.push({ week, text: cached.response, cached: true });
        continue;
      }
    }

    // Generate paragraph for this week
    const weekData = {
      week, testScore: weekTest?.score ?? null,
      interactions: weekInteractions.map(i => ({ score: i.correctness, topic: i.topic })),
    };

    try {
      const result = await callAI([
        { role: "system", content: "Write one paragraph (2-3 sentences) about this student's week. Plain language. Note what changed. Note uncertainty. Never diagnose. Roman script." },
        { role: "user", content: `Student: ${student.name}, Week ${week}\nData: ${JSON.stringify(weekData)}\nParagraph:` },
      ], { feature: "narrative-week", temperature: 0.4, maxTokens: 150, userId: payload.sub });

      const text = result.text?.trim() || "No data for this week.";
      // Cache
      await db.aICache.upsert({
        where: { cacheKey },
        create: { cacheKey, response: text, provider: "deepseek" },
        update: { response: text, createdAt: new Date() },
      }).catch(() => {});
      narratives.push({ week, text, cached: false });
    } catch (err) {
      logger.warn("Narrative generation failed", { studentId: id, week, error: err instanceof Error ? err.message : String(err) });
      narratives.push({ week, text: "Unable to generate narrative for this week.", cached: false });
    }
  }

  return NextResponse.json({ studentName: student.name, narratives });
}
