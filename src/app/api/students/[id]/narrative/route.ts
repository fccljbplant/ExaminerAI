import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
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

  const [student, psychEvidence, interactions, touchpoints, weeklyTests] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { name: true, currentWeek: true, createdAt: true } }),
    db.psychEvidence.findMany({ where: { userId: id }, orderBy: { week: "asc" }, take: 200 }),
    db.interaction.findMany({ where: { userId: id }, orderBy: { date: "asc" }, take: 100, select: { correctness: true, topic: true, week: true } }),
    db.mentorshipTouchpoint.findMany({ where: { userId: id }, orderBy: { createdAt: "asc" }, take: 50, select: { type: true, note: true, outcome: true, createdAt: true } }),
    db.weeklyTest.findMany({ where: { userId: id, status: "completed" }, orderBy: { week: "asc" }, select: { score: true, week: true } }),
  ]);

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  // Group evidence by week
  const weeks = new Set<number>();
  psychEvidence.forEach(e => { if (e.week) weeks.add(e.week); });
  interactions.forEach(i => { if (i.week) weeks.add(i.week); });
  weeklyTests.forEach(t => weeks.add(t.week));
  const sortedWeeks = Array.from(weeks).sort((a, b) => a - b);

  const narratives: Array<{ week: number; text: string; cached: boolean }> = [];

  for (const week of sortedWeeks) {
    const weekEvidence = psychEvidence.filter(e => e.week === week);
    const weekInteractions = interactions.filter(i => i.week === week);
    const weekTest = weeklyTests.find(t => t.week === week);
    const weekTouchpoints = touchpoints.filter(t => {
      const tw = Math.ceil((new Date(t.createdAt).getTime() - new Date(student.createdAt || Date.now()).getTime()) / (7 * 24 * 60 * 60 * 1000));
      return tw === week;
    });

    // Cache key per week (invalidated when new evidence for that week arrives)
    const latestInWeek = weekEvidence.length > 0 ? weekEvidence[weekEvidence.length - 1].createdAt.toISOString() : "";
    const cacheKey = crypto.createHash("sha256").update(`narrative:${id}:week${week}:${latestInWeek}`).digest("hex");

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
      evidence: weekEvidence.map(e => ({ dimension: e.dimension, value: e.value, text: e.evidenceText })),
      interactions: weekInteractions.map(i => ({ score: i.correctness, topic: i.topic })),
      touchpoints: weekTouchpoints.map(t => ({ type: t.type, note: t.note, outcome: t.outcome })),
    };

    try {
      const result = await callAI([
        { role: "system", content: "Write one paragraph (2-3 sentences) about this student's week. Plain language. Note what changed. Note uncertainty. Never diagnose. Roman script." },
        { role: "user", content: `Student: ${student.name}, Week ${week}\nData: ${JSON.stringify(weekData)}\nParagraph:` },
      ], { feature: "narrative-week", temperature: 0.4, maxTokens: 150 });

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
