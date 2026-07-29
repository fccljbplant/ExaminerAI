import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { demoWriteBlock } from "@/lib/demo-guard";
import { getCourseProjectConfig } from "@/lib/course-db";

/** Generate a concise project summary + key features from the project definition.
 *  Used by POST (create) and PATCH (edit) to keep the summary in sync.
 *  Returns { summary, keyFeatures } or null on failure. */
async function generateProjectSummary(params: {
  projectName: string;
  projectScope?: string | null;
  projectObjectives?: string | null;
  projectRequirements?: string | null;
  projectBusinessCase?: string | null;
  userId?: string; // H12 fix: for usage attribution
}): Promise<{ summary: string; keyFeatures: string[] } | null> {
  const context = [
    `Project Name: ${params.projectName}`,
    params.projectScope ? `Scope: ${params.projectScope}` : "",
    params.projectObjectives ? `Objectives: ${params.projectObjectives}` : "",
    params.projectRequirements ? `Requirements: ${params.projectRequirements}` : "",
    params.projectBusinessCase ? `Business Case: ${params.projectBusinessCase}` : "",
  ].filter(Boolean).join("\n");

  try {
    const result = await callAI([
      {
        role: "user",
        content: `You are a project analyst. Read the project definition below and produce:
1. A concise 2-3 sentence summary that describes what the project is and what it does
2. A list of 3-6 key features (short phrases, each 2-6 words)

${context}

Return ONLY a JSON object: {"summary":"...","keyFeatures":["...","..."]}
No markdown, no explanation.`,
      },
    ], {
      temperature: 0.4,
      maxTokens: 400,
      feature: "project-summary-gen",
      userId: params.userId, // H12 fix: attribute to the student
      // Token cache: same project definition → same summary. If a student
      // edits then reverts their project, or multiple students submit the
      // same project template, the cache hits.
      cacheable: true,
      cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
    });

    const raw = result.text || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      summary: String(parsed.summary || "").trim().slice(0, 500),
      keyFeatures: Array.isArray(parsed.keyFeatures)
        ? parsed.keyFeatures.map(String).map(s => s.trim()).filter(Boolean).slice(0, 8)
        : [],
    };
  } catch {
    return null;
  }
}

