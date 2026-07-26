/**
 * Course-Aware Project Plan + Task Generator
 *
 * Replaces the old generic task generator with one that ALIGNS the student's
 * capstone project tasks with their course's weekly phases + daily topics.
 *
 * For each project week (1..projectDurationWeeks), the AI receives:
 *   - The matching course week's phase name + milestone
 *   - The 5 daily topics + objectives for that course week
 *   - The student's project definition (name, scope, objectives, requirements, etc.)
 *
 * The AI then generates per-day project tasks that:
 *   - Build on what the student is LEARNING in the course that day
 *   - Move the student's specific capstone project forward
 *   - Are concrete and actionable (2-4 hours of work)
 *
 * Output:
 *   - ProjectWeek rows: 1 per project week, with title/summary/milestones
 *   - ProjectTask rows: tasksPerWeek per week, with day column set (1-5)
 *
 * The ProjectTask `day` column is the key sync point — when the student is on
 * course week 3, day 2, they see BOTH:
 *   - Today's course daily topic (e.g. "REST APIs")
 *   - Today's project task (e.g. "Build the GET /products endpoint for your store")
 *
 * The Daily Task Reminder + Check-in panel use this alignment to show a single
 * coherent "today" experience.
 */

import { db } from "@/lib/db";
import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import { getCourseTopics } from "@/modules/course/lib/course-db";

/** Shape of a single AI-generated project task. */
export interface GeneratedProjectTask {
  week: number;          // 1..projectDurationWeeks
  day: number;           // 1-5 (Mon-Fri)
  description: string;   // Concrete task, project-specific
  isMilestone: boolean;  // True for key deliverables (max 1-2 per week)
  courseTopicLink: string; // Which course topic this builds on (for the AI's reasoning, surfaced to the student)
}

/** Shape of an AI-generated project week plan. */
export interface GeneratedProjectWeek {
  week: number;          // 1..projectDurationWeeks
  courseWeek: number;    // Which course week this aligns to (may differ when projectDuration > courseWeeks)
  title: string;         // e.g. "Week 1: Foundation + Project Setup"
  summary: string;       // 1-2 sentences
  milestones: string[];  // 1-3 milestone strings
}

export interface GeneratePlanResult {
  ok: boolean;
  tasksCreated: number;
  weeksGenerated: number;
  weeksRequested: number;
  error?: string;
}

/** Build the course-context section of the AI prompt.
 *  Returns a string describing each course week's phase + daily topics. */
async function buildCourseContextSection(
  userId: string,
  projectDurationWeeks: number,
  courseTotalWeeks: number
): Promise<{ text: string; alignment: { projectWeek: number; courseWeek: number }[] }> {
  const courseTopics = await getCourseTopics(userId);

  // Map project weeks to course weeks. When projectDurationWeeks <= courseTotalWeeks,
  // we align 1:1. When project is longer (rare — capped at courseWeeks-1 by the API),
  // we wrap around so each project week still has a course-week context.
  const alignment: { projectWeek: number; courseWeek: number }[] = [];
  for (let pw = 1; pw <= projectDurationWeeks; pw++) {
    const cw = ((pw - 1) % courseTotalWeeks) + 1;
    alignment.push({ projectWeek: pw, courseWeek: cw });
  }

  const lines: string[] = [];
  for (const { projectWeek, courseWeek } of alignment) {
    const week = courseTopics.find(w => w.week === courseWeek);
    if (!week) continue;
    lines.push(`PROJECT WEEK ${projectWeek} (aligns with COURSE WEEK ${courseWeek}: ${week.phase})`);
    if (week.topics.length === 0) {
      lines.push(`  (no daily topics defined for this course week)`);
    } else {
      week.topics.forEach((topic, idx) => {
        const dayNum = (topic as { day?: number }).day || idx + 1;
        const objective = topic.objective || "(no objective)";
        lines.push(`  Day ${dayNum}: ${topic.title} — Objective: ${objective}`);
      });
    }
    lines.push("");
  }

  return { text: lines.join("\n"), alignment };
}

