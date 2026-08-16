/**
 * Project Timeline Generator — v2 project flow (approval-gated).
 *
 * Generates a week-by-week plan + per-day tasks for ONE LearnProject,
 * aligned with the project's course outline (CourseWeek/CourseDay).
 * Everything is persisted scoped to the project (ProjectWeek.projectId /
 * ProjectTask.projectId) so multiple projects per learner never mix.
 *
 * Callers MUST enforce the approval gate: only approved (or legacy
 * active) projects may generate. This lib only reads the project.
 *
 * AI call uses feature "project-timeline" — exempt from the per-user
 * daily AI limit (single heavy generation, not chat-style usage) but
 * still logged to AIUsageLog by the provider.
 */

import { db } from "@/lib/db";
import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";

export interface TimelineTaskInput {
  week: number;
  day: number;
  description: string;
  isMilestone: boolean;
  courseTopicLink: string;
}

export interface TimelineWeekInput {
  week: number;
  title: string;
  summary: string;
  milestones: string[];
}

export interface TimelineProjectFields {
  id: string;
  userId: string;
  courseId: string | null;
  title: string;
  goal: string | null;
  stack: string | null;
  currentState: string | null;
  description: string | null;
  objectives: string | null; // JSON array
  durationWeeks: number | null;
}

export interface TimelineResult {
  ok: boolean;
  weeksCreated: number;
  tasksCreated: number;
  weeksRequested: number;
  error?: string;
}

interface CourseOutlineWeek {
  week: number;
  phase: string;
  days: { day: number; title: string; objective: string }[];
}

/** Load the course outline (weeks + daily topics) for one course. */
async function loadCourseOutline(courseId: string): Promise<CourseOutlineWeek[] | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: { days: { orderBy: { day: "asc" } } },
      },
    },
  });
  if (!course) return null;
  return course.weeks.map((w) => ({
    week: w.weekNumber,
    phase: w.phase,
    days: w.days.map((d) => ({ day: d.day, title: d.title, objective: d.objective })),
  }));
}