/** POST /api/project/setup — saves the project definition + auto-generates summary.
 *
 *  The project definition is purely student-authored:
 *  - projectName, projectScope, projectObjectives, projectRequirements, projectBusinessCase
 *  - projectDurationWeeks (how long the student plans to spend — default 6)
 *  - projectStartDate (when they start)
 *  - projectNotes (free-text architecture/decision notes)
 *  - projectGithubUrl, projectDeployUrl
 *
 *  After saving, the AI generates a concise summary + key features from the
 *  definition. These are stored in projectSummary + projectKeyFeatures and
 *  shown on the Project tab (instead of the 4 separate scope/objectives/etc. fields).
 *
 *  IMPORTANT: This endpoint does NOT generate any tasks. Tasks are created
 *  by the student themselves in the Project tab (add/edit/delete) or via
 *  /api/project/generate-tasks.
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("setting up projects"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    projectName, projectScope, projectObjectives,
    projectRequirements, projectBusinessCase,
    projectDurationWeeks, projectStartDate, projectNotes,
    projectGithubUrl, projectDeployUrl,
  } = body as {
    projectName?: string;
    projectScope?: string;
    projectObjectives?: string;
    projectRequirements?: string;
    projectBusinessCase?: string;
    projectDurationWeeks?: number;
    projectStartDate?: string;
    projectNotes?: string;
    projectGithubUrl?: string;
    projectDeployUrl?: string;
  };

  if (!projectName?.trim()) {
    return NextResponse.json({ error: "projectName is required" }, { status: 400 });
  }

  // Enforce course-level project configuration:
  // - If the student's course has projects DISABLED (or no course assigned), refuse.
  // - Clamp projectDurationWeeks to [2, courseWeeks - 1].
  //   Fallback for students with no course: keep the legacy [1, 52] range so
  //   existing flows (demo, dev impersonation) don't break.
  const projectConfig = await getCourseProjectConfig(user.id);
  if (projectConfig.courseAssigned && !projectConfig.projectEnabled) {
    return NextResponse.json(
      {
        error: `Projects are not enabled for your course "${projectConfig.courseName ?? ""}". Please contact your teacher or course coordinator.`,
      },
      { status: 403 }
    );
  }

  let finalDurationWeeks: number;
  if (projectConfig.courseAssigned) {
    const minW = 2;
    const maxW = Math.max(2, projectConfig.totalWeeks - 1);
    const requested = Number(projectDurationWeeks);
    if (!Number.isFinite(requested)) {
      finalDurationWeeks = projectConfig.projectDefaultDurationWeeks;
    } else {
      finalDurationWeeks = Math.min(Math.max(Math.round(requested), minW), maxW);
    }
  } else {
    // Legacy fallback: no course assigned (demo/dev impersonation)
    finalDurationWeeks = projectDurationWeeks && projectDurationWeeks >= 1 && projectDurationWeeks <= 52
      ? Math.round(projectDurationWeeks)
      : 6;
  }

  // Save the project details on the user.
  await db.user.update({
    where: { id: user.id },
    data: {
      projectName: projectName.trim(),
      projectScope: projectScope?.trim() || null,
      projectObjectives: projectObjectives?.trim() || null,
      projectRequirements: projectRequirements?.trim() || null,
      projectBusinessCase: projectBusinessCase?.trim() || null,
      projectDurationWeeks: finalDurationWeeks,
      projectStartDate: projectStartDate ? new Date(projectStartDate) : new Date(),
      projectNotes: projectNotes?.trim() || null,
      projectGithubUrl: projectGithubUrl?.trim() || null,
      projectDeployUrl: projectDeployUrl?.trim() || null,
    },
  });

  // Generate AI summary + key features (non-blocking — if it fails, the project is still saved)
  let summaryGenerated = false;
  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(user.id, "project-summary-gen", isDemo);
    if (!blocked) {
      const summary = await generateProjectSummary({
        projectName: projectName.trim(),
        projectScope: projectScope?.trim() || null,
        projectObjectives: projectObjectives?.trim() || null,
        projectRequirements: projectRequirements?.trim() || null,
        projectBusinessCase: projectBusinessCase?.trim() || null,
        userId: user.id, // H12 fix
      });
      if (summary) {
        await db.user.update({
          where: { id: user.id },
          data: {
            projectSummary: summary.summary,
            projectKeyFeatures: JSON.stringify(summary.keyFeatures),
          },
        });
        summaryGenerated = true;
      }
    }
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    ok: true,
    projectName: projectName.trim(),
    summaryGenerated,
    message: `Project "${projectName.trim()}" saved.${summaryGenerated ? " AI summary generated." : ""} Add tasks in the Project tab.`,
  });
}

/** GET /api/project/setup — returns the current project definition (no tasks). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      projectName: true,
      projectScope: true,
      projectObjectives: true,
      projectRequirements: true,
      projectBusinessCase: true,
      projectSummary: true,
      projectKeyFeatures: true,
      projectDurationWeeks: true,
      projectStartDate: true,
      projectNotes: true,
      projectGithubUrl: true,
      projectDeployUrl: true,
    },
  });

  let keyFeatures: string[] = [];
  try {
    if (fullUser?.projectKeyFeatures) keyFeatures = JSON.parse(fullUser.projectKeyFeatures);
  } catch { /* ignore */ }

  return NextResponse.json({
    projectName: fullUser?.projectName || null,
    projectScope: fullUser?.projectScope || null,
    projectObjectives: fullUser?.projectObjectives || null,
    projectRequirements: fullUser?.projectRequirements || null,
    projectBusinessCase: fullUser?.projectBusinessCase || null,
    projectSummary: fullUser?.projectSummary || null,
    projectKeyFeatures: keyFeatures,
    projectDurationWeeks: fullUser?.projectDurationWeeks ?? 6,
    projectStartDate: fullUser?.projectStartDate ?? null,
    projectNotes: fullUser?.projectNotes || null,
    projectGithubUrl: fullUser?.projectGithubUrl || null,
    projectDeployUrl: fullUser?.projectDeployUrl || null,
  });
}

/** PATCH /api/project/setup — update project definition fields.
 *  When any of the core definition fields change (scope, objectives, requirements,
 *  business case), the AI summary is regenerated to stay in sync.
 *  Accepts any subset of the project fields. Does NOT touch tasks. */
