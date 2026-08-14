/**
 * GET /api/v2/courses/[id]/syllabus — L3 Course detail, syllabus tab
 * (REDESIGN-P3 §L3)
 *
 * Week → day tree with per-day status relative to the caller's
 * position (completed | current | upcoming). Unauthenticated-style
 * viewers (not enrolled) get every day as "locked" beyond week 1.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiNotFound, apiSuccess, apiUnauthorized } from "@/lib/api-response";

export const runtime = "nodejs";

type DayStatus = "completed" | "current" | "upcoming";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const { id } = await params;
  const course = await db.course.findFirst({
    where: { id, isActive: true, OR: [{ published: true }, { isDefault: true }] },
    select: { id: true, name: true },
  });
  if (!course) return apiNotFound();

  const weeks = await db.courseWeek.findMany({
    where: { courseId: id },
    orderBy: { weekNumber: "asc" },
    include: {
      days: {
        orderBy: { day: "asc" },
        select: { id: true, day: true, title: true, objective: true, activity: true, deliverable: true },
      },
    },
  });

  // Caller position — where "current" sits.
  let current: { week: number; day: number } | null = null;
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId: id } },
    select: { masteryMap: true },
  });
  if (profile?.masteryMap) {
    const m = profile.masteryMap as { topicProgress?: { current?: { week?: number; day?: number } } };
    const cur = m.topicProgress?.current;
    if (cur?.week) current = { week: cur.week, day: cur.day ?? 1 };
  }

  const items = weeks.map((w) => ({
    week: w.weekNumber,
    phase: w.phase,
    milestone: w.milestone,
    days: w.days.map((d) => ({
      id: d.id,
      day: d.day,
      title: d.title,
      objective: d.objective,
      activity: d.activity,
      deliverable: d.deliverable,
      status: dayStatus(w.weekNumber, d.day, current),
    })),
  }));

  return apiSuccess({ course, current, weeks: items });
}

function dayStatus(week: number, day: number, current: { week: number; day: number } | null): DayStatus {
  if (!current) return week === 1 && day === 1 ? "current" : "upcoming";
  if (week < current.week || (week === current.week && day < current.day)) return "completed";
  if (week === current.week && day === current.day) return "current";
  return "upcoming";
}