function parseObjectives(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    // Not JSON — maybe newline/comma separated text.
    return raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

/** Generate + persist a course-aligned timeline for an approved project. */
export async function generateProjectTimeline(
  project: TimelineProjectFields,
  options: { tasksPerWeek?: number } = {},
): Promise<TimelineResult> {
  const tasksPerWeek = Math.min(Math.max(options.tasksPerWeek ?? 5, 1), 10);
  const weeksRequested = Math.min(Math.max(project.durationWeeks ?? 4, 2), 26);

  if (!project.courseId) {
    return { ok: false, weeksCreated: 0, tasksCreated: 0, weeksRequested, error: "This project is not linked to a course." };
  }

  const outline = await loadCourseOutline(project.courseId);
  if (!outline || outline.length === 0) {
    return { ok: false, weeksCreated: 0, tasksCreated: 0, weeksRequested, error: "This course has no daily outline yet — ask your instructor to add one." };
  }
  const courseTotalWeeks = outline.length;

  // Map project weeks onto course weeks (wrap when project > course).
  const alignment = Array.from({ length: weeksRequested }, (_, i) => ({
    projectWeek: i + 1,
    courseWeek: ((i) % courseTotalWeeks) + 1,
  }));

  const courseContext = alignment
    .map(({ projectWeek, courseWeek }) => {
      const week = outline.find((w) => w.week === courseWeek);
      if (!week) return `PROJECT WEEK ${projectWeek}: (no course week found)`;
      const days = week.days.length
        ? week.days.map((d) => `  Day ${d.day}: ${d.title} — Objective: ${d.objective || "(none)"}`).join("\n")
        : "  (no daily topics)";
      return `PROJECT WEEK ${projectWeek} (aligns with COURSE WEEK ${courseWeek}: ${week.phase})\n${days}`;
    })
    .join("\n\n");

  const objectives = parseObjectives(project.objectives);
  const projectContext = [
    `Project Name: ${project.title}`,
    project.goal ? `Goal: ${project.goal}` : "",
    project.stack ? `Tech/Stack: ${project.stack}` : "",
    project.currentState ? `Current state: ${project.currentState}` : "",
    project.description ? `Proposal: ${project.description}` : "",
    objectives.length ? `Objectives:\n${objectives.map((o) => ` - ${o}`).join("\n")}` : "",
    `Duration: ${weeksRequested} weeks`,
  ].filter(Boolean).join("\n");

  // 1 ── AI generation (feature "project-timeline" — AI-limit exempt)
  let weeks: TimelineWeekInput[] = [];
  let tasks: TimelineTaskInput[] = [];
  try {
    const result = await callAI(
      [
        {
          role: "system",
          content:
            "You are a senior capstone project mentor. You create week-by-week project plans plus per-day tasks that ALIGN with the student's course curriculum. Each task must build on what the student is LEARNING that day AND move their specific project forward. Return ONLY valid JSON — no markdown, no prose.",
        },
        {
          role: "user",
          content: `Create a ${weeksRequested}-week project timeline with ${tasksPerWeek} tasks per week (${weeksRequested * tasksPerWeek} tasks total).

=== STUDENT'S PROJECT ===
${projectContext}

=== COURSE OUTLINE (project weeks align with these course weeks) ===
${courseContext}

=== REQUIREMENTS ===
For EACH project week generate:
1. A week plan: title, summary (1-2 sentences), 1-3 milestone strings
2. ${tasksPerWeek} tasks, one per day (day 1-5)

Each task MUST:
- Be specific to THIS project ("${project.title}") — use the project name and features
- Be actionable in 2-4 hours by a beginner
- BUILD ON the course topic for that day (reference the course concept)
- Have a clear deliverable (not vague like "research" or "plan")
- Include a "courseTopicLink" — a short note connecting the task to that day's course topic

Mark isMilestone=true for key deliverables (max 1-2 per week).

Return ONLY this JSON shape:
{
  "weeks": [
    { "week": 1, "title": "Week 1: ...", "summary": "...", "milestones": ["..."] }
  ],
  "tasks": [
    { "week": 1, "day": 1, "description": "...", "isMilestone": false, "courseTopicLink": "..." }
  ]
}`,
        },
      ],
      { temperature: 0.6, maxTokens: 3500, feature: "project-timeline" },
    );

    const raw = result.text || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI did not return JSON");
    const parsed = JSON.parse(jsonMatch[0]) as {
      weeks?: TimelineWeekInput[];
      tasks?: TimelineTaskInput[];
    };
    weeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];
    tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    if (tasks.length < weeksRequested * tasksPerWeek * 0.5) {
      throw new Error(`AI generated too few tasks (${tasks.length} of ${weeksRequested * tasksPerWeek})`);
    }
  } catch (err) {
    logger.warn("Project timeline AI generation failed — using deterministic fallback", {
      projectId: project.id,
      error: err instanceof Error ? err.message : String(err),
    });
    const fallback = buildFallbackTimeline(project.title, alignment, outline, weeksRequested, tasksPerWeek);
    weeks = fallback.weeks;
    tasks = fallback.tasks;
  }

  // 2 ── Sanitize (weeks deduped by weekNumber — the AI occasionally
  // repeats a week, which would violate the unique index).
  const seenWeeks = new Set<number>();
  const sanitizedWeeks = weeks
    .slice(0, weeksRequested)
    .map((w) => ({
      weekNumber: Math.min(Math.max(Number(w.week) || 1, 1), weeksRequested),
      title: String(w.title || `Week ${w.week}`).trim().slice(0, 200),
      summary: String(w.summary || "").trim().slice(0, 500),
      milestones: JSON.stringify(
        Array.isArray(w.milestones) ? w.milestones.map((m) => String(m).slice(0, 200)).filter(Boolean).slice(0, 3) : [],
      ),
    }))
    .filter((w) => {
      if (seenWeeks.has(w.weekNumber) || w.title.length === 0) return false;
      seenWeeks.add(w.weekNumber);
      return true;
    });

  const sanitizedTasks = tasks
    .slice(0, weeksRequested * tasksPerWeek)
    .map((t) => ({
      week: Math.min(Math.max(Number(t.week) || 1, 1), weeksRequested),
      day: Math.min(Math.max(Number(t.day) || 1, 1), 5),
      description: String(t.description || "").trim().slice(0, 300),
      isMilestone: !!t.isMilestone,
      courseTopicLink: String(t.courseTopicLink || "").trim().slice(0, 200),
    }))
    .filter((t) => t.description.length > 0);

  if (sanitizedTasks.length === 0) {
    return {
      ok: false,
      weeksCreated: 0,
      tasksCreated: 0,
      weeksRequested,
      error: "AI failed to generate usable tasks. Please try again.",
    };
  }

  // 3 ── Persist (replace this project's previous timeline atomically)
  try {
    await db.$transaction(async (tx) => {
      await tx.projectTask.deleteMany({ where: { projectId: project.id } });
      await tx.projectWeek.deleteMany({ where: { projectId: project.id } });
      await tx.projectWeek.createMany({
        data: sanitizedWeeks.map((w) => ({
          userId: project.userId,
          courseId: project.courseId,
          projectId: project.id,
          weekNumber: w.weekNumber,
          title: w.title,
          summary: w.summary,
          milestones: w.milestones,
        })),
      });
      await tx.projectTask.createMany({
        data: sanitizedTasks.map((t) => ({
          userId: project.userId,
          courseId: project.courseId,
          projectId: project.id,
          description: t.description,
          status: "planned",
          week: t.week,
          day: t.day,
          isMilestone: t.isMilestone,
          taskNotes: t.courseTopicLink || null,
        })),
      });
    });
  } catch (err) {
    logger.error("Failed to persist project timeline", {
      projectId: project.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      weeksCreated: 0,
      tasksCreated: 0,
      weeksRequested,
      error: "Failed to save the generated timeline. Please try again.",
    };
  }

  return {
    ok: true,
    weeksCreated: sanitizedWeeks.length,
    tasksCreated: sanitizedTasks.length,
    weeksRequested,
  };
}

/** Deterministic, outline-aligned fallback — no AI required. */
function buildFallbackTimeline(
  projectTitle: string,
  alignment: { projectWeek: number; courseWeek: number }[],
  outline: CourseOutlineWeek[],
  weeksRequested: number,
  tasksPerWeek: number,
): { weeks: TimelineWeekInput[]; tasks: TimelineTaskInput[] } {
  const phaseLabels = ["Setup & Planning", "Core Build", "Integration", "Polish & Deploy"];
  const weeks: TimelineWeekInput[] = [];
  const tasks: TimelineTaskInput[] = [];

  for (const { projectWeek, courseWeek } of alignment) {
    const courseWeekData = outline.find((w) => w.week === courseWeek);
    const phaseLabel = phaseLabels[(projectWeek - 1) % phaseLabels.length];
    weeks.push({
      week: projectWeek,
      title: `Week ${projectWeek}: ${phaseLabel}${courseWeekData ? ` — ${courseWeekData.phase}` : ""}`,
      summary: `Apply this week's course concepts to move your "${projectTitle}" project forward with a concrete deliverable.`,
      milestones:
        projectWeek === weeksRequested
          ? [`"${projectTitle}" complete and ready to present`]
          : [`Week ${projectWeek} deliverable for "${projectTitle}"`],
    });
    const dayCount = Math.min(tasksPerWeek, 5);
    for (let d = 1; d <= dayCount; d++) {
      const topic = courseWeekData?.days[d - 1];
      const topicTitle = topic?.title || `Day ${d} concept`;
      tasks.push({
        week: projectWeek,
        day: d,
        description: topic
          ? `Apply "${topicTitle}" to "${projectTitle}" — implement, document, or extend the relevant feature.`
          : `Work on "${projectTitle}" — apply this week's course concepts to advance your project.`,
        isMilestone: d === dayCount,
        courseTopicLink: `Builds on course topic: ${topicTitle}`,
      });
    }
  }
  return { weeks, tasks };
}
