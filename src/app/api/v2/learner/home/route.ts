/**
 * GET /api/v2/learner/home — L1 Home aggregation (REDESIGN-P3 §L1)
 *
 * One request feeds the whole home fold: continue card, learner
 * totals, due-today list and announcements. Fields-selected, no
 * nested entities the page doesn't render.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { getTodayTopic } from "@/modules/learn/lib/today-topic";
import { getLearnerLevel } from "@/modules/learn/lib/xp-ledger";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  // CourseEnrollment is the source of truth for access and course count.
  // LearnProfile is progress data only: it may be absent for a new learner
  // or remain after an enrolment is removed, so it must never define access.
  let enrollments: { courseId: string; course: { id: string; name: string } }[];
  try {
    enrollments = await db.courseEnrollment.findMany({
      where: { userId: user.sub, role: "student" },
      include: { course: { select: { id: true, name: true } } },
      orderBy: { enrolledAt: "desc" },
    });
  } catch (e) {
    console.error("Learner home enrollment lookup failed:", e);
    return apiError(
      "Your dashboard is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }

  const enrolledCourseIds = enrollments.map((enrollment) => enrollment.courseId);
  let profiles: any[];
  try {
    profiles = enrolledCourseIds.length
      ? await db.learnProfile.findMany({
          where: { userId: user.sub, courseId: { in: enrolledCourseIds } },
          include: { course: { select: { id: true, name: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : [];
  } catch (e) {
    console.error("Learner home profile lookup failed:", e);
    return apiError(
      "Your dashboard is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }

  /* ---- continue card: most recently active course ---- */
  let continueCard: {
    courseId: string;
    courseName: string;
    nextLesson: string;
    kind: "start" | "learn" | "review" | "done";
    href: string;
  } | null = null;

  const mostRecentlyActiveProfile = profiles[0];
  if (mostRecentlyActiveProfile) {
    const p = mostRecentlyActiveProfile;
    const today = await getTodayTopic(user.sub, p.courseId);
    continueCard = today
      ? {
          courseId: p.courseId,
          courseName: p.course.name,
          nextLesson: `Week ${today.topic.week} · Day ${today.topic.day} — ${today.topic.title}`,
          kind: today.completed ? "review" : "learn",
          href: `/learn/${p.courseId}`,
        }
      : {
          courseId: p.courseId,
          courseName: p.course.name,
          nextLesson: "Course complete — revisit any topic",
          kind: "done",
          href: `/learn/${p.courseId}`,
        };
  } else if (enrollments[0]) {
    // A newly enrolled learner may not have a LearnProfile yet. Offer a
    // truthful start action instead of treating the missing profile as done.
    const enrollment = enrollments[0];
    continueCard = {
      courseId: enrollment.courseId,
      courseName: enrollment.course.name,
      nextLesson: "Start your first study session",
      kind: "start",
      href: `/learn/${enrollment.courseId}`,
    };
  }

  /* ---- due today: uncompleted daily tests ---- */
  const todayKey = new Date();
  todayKey.setHours(0, 0, 0, 0);
  const dailyTests = enrolledCourseIds.length
    ? await db.learnDailyTest.findMany({
        where: {
          userId: user.sub,
          courseId: { in: enrolledCourseIds },
          date: todayKey,
          status: { not: "completed" },
        },
        include: { course: { select: { name: true } } },
      })
    : [];
  const dueToday = dailyTests.map((t) => ({
    id: t.id,
    kind: "daily-test" as const,
    title: "Daily check-in",
    meta: t.course.name,
    href: `/learn/${t.courseId}`,
  }));

  /* ---- announcements ---- */
  const announcements = await db.notification.findMany({
    where: { userId: user.sub },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, type: true, title: true, body: true, link: true, read: true, createdAt: true },
  });

  /* ---- projects (v2 flow) — recent LearnProjects with status + task rollup ---- */
  let projects: {
    id: string;
    title: string;
    status: string;
    courseName: string | null;
    taskProgress: number;
    tasksDone: string;
  }[] = [];
  try {
    const rows = await db.learnProject.findMany({
      // Keep course-linked project cards inside the learner's current
      // enrolments. Preserve explicitly course-less personal projects.
      where: {
        userId: user.sub,
        OR: [
          { courseId: { in: enrolledCourseIds } },
          { courseId: null },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { tasks: { select: { id: true, status: true } } },
    });
    const courseRows = await db.course.findMany({
      where: { id: { in: rows.map((p) => p.courseId).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    });
    const courseNames = new Map(courseRows.map((c) => [c.id, c.name]));
    projects = rows.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "completed").length;
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        courseName: p.courseId ? courseNames.get(p.courseId) ?? null : null,
        taskProgress: total > 0 ? Math.round((done / total) * 100) : 0,
        tasksDone: `${done}/${total}`,
      };
    });
  } catch (e) {
    console.error("Learner home project lookup failed:", e);
    return apiError(
      "Your dashboard is temporarily unavailable. Please try again.",
      "SERVICE_UNAVAILABLE",
      503,
    );
  }

  /* ---- learner totals across courses ---- */
  const totalXP = profiles.reduce((sum, p) => sum + p.totalXP, 0);
  const streakCurrent = profiles.reduce((max, p) => Math.max(max, p.streakCurrent), 0);

  return apiSuccess({
    learner: {
      totalXP,
      level: getLearnerLevel(totalXP).name,
      streakCurrent,
      enrolledCount: enrollments.length,
    },
    continue: continueCard,
    dueToday,
    announcements,
    projects,
  });
}
