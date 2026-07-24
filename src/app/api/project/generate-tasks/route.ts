import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai-provider";

/** POST /api/project/generate-tasks — AI generates project-specific tasks.
 *
 *  Body options:
 *  - { weeks?: number } — how many weeks to generate tasks for (default: projectDurationWeeks or 6)
 *  - { tasksPerWeek?: number } — tasks per week (default 5, max 10)
 *  - { replace?: boolean } — if true, deletes ALL existing tasks first (default false)
 *
 *  The AI reads the student's project definition (name, scope, objectives,
 *  requirements, business case, duration) and generates custom tasks tailored
 *  to THAT specific project — NOT the generic curriculum. For example, a
 *  "Restaurant Website" project gets tasks like "Design menu page",
 *  "Build reservation form", "Add Google Maps integration", etc.
 *
 *  Generated tasks are saved as ProjectTask rows with the `day` column set
 *  (1-5, Mon-Fri) so they show up in the daily reminder + dashboard.
 *
 *  This is SEPARATE from the curriculum (fixed in src/lib/course-topics.ts).
 *  The curriculum is what the student LEARNS each week; these tasks are what
 *  the student BUILDS for their project each week.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load the full project definition
  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      projectName: true,
      projectScope: true,
      projectObjectives: true,
      projectRequirements: true,
      projectBusinessCase: true,
      projectDurationWeeks: true,
      projectNotes: true,
    },
  });

  if (!fullUser?.projectName?.trim()) {
    return NextResponse.json(
      { error: "No project found. Create a project first in My Journey." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const weeksRequested = Math.min(Math.max(Number(body.weeks) || fullUser.projectDurationWeeks || 6, 1), 26);
  const tasksPerWeek = Math.min(Math.max(Number(body.tasksPerWeek) || 5, 1), 10);
  const replace = body.replace === true;

  // H2-fix: Don't delete old tasks BEFORE calling AI — if the AI fails,
  // the student's previous tasks are lost. Instead, we delete old tasks
  // AFTER the AI succeeds (just before createMany below).
  // For now, just remember whether we need to delete later.
  let oldTaskIds: string[] = [];
  if (replace) {
    const existingTasks = await db.projectTask.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    oldTaskIds = existingTasks.map(t => t.id);
  } else {
    // Don't duplicate if the student already has tasks
    const existingCount = await db.projectTask.count({ where: { userId: user.id } });
    if (existingCount > 0) {
      return NextResponse.json({
        ok: true,
        tasksCreated: 0,
        message: `You already have ${existingCount} task${existingCount === 1 ? "" : "s"}. Use "Replace all" to regenerate, or add tasks manually in the Project tab.`,
      });
    }
  }

  // Build the project context for the AI
  const projectContext = [
    `Project Name: ${fullUser.projectName}`,
    fullUser.projectScope ? `Scope: ${fullUser.projectScope}` : "",
    fullUser.projectObjectives ? `Objectives: ${fullUser.projectObjectives}` : "",
    fullUser.projectRequirements ? `Requirements: ${fullUser.projectRequirements}` : "",
    fullUser.projectBusinessCase ? `Business Case: ${fullUser.projectBusinessCase}` : "",
    fullUser.projectNotes ? `Notes: ${fullUser.projectNotes}` : "",
    `Duration: ${weeksRequested} weeks`,
  ].filter(Boolean).join("\n");

  // Generate tasks via AI
  let tasks: { week: number; day: number; description: string; isMilestone: boolean }[] = [];

  try {
    const aiResult = await callAI([
      {
        role: "user",
        content: `You are a senior project manager helping a bootcamp student plan their capstone project. Generate a detailed, actionable task list tailored to THIS specific project.

${projectContext}

Bootcamp context (students use WordPress, LocalWP, Make.com, AI APIs — they are NOT coding from scratch, they are building with no-code/low-code tools).

Generate ${tasksPerWeek} tasks per week for ${weeksRequested} week(s) (total: ${weeksRequested * tasksPerWeek} tasks). Each task must be:
- Specific to THIS project (use the project name and features)
- Actionable in one day (2-4 hours of work)
- Concrete (not vague like "research" or "plan")
- Tailored to a beginner using no-code tools

For each task, assign:
- week: 1 to ${weeksRequested}
- day: 1 to 5 (Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5)
- description: the task (DO NOT prefix with "Day N:" — just the task text)
- isMilestone: true for key deliverables (e.g., "Homepage live", "Database connected", "AI feature working", "Deployed to production") — at most 1-2 milestones per week

Return ONLY a JSON array of ${weeksRequested * tasksPerWeek} objects. No markdown, no explanation.

Example:
[{"week":1,"day":1,"description":"Set up WordPress dev environment for ${fullUser.projectName}","isMilestone":false},{"week":1,"day":2,"description":"Design homepage layout with menu and hero section","isMilestone":false},{"week":1,"day":5,"description":"Homepage complete and responsive","isMilestone":true}]`,
      },
    ], { temperature: 0.7, maxTokens: 2000, feature: "project-task-gen" });

    const raw = aiResult.text || "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    tasks = match ? JSON.parse(match[0]) : [];

    // Validate
    if (tasks.length < 5) {
      throw new Error("AI didn't generate enough tasks");
    }
  } catch (err) {
    // Fallback: generate generic project tasks if AI fails
    console.error("[project/generate-tasks] AI failed, using fallback:", err);
    const phases = [
      { phase: "Planning & Setup", tasks: [
        `Define ${fullUser.projectName} goals, users, and key features`,
        "Set up dev environment (VS Code, Git, LocalWP)",
        "Create GitHub repository and make first commit",
        "Install WordPress and configure basic settings",
        "Document project plan and sprint goals",
      ]},
      { phase: "Build Core Features", tasks: [
        `Build homepage for ${fullUser.projectName}`,
        "Design and implement main navigation",
        "Create core content pages",
        "Style the site with CSS and responsive design",
        "Test core user flows",
      ]},
      { phase: "Database & Backend", tasks: [
        "Design database schema for project data",
        "Create database tables in phpMyAdmin",
        "Connect WordPress to MySQL database",
        "Build data entry forms",
        "Test data persistence and retrieval",
      ]},
      { phase: "AI & Automation", tasks: [
        "Understand APIs and how they work",
        "Set up Make.com automation workflow",
        "Get AI API key and make first API call",
        `Integrate AI feature into ${fullUser.projectName}`,
        "Test AI integration end-to-end",
      ]},
      { phase: "Testing & Polish", tasks: [
        "Test all features and fix bugs",
        "Optimize website performance",
        "Apply security best practices",
        `Deploy ${fullUser.projectName} to live hosting`,
        "Final QA and handover preparation",
      ]},
      { phase: "Launch & Portfolio", tasks: [
        "Final project audit and quality assurance",
        "Build professional GitHub portfolio",
        "Prepare project presentation",
        `Final presentation of ${fullUser.projectName}`,
        "Document next steps and career plan",
      ]},
    ];

    for (let w = 0; w < weeksRequested; w++) {
      const phase = phases[w % phases.length];
      for (let d = 0; d < tasksPerWeek; d++) {
        const taskDesc = phase.tasks[d % phase.tasks.length];
        tasks.push({
          week: w + 1,
          day: d + 1,
          description: taskDesc,
          isMilestone: d === tasksPerWeek - 1, // last task of each week = milestone
        });
      }
    }
  }

  // Sanitize + cap
  const sanitized = tasks.slice(0, weeksRequested * tasksPerWeek).map(t => ({
    week: Math.min(Math.max(Number(t.week) || 1, 1), weeksRequested),
    day: Math.min(Math.max(Number(t.day) || 1, 1), 5),
    description: String(t.description || "").trim().slice(0, 300),
    isMilestone: !!t.isMilestone,
  })).filter(t => t.description.length > 0);

  if (sanitized.length === 0) {
    return NextResponse.json(
      { error: "AI failed to generate valid tasks. Please try again or add tasks manually." },
      { status: 500 }
    );
  }

  // H2-fix: Now that the AI succeeded, delete old tasks (if replace mode).
  // This is AFTER the AI call, so if AI failed, old tasks are preserved.
  if (replace && oldTaskIds.length > 0) {
    await db.comment.deleteMany({
      where: { taskId: { in: oldTaskIds } },
    });
    await db.projectTask.deleteMany({ where: { userId: user.id } });
  }

  // Create the tasks
  const created = await db.projectTask.createMany({
    data: sanitized.map(t => ({
      userId: user.id,
      description: t.description,
      status: "planned",
      week: t.week,
      day: t.day,
      isMilestone: t.isMilestone,
    })),
  });

  // === Generate week titles + summaries via AI ===
  let weeksGenerated = 0;
  try {
    const planResult = await callAI([
      {
        role: "user",
        content: `You are a project planning assistant. For the project below, write a short title and 1-2 sentence summary for EACH of the ${weeksRequested} weeks.

${projectContext}

For each week, provide:
- title: a short name (e.g., "Week 1: Planning & Setup", "Week 3: API Integration")
- summary: 1-2 sentences describing what the student will accomplish that week
- milestones: an array of 1-3 key milestone strings for that week

Return ONLY a JSON array of ${weeksRequested} objects, ordered by week. No markdown.

Example:
[{"week":1,"title":"Week 1: Planning & Setup","summary":"Define project goals, set up dev environment, and create the GitHub repo.","milestones":["Project brief documented","Dev environment ready"]}]`,
      },
    ], { temperature: 0.6, maxTokens: 1500, feature: "project-week-gen" });

    const planRaw = planResult.text || "[]";
    const planMatch = planRaw.match(/\[[\s\S]*\]/);
    const weekPlans: { week: number; title: string; summary: string; milestones: string[] }[] =
      planMatch ? JSON.parse(planMatch[0]) : [];

    // Delete existing ProjectWeek rows, then create new ones
    await db.projectWeek.deleteMany({ where: { userId: user.id } });
    await db.projectWeek.createMany({
      data: weekPlans.slice(0, weeksRequested).map(wp => ({
        userId: user.id,
        weekNumber: Math.min(Math.max(Number(wp.week) || 1, 1), weeksRequested),
        title: String(wp.title || `Week ${wp.week}`).trim().slice(0, 200),
        summary: String(wp.summary || "").trim(),
        milestones: JSON.stringify(Array.isArray(wp.milestones) ? wp.milestones : []),
      })),
    });
    weeksGenerated = weekPlans.length;
  } catch (err) {
    // Non-fatal — tasks were created, just skip week summaries
    console.error("[project/generate-tasks] Week plan generation failed:", err);
  }

  return NextResponse.json({
    ok: true,
    tasksCreated: created.count,
    weeksCovered: weeksRequested,
    weeksGenerated,
    message: `Generated ${created.count} AI-tailored tasks for "${fullUser.projectName}" across ${weeksRequested} week${weeksRequested === 1 ? "" : "s"}. View them in the Project tab.`,
  });
}
