import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";

/** POST /api/students/[id]/generate-project-analysis — teacher/admin generates
 *  a final project analysis for a student. This is shown in the final result.
 *
 *  The analysis is based on:
 *  - The student's project definition (name, scope, objectives, etc.)
 *  - All their project reports (weekly + final)
 *  - Their project tasks (completion rate, milestones)
 *  - Their project weeks (custom titles + summaries)
 *
 *  Returns: { analysis: { score, strengths, weaknesses, summary, careerReadiness, recommendations } }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden — teachers only" }, { status: 403 });
  }

  const { id: studentId } = await params;

  // R3-fix: IDOR protection — verify the caller can access this student's data.
  // The import was already here but the call was missing.
  try {
    await assertCanAccessStudent(payload, studentId);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  // Load all student data needed for the analysis
  const [student, reports, tasks, projectWeeks] = await Promise.all([
    db.user.findUnique({
      where: { id: studentId },
      select: {
        projectName: true,
        projectScope: true,
        projectObjectives: true,
        projectRequirements: true,
        projectBusinessCase: true,
        projectDurationWeeks: true,
        projectGithubUrl: true,
        projectDeployUrl: true,
        name: true,
      },
    }),
    db.projectReport.findMany({
      where: { userId: studentId },
      orderBy: { week: "asc" },
    }),
    db.projectTask.findMany({
      where: { userId: studentId },
      select: { status: true, isMilestone: true, week: true },
    }),
    db.projectWeek.findMany({
      where: { userId: studentId },
      orderBy: { weekNumber: "asc" },
      select: { weekNumber: true, title: true, summary: true },
    }),
  ]);

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (!student.projectName) {
    return NextResponse.json({ error: "Student has no project defined" }, { status: 400 });
  }

  // Build context for the AI
  const projectContext = [
    `Project Name: ${student.projectName}`,
    student.projectScope ? `Scope: ${student.projectScope}` : "",
    student.projectObjectives ? `Objectives: ${student.projectObjectives}` : "",
    student.projectRequirements ? `Requirements: ${student.projectRequirements}` : "",
    student.projectBusinessCase ? `Business Case: ${student.projectBusinessCase}` : "",
    `Duration: ${student.projectDurationWeeks ?? 6} weeks`,
    student.projectGithubUrl ? `GitHub: ${student.projectGithubUrl}` : "",
    student.projectDeployUrl ? `Live URL: ${student.projectDeployUrl}` : "",
  ].filter(Boolean).join("\n");

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const milestones = tasks.filter(t => t.isMilestone).length;
  const completedMilestones = tasks.filter(t => t.isMilestone && t.status === "completed").length;

  const reportsContext = reports.length > 0
    ? reports.map(r => `--- Week ${r.week} (${r.reportType}) Report ---\n${r.reportText.slice(0, 500)}`).join("\n\n")
    : "No project reports submitted.";

  const weeksContext = projectWeeks.length > 0
    ? projectWeeks.map(w => `Week ${w.weekNumber}: ${w.title} — ${w.summary}`).join("\n")
    : "No custom week summaries.";

  try {
    const aiResult = await callAI([
      {
        role: "user",
        content: `You are a senior technical evaluator writing a FINAL PROJECT ANALYSIS for a bootcamp student. This analysis will appear on their final report card.

STUDENT: ${student.name}

PROJECT DEFINITION:
${projectContext}

PROJECT TIMELINE:
${weeksContext}

TASK COMPLETION:
- Total tasks: ${totalTasks}
- Completed: ${completedTasks} (${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%)
- Milestones: ${completedMilestones}/${milestones} completed

STUDENT'S PROJECT REPORTS:
${reportsContext}

Based on ALL the above, write a comprehensive project analysis. Evaluate:
- projectExecution: How well did they execute their plan? (0-100)
- technicalCompetence: Do they demonstrate real technical skills? (0-100)
- projectQuality: Is the final project of good quality? (0-100)
- careerReadiness: Are they ready for a junior developer role? (0-100)
- score: Overall project score (weighted average)

Also provide:
- summary: 3-4 sentence overall assessment of the project and student's growth
- strengths: array of 3-4 specific strengths
- weaknesses: array of 2-3 areas for improvement
- recommendations: array of 2-3 actionable next steps for the student's career

Return ONLY a JSON object. No markdown.

Example:
{"score":78,"projectExecution":80,"technicalCompetence":70,"projectQuality":75,"careerReadiness":85,"summary":"Nauman built a restaurant website with online reservations...","strengths":["Strong UI/UX sense","Consistent daily check-ins","Good use of WordPress blocks"],"weaknesses":["Limited custom code","Could improve database skills"],"recommendations":["Build a second project with more custom code","Contribute to open source","Practice SQL queries weekly"]}`,
      },
    ], { temperature: 0.4, maxTokens: 800, feature: "project-final-analysis" });

    const raw = aiResult.text || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const analysis = match ? JSON.parse(match[0]) : null;

    if (!analysis) {
      return NextResponse.json({ error: "AI failed to generate analysis. Please retry." }, { status: 500 });
    }

    // Sanitize
    const sanitized = {
      score: Math.min(Math.max(Number(analysis.score) || 0, 0), 100),
      projectExecution: Math.min(Math.max(Number(analysis.projectExecution) || 0, 0), 100),
      technicalCompetence: Math.min(Math.max(Number(analysis.technicalCompetence) || 0, 0), 100),
      projectQuality: Math.min(Math.max(Number(analysis.projectQuality) || 0, 0), 100),
      careerReadiness: Math.min(Math.max(Number(analysis.careerReadiness) || 0, 0), 100),
      summary: String(analysis.summary || "").trim(),
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths.map(String).slice(0, 6) : [],
      weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses.map(String).slice(0, 6) : [],
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations.map(String).slice(0, 6) : [],
      generatedAt: new Date().toISOString(),
      taskStats: { totalTasks, completedTasks, milestones, completedMilestones },
    };

    return NextResponse.json({ analysis: sanitized });
  } catch (err) {
    logger.error("Project analysis AI failed", { feature: "project-analysis", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "AI analysis failed. Please retry." }, { status: 500 });
  }
}
