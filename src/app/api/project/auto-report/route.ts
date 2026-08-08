import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isStaffRole } from "@/lib/rbac";

/**
 * POST /api/project/auto-report — auto-generate a weekly project report
 * from the student's daily check-ins for that week.
 *
 * Body: { week: number, userId?: string }
 *   - Student: auto-uses their own ID
 *   - Staff: pass userId to generate for a specific student
 *
 * The endpoint:
 *   1. Fetches all daily logs for the specified week
 *   2. Fetches completed tasks for that week
 *   3. Sends to AI: "Write a weekly project report from these daily check-ins"
 *   4. AI generates a structured report with: summary, what was done, blockers, next steps
 *   5. Saves as a ProjectReport (reportType: "weekly", aiAnalysis populated)
 *
 * The student can then review + edit before "submitting" it officially.
 */

export async function POST(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { week, userId: userIdParam } = body as { week?: number; userId?: string };

  if (!week || week < 1) {
    return NextResponse.json({ error: "week required (1+)" }, { status: 400 });
  }

  // Determine target user
  const isStaff = isStaffRole(payload.role);
  const targetUserId = isStaff && userIdParam ? userIdParam : payload.sub;

  // IDOR protection
  if (targetUserId !== payload.sub) {
    try { await assertCanAccessStudent(payload, targetUserId); } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
    }
  }

  // Demo AI check
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true, role: true, projectName: true, projectDescription: true },
  });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isDemoUser = targetUser.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled." }, { status: 403 });
  }

  // Rate limit
  const category = categoryForFeature("project-report-analysis");
  const limit = await checkUserAILimit(payload.sub, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
    }, { status: 429 });
  }

  // Fetch daily logs + tasks for the week
  const [dailyLogs, tasks] = await Promise.all([
    db.dailyLog.findMany({
      where: { userId: targetUserId, week },
      orderBy: { date: "asc" },
      select: { date: true, confidence: true, whatDidYouDo: true, anyErrors: true, learningReflection: true, confusionNotes: true, nextQuestion: true, gitCommit: true },
    }),
    db.projectTask.findMany({
      where: { userId: targetUserId, week },
      select: { description: true, status: true, day: true, completedAt: true, isMilestone: true },
      orderBy: { day: "asc" },
    }),
  ]);

  if (dailyLogs.length === 0 && tasks.length === 0) {
    return NextResponse.json({
      error: `No daily check-ins or tasks found for Week ${week}. Complete your daily check-ins first.`,
    }, { status: 400 });
  }

  // Build the data summary for the AI
  const checkinSummary = dailyLogs.map(log => ({
    date: log.date.toISOString().slice(0, 10),
    confidence: log.confidence,
    whatDidYouDo: log.whatDidYouDo,
    anyErrors: log.anyErrors,
    learning: log.learningReflection,
    confusion: log.confusionNotes,
    nextQuestion: log.nextQuestion,
    gitCommit: log.gitCommit,
  }));

  const taskSummary = tasks.map(t => ({
    day: t.day,
    description: t.description,
    status: t.status,
    completedAt: t.completedAt?.toISOString().slice(0, 10) || null,
    isMilestone: t.isMilestone,
  }));

  const systemPrompt = `You are writing a weekly project report for a bootcamp student based on their daily check-ins. The report should be professional, honest, and actionable.

Output JSON ONLY:
{
  "reportText": "A 3-4 paragraph report covering: what was accomplished, what was learned, what blocked progress, and what to focus on next week. Written in first person as the student.",
  "aiAnalysis": {
    "score": 0-100,
    "projectUnderstanding": 0-100,
    "technicalDepth": 0-100,
    "progress": 0-100,
    "clarity": 0-100,
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "feedback": "1-2 sentences of constructive feedback"
  }
}

Rules:
1. Base the report on the ACTUAL check-in data — don't invent activities.
2. If confidence was low but tasks were completed, note the gap.
3. If tasks are still 'planned' or 'blocked', mention them as blockers.
4. Score should reflect actual progress (completed tasks / total tasks * 100, adjusted for quality signals from check-ins).
5. Output in Roman (Latin) script.`;

  const userPrompt = `Student: ${targetUser.name}
Project: ${targetUser.projectName || "Untitled project"}
Week: ${week}

Daily check-ins for Week ${week}:
${JSON.stringify(checkinSummary, null, 2)}

Tasks for Week ${week}:
${JSON.stringify(taskSummary, null, 2)}

Generate the weekly project report:`;

  try {
    const result = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      feature: "project-report-analysis",
      temperature: 0.4,
      maxTokens: 800,
      userId: payload.sub,
    });

    let parsed: { reportText: string; aiAnalysis: any };
    try {
      const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text || "{}");
    } catch {
      // Fallback: use raw text as report
      parsed = {
        reportText: result.text || "Unable to generate report from check-ins.",
        aiAnalysis: { score: 0, strengths: [], weaknesses: [], feedback: "AI analysis unavailable." },
      };
    }

    // Save as a ProjectReport
    const report = await db.projectReport.create({
      data: {
        userId: targetUserId,
        week,
        reportType: "weekly",
        reportText: parsed.reportText,
        aiAnalysis: JSON.stringify(parsed.aiAnalysis),
      },
    });

    return NextResponse.json({
      report: {
        id: report.id,
        week,
        reportText: parsed.reportText,
        aiAnalysis: parsed.aiAnalysis,
        autoGenerated: true,
        submittedAt: report.submittedAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("Auto-report generation failed", { userId: targetUserId, week, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to generate report. Please try writing it manually." }, { status: 500 });
  }
}
