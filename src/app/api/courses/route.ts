import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { WEEKLY_TOPICS } from "@/lib/course-topics";
import { validateCourseName, validateCourseWeeks } from "@/lib/course-validation";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * Normalize AI-generated course data before validation.
 *
 * The AI doesn't always return perfectly-typed JSON:
 * - weekNumber/day might be strings ("1") instead of numbers (1)
 * - Some weeks might have no `days` array
 * - Phase might be empty or missing
 * - Title might be empty for some days
 * - resources might be missing or malformed
 *
 * This function coerces types + fills in defaults so the AI output
 * always passes validation. Without this, validateCourseWeeks rejects
 * the entire course and the user sees nothing (the error auto-dismissed
 * after 4 seconds in the old UI).
 */
function normalizeAiCourseData(raw: unknown): unknown[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return undefined;

  return raw.map((w, weekIdx) => {
    if (!w || typeof w !== "object") return { weekNumber: weekIdx + 1, phase: `Week ${weekIdx + 1}`, days: [] };
    const week = w as Record<string, unknown>;

    // Coerce weekNumber to a positive integer
    let weekNumber = Number(week.weekNumber);
    if (!Number.isInteger(weekNumber) || weekNumber < 1) weekNumber = weekIdx + 1;

    // Ensure phase is a non-empty string
    let phase = typeof week.phase === "string" ? week.phase.trim() : "";
    if (!phase) phase = `Week ${weekNumber}`;

    // Ensure milestone is a string
    const milestone = typeof week.milestone === "string" ? week.milestone : "";

    // Normalize days array
    let days: unknown[] = [];
    if (Array.isArray(week.days)) {
      days = week.days.map((d, dayIdx) => {
        if (!d || typeof d !== "object") return { day: dayIdx + 1, title: `Day ${dayIdx + 1}` };
        const day = d as Record<string, unknown>;

        // Coerce day to a positive integer
        let dayNum = Number(day.day);
        if (!Number.isInteger(dayNum) || dayNum < 1) dayNum = dayIdx + 1;

        // Ensure title is a non-empty string
        let title = typeof day.title === "string" ? day.title.trim() : "";
        if (!title) title = `Day ${dayNum}`;

        return {
          ...day,
          day: dayNum,
          title,
          objective: typeof day.objective === "string" ? day.objective : "",
          whyItMatters: typeof day.whyItMatters === "string" ? day.whyItMatters : "",
          topicsCovered: Array.isArray(day.topicsCovered) ? day.topicsCovered : [],
          activity: typeof day.activity === "string" ? day.activity : "",
          deliverable: typeof day.deliverable === "string" ? day.deliverable : "",
          resources: Array.isArray(day.resources) ? day.resources : [],
        };
      });
    }

    // If no days were generated, create at least 1 placeholder so validation passes
    if (days.length === 0) {
      days = [{ day: 1, title: `Day 1`, objective: "", resources: [] }];
    }

    return { ...week, weekNumber, phase, milestone, days };
  });
}

/** GET /api/courses — list all courses (admin/instructor only). */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const courses = await db.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        select: { id: true, weekNumber: true, phase: true, milestone: true, _count: { select: { days: true } } },
      },
    },
  });

  // Transform to match the client-side Course interface
  const enrichedCourses = courses.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    domain: c.domain,
    level: c.level,
    assessmentType: c.assessmentType,
    subjects: (() => { try { return JSON.parse(c.subjects || "[]"); } catch { return []; } })(),
    projectEnabled: c.projectEnabled,
    projectRequired: c.projectRequired,
    projectDefaultDurationWeeks: c.projectDefaultDurationWeeks,
    isDefault: c.isDefault,
    weeks: c.weeks.map(w => ({
      id: w.id,
      weekNumber: w.weekNumber,
      phase: w.phase,
      milestone: w.milestone,
      days: [], // Don't load all days for the list view — only when viewing detail
      dayCount: w._count.days,
    })),
  }));

  return NextResponse.json({ courses: enrichedCourses });
}

