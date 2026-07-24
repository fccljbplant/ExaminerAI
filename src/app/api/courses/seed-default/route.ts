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
 *  Idempotent — if a course with the same name exists, returns it. */
export async function POST() {
  const _demoBlock = await demoWriteBlock("seeding courses"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const courseName = "Modern Web Dev & AI Bootcamp (Default)";
  // M9-fix: idempotency by name — if admin renames the default course,
  // the next seed creates a duplicate. TODO: add isDefault flag to Course model.

  // Check if it already exists
  const existing = await db.course.findUnique({ where: { name: courseName } });
  if (existing) {
    return NextResponse.json({ course: existing, message: "Default course already exists." });
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

  return NextResponse.json({
    course,
    message: `Default course created with ${course.weeks.length} weeks, ${course.weeks.reduce((acc, w) => acc + w.days.length, 0)} days, and ALL configs (journey steps, project template, AI prompts, test config, report card template).`,
  });
}