export async function PATCH(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("setting up projects"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string | number | Date | null> = {};

  if (body.projectName !== undefined) data.projectName = String(body.projectName).trim() || null;
  if (body.projectScope !== undefined) data.projectScope = String(body.projectScope).trim() || null;
  if (body.projectObjectives !== undefined) data.projectObjectives = String(body.projectObjectives).trim() || null;
  if (body.projectRequirements !== undefined) data.projectRequirements = String(body.projectRequirements).trim() || null;
  if (body.projectBusinessCase !== undefined) data.projectBusinessCase = String(body.projectBusinessCase).trim() || null;
  if (body.projectNotes !== undefined) data.projectNotes = String(body.projectNotes).trim() || null;
  if (body.projectGithubUrl !== undefined) data.projectGithubUrl = String(body.projectGithubUrl).trim() || null;
  if (body.projectDeployUrl !== undefined) data.projectDeployUrl = String(body.projectDeployUrl).trim() || null;
  if (body.projectDurationWeeks !== undefined) {
    // Enforce course-level duration limits: [2, courseWeeks - 1] when course assigned.
    // Fallback to legacy [1, 52] when no course (demo/dev impersonation).
    const projectConfig = await getCourseProjectConfig(user.id);
    const w = Number(body.projectDurationWeeks);
    if (projectConfig.courseAssigned) {
      const minW = 2;
      const maxW = Math.max(2, projectConfig.totalWeeks - 1);
      if (Number.isFinite(w)) {
        data.projectDurationWeeks = Math.min(Math.max(Math.round(w), minW), maxW);
      }
    } else {
      if (!Number.isNaN(w) && w >= 1 && w <= 52) data.projectDurationWeeks = Math.round(w);
    }
  }
  if (body.projectStartDate !== undefined) {
    data.projectStartDate = body.projectStartDate ? new Date(body.projectStartDate) : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, message: "No changes to save." });
  }

  await db.user.update({ where: { id: user.id }, data });

  // If any core definition fields changed, regenerate the AI summary
  const coreFieldsChanged = ["projectName", "projectScope", "projectObjectives", "projectRequirements", "projectBusinessCase"]
    .some(f => body[f] !== undefined);

  if (coreFieldsChanged) {
    // Reload the full project definition for the AI
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        projectName: true, projectScope: true, projectObjectives: true,
        projectRequirements: true, projectBusinessCase: true,
      },
    });
    if (fullUser?.projectName) {
      try {
        // H1 fix: enforce per-user daily AI rate limit + demo block
        const isDemo = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
        const blocked = await enforceAIRateLimit(user.id, "project-summary-gen", isDemo);
        if (!blocked) {
          const summary = await generateProjectSummary({
            projectName: fullUser.projectName,
            projectScope: fullUser.projectScope,
            projectObjectives: fullUser.projectObjectives,
            projectRequirements: fullUser.projectRequirements,
            projectBusinessCase: fullUser.projectBusinessCase,
            userId: user.id, // H12 fix
          });
          if (summary) {
            await db.user.update({
              where: { id: user.id },
              data: {
                projectSummary: summary.summary,
                projectKeyFeatures: JSON.stringify(summary.keyFeatures),
              },
            });
          }
        }
      } catch {
        // non-fatal
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/project/setup — deletes the project + ALL tasks + their comments. */
export async function DELETE() {
  const _demoBlock = await demoWriteBlock("setting up projects"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskIds = await db.projectTask.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  if (taskIds.length > 0) {
    // H1-rel: wrap multi-step cascade in a transaction so partial
    // failures roll back (no orphaned partial state).
    await db.$transaction(async (tx) => {
      await tx.comment.deleteMany({
        where: { taskId: { in: taskIds.map(t => t.id) } },
      });
      await tx.projectTask.deleteMany({ where: { userId: user.id } });
      await tx.projectWeek.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          projectName: null,
          projectScope: null,
          projectObjectives: null,
          projectRequirements: null,
          projectBusinessCase: null,
          projectSummary: null,
          projectKeyFeatures: null,
          projectDurationWeeks: null,
          projectStartDate: null,
          projectNotes: null,
          projectGithubUrl: null,
          projectDeployUrl: null,
        },
      });
    });
  }

  return NextResponse.json({ ok: true, message: "Project deleted. All tasks, weeks, and comments removed." });
}
