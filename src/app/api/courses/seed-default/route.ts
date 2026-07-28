import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { WEEKLY_TOPICS } from "@/lib/course-topics";
import { demoWriteBlock } from "@/lib/demo-guard";
import {
  DEFAULT_TEST_CONFIG,
  DEFAULT_REPORT_CARD_TEMPLATE,
  DEFAULT_PROJECT_TEMPLATE,
  DEFAULT_JOURNEY_STEPS,
  DEFAULT_AI_PROMPTS,
} from "@/lib/course-defaults";

/** POST /api/courses/seed-default — creates the default 6-week bootcamp course
 *  from course-defaults.ts + course-topics.ts. ALL configs are seeded.
 *  Idempotent — if a course with the same name exists, returns it.
 *
 *  The seeded course is marked isDefault=true (unsetting isDefault on any other
 *  course). */
export async function POST() {
  const _demoBlock = await demoWriteBlock("seeding courses"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const courseName = "Modern Web Dev & AI Bootcamp (Default)";

  // Check if it already exists
  const existing = await db.course.findUnique({ where: { name: courseName } });

  if (existing) {
    // Idempotent: if it exists but isn't already the default, mark it as default
    // and link to the course. This way, calling seed-default on an existing
    // installation brings it up to date with the isDefault marking.
    if (!existing.isDefault) {
      await db.$transaction(async (tx) => {
        // Unset isDefault on all other courses
        await tx.course.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        await tx.course.update({ where: { id: existing.id }, data: { isDefault: true } });
      });
    }
    // Re-fetch with weeks included for the response
    const course = await db.course.findUnique({
      where: { id: existing.id },
      include: { weeks: { include: { days: true } } },
    });
    if (!course) {
      return NextResponse.json({ error: "Course disappeared during seed" }, { status: 500 });
    }

    return NextResponse.json({
      course,
      message: "Default course already exists. Marked as default.",
    });
  }

  // Create the course with ALL config fields seeded
  const course = await db.course.create({
    data: {
      name: courseName,
      domain: "technology",
      level: "beginner",
      assessmentType: "socratic",
      description: "The default 6-week Modern Web Development & AI Bootcamp curriculum.",
      journeyStepsJson: JSON.stringify(DEFAULT_JOURNEY_STEPS),
      projectTemplateJson: JSON.stringify(DEFAULT_PROJECT_TEMPLATE),
      aiPromptsJson: JSON.stringify(DEFAULT_AI_PROMPTS),
      testConfigJson: JSON.stringify(DEFAULT_TEST_CONFIG),
      reportCardTemplateJson: JSON.stringify(DEFAULT_REPORT_CARD_TEMPLATE),
      // Mark as the default course (unsets isDefault on all others in a transaction)
      isDefault: true,
      weeks: {
        create: WEEKLY_TOPICS.map((wt) => ({
          weekNumber: wt.week,
          phase: wt.phase,
          milestone: "",
          days: {
            create: wt.topics.map((t, i) => ({
              day: i + 1,
              title: t.title,
              objective: t.objective,
              resources: JSON.stringify(t.resources),
            })),
          },
        })),
      },
    },
    include: { weeks: { include: { days: true } } },
  });

  // Unset isDefault on all other courses (the create above set it on this one;
  // we need to clear it on any pre-existing defaults)
  await db.course.updateMany({
    where: { isDefault: true, id: { not: course.id } },
    data: { isDefault: false },
  });

  return NextResponse.json({
    course,
    message: `Default course created with ${course.weeks.length} weeks, ${course.weeks.reduce((acc, w) => acc + w.days.length, 0)} days, and ALL configs (journey steps, project template, AI prompts, test config, report card template). Marked as default.`,
  });
}