/** Generate a course-aligned project plan + daily tasks for a student.
 *
 *  Steps:
 *  1. Load student's project definition + course outline.
 *  2. Build a course-context prompt section showing each project week's
 *     aligned course week + daily topics.
 *  3. Ask the AI for a JSON object with two arrays: `weeks` and `tasks`.
 *  4. Validate + sanitize.
 *  5. In a transaction: delete old tasks+weeks (if replace), create new ones.
 *
 *  Returns { ok, tasksCreated, weeksGenerated, error? }.
 */
export async function generateCourseAlignedPlan(
  userId: string,
  options: {
    weeks?: number;        // Override projectDurationWeeks (default: from user record)
    tasksPerWeek?: number; // Default 5, max 10
    replace?: boolean;     // Delete existing tasks first (default false)
  } = {}
): Promise<GeneratePlanResult> {
  const tasksPerWeek = Math.min(Math.max(options.tasksPerWeek ?? 5, 1), 10);
  const replace = options.replace === true;

  // 1. Load project definition + course-week count
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      projectName: true, projectScope: true, projectObjectives: true,
      projectRequirements: true, projectBusinessCase: true,
      projectDurationWeeks: true, projectNotes: true,
    },
  });
  if (!user) return { ok: false, tasksCreated: 0, weeksGenerated: 0, weeksRequested: 0, error: "User not found" };
  if (!user.projectName?.trim()) {
    return { ok: false, tasksCreated: 0, weeksGenerated: 0, weeksRequested: 0, error: "No project found. Create a project first." };
  }

  const weeksRequested = Math.min(
    Math.max(options.weeks ?? user.projectDurationWeeks ?? 4, 2),
    26
  );

  // 2. Load course outline (so we can align project tasks with course daily topics)
  const courseTopics = await getCourseTopics(userId);
  const courseTotalWeeks = courseTopics.length;
  if (courseTotalWeeks === 0) {
    return { ok: false, tasksCreated: 0, weeksGenerated: 0, weeksRequested: 0, error: "No course outline found. Ask your teacher to assign a course." };
  }

  // 3. Build the course-context section
  const { text: courseContextSection, alignment } = await buildCourseContextSection(
    userId,
    weeksRequested,
    courseTotalWeeks
  );

  // 4. Build the project-context section
  const projectContext = [
    `Project Name: ${user.projectName}`,
    user.projectScope ? `Scope: ${user.projectScope}` : "",
    user.projectObjectives ? `Objectives: ${user.projectObjectives}` : "",
    user.projectRequirements ? `Requirements: ${user.projectRequirements}` : "",
    user.projectBusinessCase ? `Business Case: ${user.projectBusinessCase}` : "",
    user.projectNotes ? `Notes: ${user.projectNotes}` : "",
    `Project Duration: ${weeksRequested} weeks`,
  ].filter(Boolean).join("\n");

  // 5. Track old task IDs (for replace mode) — but DON'T delete yet.
  //    If the AI fails, the student's previous tasks are preserved.
  let oldTaskIds: string[] = [];
  if (replace) {
    const existing = await db.projectTask.findMany({
      where: { userId },
      select: { id: true },
    });
    oldTaskIds = existing.map(t => t.id);
  } else {
    const existingCount = await db.projectTask.count({ where: { userId } });
    if (existingCount > 0) {
      return {
        ok: false,
        tasksCreated: 0,
        weeksGenerated: 0,
        weeksRequested,
        error: `You already have ${existingCount} task${existingCount === 1 ? "" : "s"}. Use "Replace all" to regenerate.`,
      };
    }
  }

  // 6. Ask the AI for a JSON object with weeks + tasks
  let weeks: GeneratedProjectWeek[] = [];
  let tasks: GeneratedProjectTask[] = [];

  try {
    const result = await callAI([
      {
        role: "system",
        content: `You are a senior capstone project mentor. You create week-by-week project plans + per-day tasks that ALIGN with the student's course curriculum. Each project task must build on what the student is LEARNING that day in the course AND move their specific project forward. Return ONLY valid JSON — no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Create a ${weeksRequested}-week capstone project plan with ${tasksPerWeek} tasks per week (total: ${weeksRequested * tasksPerWeek} tasks).

=== STUDENT'S PROJECT ===
${projectContext}

=== COURSE OUTLINE (project weeks align with these course weeks) ===
${courseContextSection}

=== REQUIREMENTS ===
For EACH project week, generate:
1. A week plan: title, summary (1-2 sentences), 1-3 milestones
2. ${tasksPerWeek} tasks, one per day (day 1-5, Mon-Fri)

Each task MUST:
- Be specific to THIS student's project ("${user.projectName}") — use the project name and features
- Be actionable in 2-4 hours by a beginner
- BUILD ON the course topic for that day (reference the course concept in the task description)
- Have a clear deliverable (not vague like "research" or "plan")
- Include a "courseTopicLink" field — a short note explaining how the task connects to that day's course topic

Mark isMilestone=true for key deliverables (e.g. "Homepage live", "Database connected", "AI feature working", "Deployed") — at most 1-2 milestones per week.

Return ONLY this JSON shape:
{
  "weeks": [
    { "week": 1, "courseWeek": 1, "title": "Week 1: ...", "summary": "...", "milestones": ["...", "..."] }
  ],
  "tasks": [
    { "week": 1, "day": 1, "description": "...", "isMilestone": false, "courseTopicLink": "..." }
  ]
}`,
      },
    ], {
      temperature: 0.6,
      maxTokens: 3500,
      feature: "project-plan-gen",
    });

    const raw = result.text || "{}";
    // Extract the outermost JSON object (the AI sometimes wraps in markdown fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI did not return valid JSON");
    }
    const parsed = JSON.parse(jsonMatch[0]) as { weeks?: GeneratedProjectWeek[]; tasks?: GeneratedProjectTask[] };
    weeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];
    tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

    if (tasks.length < weeksRequested * tasksPerWeek * 0.5) {
      throw new Error(`AI generated too few tasks (${tasks.length} of ${weeksRequested * tasksPerWeek} expected)`);
    }
  } catch (err) {
    logger.error("Course-aligned plan generation failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });

    // Fallback: generate a sensible plan + tasks without AI, using the course outline
    const fallback = generateFallbackPlan(user.projectName, alignment, courseTopics, weeksRequested, tasksPerWeek);
    weeks = fallback.weeks;
    tasks = fallback.tasks;
  }

  // 7. Sanitize
  const sanitizedWeeks = weeks.slice(0, weeksRequested).map(w => ({
    weekNumber: Math.min(Math.max(Number(w.week) || 1, 1), weeksRequested),
    title: String(w.title || `Week ${w.week}`).trim().slice(0, 200),
    summary: String(w.summary || "").trim().slice(0, 500),
    milestones: JSON.stringify(
      Array.isArray(w.milestones)
        ? w.milestones.map(m => String(m).slice(0, 200)).filter(Boolean).slice(0, 3)
        : []
    ),
  })).filter(w => w.title.length > 0);

  const sanitizedTasks = tasks.slice(0, weeksRequested * tasksPerWeek).map(t => ({
    week: Math.min(Math.max(Number(t.week) || 1, 1), weeksRequested),
    day: Math.min(Math.max(Number(t.day) || 1, 1), 5),
    description: String(t.description || "").trim().slice(0, 300),
    isMilestone: !!t.isMilestone,
    courseTopicLink: String(t.courseTopicLink || "").trim().slice(0, 200),
  })).filter(t => t.description.length > 0);

  if (sanitizedTasks.length === 0) {
    return {
      ok: false,
      tasksCreated: 0,
      weeksGenerated: 0,
      weeksRequested,
      error: "AI failed to generate valid tasks. Please try again or add tasks manually.",
    };
  }

  // 8. Persist in a transaction (delete old + create new)
  try {
    await db.$transaction(async (tx) => {
      // Delete old tasks + comments (if replace mode) — AFTER AI succeeded
      if (replace && oldTaskIds.length > 0) {
        await tx.comment.deleteMany({ where: { taskId: { in: oldTaskIds } } });
        await tx.projectTask.deleteMany({ where: { userId } });
      }
      // Always replace week rows (cheap to regenerate)
      await tx.projectWeek.deleteMany({ where: { userId } });

      // Create new weeks
      if (sanitizedWeeks.length > 0) {
        await tx.projectWeek.createMany({
          data: sanitizedWeeks.map(w => ({
            userId,
            weekNumber: w.weekNumber,
            title: w.title,
            summary: w.summary,
            milestones: w.milestones,
          })),
        });
      }

      // Create new tasks
      await tx.projectTask.createMany({
        data: sanitizedTasks.map(t => ({
          userId,
          description: t.description,
          status: "planned" as const,
          week: t.week,
          day: t.day,
          isMilestone: t.isMilestone,
          // Store the courseTopicLink in taskNotes so it surfaces in the task detail UI
          taskNotes: t.courseTopicLink || null,
        })),
      });
    });
  } catch (err) {
    logger.error("Failed to persist course-aligned plan", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      tasksCreated: 0,
      weeksGenerated: 0,
      weeksRequested,
      error: "Failed to save the generated plan. Please try again.",
    };
  }

  return {
    ok: true,
    tasksCreated: sanitizedTasks.length,
    weeksGenerated: sanitizedWeeks.length,
    weeksRequested,
  };
}

