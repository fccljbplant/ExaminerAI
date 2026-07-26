import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { generateCourseAlignedPlan } from "@/modules/project/lib/course-aligned-planner";

/** POST /api/project/generate-tasks — AI generates a course-aligned project plan + daily tasks.
 *
 *  Body options:
 *  - { weeks?: number } — override projectDurationWeeks (default: from user record)
 *  - { tasksPerWeek?: number } — tasks per week (default 5, max 10)
 *  - { replace?: boolean } — if true, deletes ALL existing tasks + weeks first (default false)
 *
 *  This endpoint uses the NEW course-aligned planner, which:
 *  1. Loads the student's course outline (weeks + daily topics + objectives)
 *  2. Aligns each project week with a course week (1:1 when project <= course)
 *  3. Asks the AI to generate per-day project tasks that BUILD ON the course
 *     topic for that day AND move the student's specific project forward
 *  4. Saves both ProjectWeek (title/summary/milestones) + ProjectTask (with
 *     day column set so they show up in the daily reminder + check-in)
 *
 *  The `day` column on ProjectTask is the sync point: when the student is on
 *  course week 3, day 2, the Daily Task Reminder + Check-in panel show BOTH
 *  today's course daily topic AND today's project task in one coherent view.
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("generating project tasks"); if (_demoBlock) return _demoBlock;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const result = await generateCourseAlignedPlan(user.id, {
    weeks: body.weeks,
    tasksPerWeek: body.tasksPerWeek,
    replace: body.replace === true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    tasksCreated: result.tasksCreated,
    weeksGenerated: result.weeksGenerated,
    weeksCovered: result.weeksRequested,
    message: `Generated ${result.tasksCreated} course-aligned project tasks across ${result.weeksRequested} week${result.weeksRequested === 1 ? "" : "s"}. Each task is paired with a course daily topic — view them in the Project tab.`,
  });
}