/** POST /api/courses — create a new course.
 *  Body: { name, description?, weeks?: [{ weekNumber, phase, milestone?, days: [{ day, title, objective?, whyItMatters?, topicsCovered?, activity?, deliverable?, resources? }] }] }
 *  If no weeks provided, creates an empty course.
 *
 *  Persisted per-day fields (matches Prisma CourseDay model):
 *    - day, title, objective
 *    - whyItMatters (real-world relevance)
 *    - topicsCovered (JSON string[])
 *    - activity (hands-on task for today)
 *    - deliverable (what to submit)
 *    - resources (JSON [{label, url}])
 *
 *  Unknown fields in the body are silently ignored — the AI generate
 *  endpoint may include extra fields (projectActivity, githubCommit,
 *  domain, level, etc.) that don't map to the CourseDay model.
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("creating courses"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, description, weeks: rawWeeks, domain, level, assessmentType, toolsUsed, deliverableTypes, subjects, projectEnabled, projectRequired, projectDefaultDurationWeeks } = body as {
    name?: string;
    description?: string;
    weeks?: unknown;
    domain?: string;
    level?: string;
    assessmentType?: string;
    toolsUsed?: string[];
    deliverableTypes?: string[];
    subjects?: string[];
    projectEnabled?: boolean;
    projectRequired?: boolean;
    projectDefaultDurationWeeks?: number;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const nameValidation = validateCourseName(name);
  if (!nameValidation.ok) {
    return NextResponse.json({ error: nameValidation.error || "Invalid course name" }, { status: 400 });
  }

  // Project config validation:
  // - projectEnabled can only be true if the course has >= 4 weeks.
  // - projectDefaultDurationWeeks must be 2..(weeks-1) when set.
  const normalizedWeeks = normalizeAiCourseData(rawWeeks);
  const weekCount = normalizedWeeks?.length ?? 0;
  const finalProjectEnabled = projectEnabled === true && weekCount >= 4;
  if (projectEnabled === true && weekCount < 4) {
    return NextResponse.json(
      { error: `Projects cannot be enabled for courses shorter than 4 weeks (this course has ${weekCount} week${weekCount === 1 ? "" : "s"}).` },
      { status: 400 }
    );
  }
  const finalProjectDuration = (() => {
    const w = Number(projectDefaultDurationWeeks);
    if (!Number.isInteger(w)) return 4;
    const maxAllowed = Math.max(2, weekCount - 1);
    return Math.min(Math.max(w, 2), maxAllowed);
  })();

  // Scale Tier 2: normalize subjects to JSON string
  const subjectsJson = subjects && Array.isArray(subjects) ? JSON.stringify(subjects) : "[]";

  // Phase fix: Normalize AI-generated course data before validation.
  // The AI sometimes returns weekNumber/day as strings ("1" instead of 1),
  // omits the days array for some weeks, or returns empty phase strings.
  // Without normalization, validateCourseWeeks rejects the entire course
  // and the user sees nothing (the error auto-dismissed after 4 seconds).
  // This function coerces types + fills in defaults so the AI output
  // always passes validation.
  const weeks = normalizedWeeks;

  // Validate weeks/days structure if provided
  if (weeks !== undefined) {
    const v = validateCourseWeeks(weeks);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
  }

  // Create course + weeks + days in a transaction.
  // Persist ALL fields the AI generates (or the user fills in) — the old
  // version silently dropped whyItMatters, topicsCovered, activity, deliverable
  // which made AI-generated courses look empty in the detail view.
  const course = await db.course.create({
    data: {
      name: name.trim(),
      description: description?.trim() || "",
      ...(domain ? { domain } : {}),
      ...(level ? { level } : {}),
      ...(assessmentType ? { assessmentType } : {}),
      ...(toolsUsed ? { toolsUsed: JSON.stringify(toolsUsed) } : {}),
      ...(deliverableTypes ? { deliverableTypes: JSON.stringify(deliverableTypes) } : {}),
      // Scale Tier 2: persist subjects
      subjects: subjectsJson,
      // Project config — validated above (weekCount >= 4 enforced for projectEnabled)
      projectEnabled: finalProjectEnabled,
      projectRequired: finalProjectEnabled && projectRequired === true,
      projectDefaultDurationWeeks: finalProjectDuration,
      weeks: weeks?.length
        ? {
            create: (weeks as Array<{
              weekNumber: number; phase: string; milestone?: string;
              days: Array<{
                day: number; title: string; objective?: string;
                whyItMatters?: string; topicsCovered?: string[];
                activity?: string; deliverable?: string;
                resources?: { label: string; url: string }[];
              }>;
            }>).map((w) => ({
              weekNumber: w.weekNumber,
              phase: w.phase,
              milestone: w.milestone || "",
              days: {
                create: (w.days || []).map((d) => ({
                  day: d.day,
                  title: d.title,
                  objective: d.objective || "",
                  whyItMatters: d.whyItMatters || "",
                  topicsCovered: JSON.stringify(d.topicsCovered || []),
                  activity: d.activity || "",
                  deliverable: d.deliverable || "",
                  resources: JSON.stringify(d.resources || []),
                })),
              },
            }))
          }
        : undefined,
    },
  });

  return NextResponse.json({ course });
}