/** Generate a sensible fallback plan + tasks WITHOUT AI.
 *  Used when the AI call fails — ensures the student always gets SOMETHING usable. */
function generateFallbackPlan(
  projectName: string,
  alignment: { projectWeek: number; courseWeek: number }[],
  courseTopics: { week: number; phase: string; topics: { title: string; objective: string }[] }[],
  weeksRequested: number,
  tasksPerWeek: number
): { weeks: GeneratedProjectWeek[]; tasks: GeneratedProjectTask[] } {
  const weeks: GeneratedProjectWeek[] = [];
  const tasks: GeneratedProjectTask[] = [];

  const phaseLabels = [
    "Setup & Planning", "Core Build", "Integration", "Polish & Deploy",
  ];

  for (const { projectWeek, courseWeek } of alignment) {
    const courseWeekData = courseTopics.find(w => w.week === courseWeek);
    const phaseLabel = phaseLabels[(projectWeek - 1) % phaseLabels.length];

    weeks.push({
      week: projectWeek,
      courseWeek,
      title: `Week ${projectWeek}: ${phaseLabel}${courseWeekData ? ` — ${courseWeekData.phase}` : ""}`,
      summary: `Apply this week's course concepts to move your "${projectName}" project forward. Focus on building core features and applying what you're learning.`,
      milestones: projectWeek === weeksRequested
        ? [`"${projectName}" deployed and ready to present`]
        : [`Week ${projectWeek} deliverable for ${projectName}`],
    });

    // Generate one task per day, aligned with the course daily topic
    const dayCount = Math.min(tasksPerWeek, 5);
    for (let d = 1; d <= dayCount; d++) {
      const courseTopic = courseWeekData?.topics[d - 1];
      const topicTitle = courseTopic?.title || `Day ${d} concept`;
      tasks.push({
        week: projectWeek,
        day: d,
        description: courseTopic
          ? `Apply "${topicTitle}" to your "${projectName}" project — implement, document, or extend the relevant feature.`
          : `Work on "${projectName}" — apply this week's course concepts to advance your project.`,
        isMilestone: d === dayCount, // last day of the week = milestone
        courseTopicLink: `Builds on course topic: ${topicTitle}`,
      });
    }
  }

  return { weeks, tasks };
}
