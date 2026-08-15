import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** GET /api/project/reports — list all project reports for the current user. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await db.projectReport.findMany({
    where: { userId: user.id },
    orderBy: { week: "asc" },
  });

  // Parse aiAnalysis JSON for each report
  const parsed = reports.map(r => {
    let analysis = null;
    try { if (r.aiAnalysis) analysis = JSON.parse(r.aiAnalysis); } catch { /* ignore */ }
    return { ...r, aiAnalysis: analysis };
  });

  return NextResponse.json({ reports: parsed });
}

/** POST /api/project/reports — submit a project report + auto-analyze it with AI.
 *  Body: { week: number, reportType: "weekly"|"final", reportText: string }
 *  Returns the created report WITH the AI analysis (analyzed immediately). */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("generating project reports"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { week, reportType, reportText } = body as {
    week?: number;
    reportType?: string;
    reportText?: string;
  };

  if (week === undefined || !Number.isInteger(week) || week < 0 || week > 52) {
    return NextResponse.json({ error: "week must be 0-52 (0 = final)" }, { status: 400 });
  }
  if (!reportText?.trim() || reportText.trim().length < 20) {
    return NextResponse.json({ error: "Report text must be at least 20 characters" }, { status: 400 });
  }

  const weekNum = week as number;
  const type = reportType === "final" ? "final" : "weekly";

  // Load project definition for context
  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { projectName: true, projectScope: true, projectObjectives: true, projectRequirements: true },
  });

  // Check if a report already exists for this week — if so, update it; else create
  const existing = await db.projectReport.findFirst({
    where: { userId: user.id, week: weekNum, reportType: type },
  });

  // Create/update the report first (so the student's submission is saved even if AI fails)
  const report = existing
    ? await db.projectReport.update({
        where: { id: existing.id },
        data: { reportText: reportText.trim(), aiAnalysis: null, analyzedAt: null },
      })
    : await db.projectReport.create({
        data: {
          userId: user.id,
          week: weekNum,
          reportType: type,
          reportText: reportText.trim(),
        },
      });

  // === AI Analysis — similar to practice-question evaluation ===
  const projectContext = fullUser?.projectName ? `Project: ${fullUser.projectName}` : "";
  const isFinal = type === "final";

  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(user.id, "project-report-analysis", isDemo);
    if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

    const aiResult = await callAI([
      {
        role: "user",
        content: `You are a senior project evaluator assessing a student's ${isFinal ? "FINAL CAPSTONE" : "weekly"} project report. Be rigorous but encouraging.

${projectContext}

Student's report (Week ${week}):
"""
${reportText.trim().slice(0, 20_000)}
"""

Evaluate this report on these dimensions (each 0-100):
- projectUnderstanding: Does the student understand what they're building and why?
- technicalDepth: Do they demonstrate real technical understanding (not just "I clicked buttons")?
- progress: Have they made meaningful progress on their project this week?
- clarity: Is the report clear, well-organized, and easy to follow?
- score: Overall score (weighted average of the above)

Also provide:
- strengths: array of 2-3 specific things the student did well
- weaknesses: array of 1-2 areas that need improvement
- feedback: 2-3 sentences of constructive, actionable feedback

Return ONLY a JSON object. No markdown.

Example:
{"score":75,"projectUnderstanding":80,"technicalDepth":65,"progress":75,"clarity":80,"strengths":["Clear explanation of database schema","Good progress on homepage"],"weaknesses":["Missing technical details about API integration"],"feedback":"Great progress on the visual design. Next week, focus on documenting the technical decisions you made — which tools, why, and what challenges you faced. Add code snippets or screenshots to support your explanations."}`,
      },
    ], { temperature: 0.4, maxTokens: 600, feature: "project-report-analysis", userId: user.id });

    const raw = aiResult.text || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const analysis = match ? JSON.parse(match[0]) : null;

    if (analysis) {
      // Sanitize
      const sanitized = {
        score: Math.min(Math.max(Number(analysis.score) || 0, 0), 100),
        projectUnderstanding: Math.min(Math.max(Number(analysis.projectUnderstanding) || 0, 0), 100),
        technicalDepth: Math.min(Math.max(Number(analysis.technicalDepth) || 0, 0), 100),
        progress: Math.min(Math.max(Number(analysis.progress) || 0, 0), 100),
        clarity: Math.min(Math.max(Number(analysis.clarity) || 0, 0), 100),
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths.map(String).slice(0, 5) : [],
        weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses.map(String).slice(0, 5) : [],
        feedback: String(analysis.feedback || "").trim(),
      };

      const updated = await db.projectReport.update({
        where: { id: report.id },
        data: { aiAnalysis: JSON.stringify(sanitized), analyzedAt: new Date() },
      });

      return NextResponse.json({ report: { ...updated, aiAnalysis: sanitized } });
    }
  } catch (err) {
    logger.error("[project/reports] AI analysis failed", { error: err instanceof Error ? err.message : String(err) });
  }

  // Return the report without analysis if AI failed
  return NextResponse.json({
    report: { ...report, aiAnalysis: null },
    warning: "Report saved, but AI analysis failed. You can retry analysis later.",
  });
}

/** DELETE /api/project/reports?id=... — delete a project report. */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("generating project reports"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db.projectReport.delete({ where: { id, userId: user.id } });
  } catch (err) {
    // M5-rel: Distinguish "not found" from real DB errors.
    // Prisma P2025 = record not found → 404. Other errors → 500.
    if (err instanceof Error && err.message.includes("P2025")) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    logger.error("project/reports DELETE failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
