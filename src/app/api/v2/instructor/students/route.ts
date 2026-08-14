/**
 * GET /api/v2/instructor/students — I5 Students roster (REDESIGN-P4 §2 I5, W6)
 *
 * Instructor-scoped roster: students enrolled in the courses they teach,
 * enriched with engagement signals (last check-in, latest test, project
 * progress) rolled into an attention score + reasons. The v1 /api/stats
 * instructor branch only returns aggregates — this is the roster the I5
 * screen needs, on the v2 envelope.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPortalEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const INSTRUCTOR_ROLES = new Set(["instructor", "org_admin"]);

interface RosterRow {
  id: string;
  name: string;
  email: string;
  progress: number;
  attentionScore: number;
  attentionReasons: string[];
  latestScore: number | null;
  lastCheckIn: string | null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!INSTRUCTOR_ROLES.has(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const riskOnly = url.searchParams.get("risk") === "1";

  // Courses the instructor teaches (same scope as reviewQueue).
  const enrollments = await db.courseEnrollment.findMany({
    where: { userId: user.sub, role: "instructor" },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  if (courseIds.length === 0) return apiSuccess({ items: [], total: 0 });

  // Students of those courses (deduped).
  const studentEnrollments = await db.courseEnrollment.findMany({
    where: { courseId: { in: courseIds }, role: "student" },
    select: { userId: true },
  });
  const studentIds = [...new Set(studentEnrollments.map((e) => e.userId))];
  if (studentIds.length === 0) return apiSuccess({ items: [], total: 0 });

  const [students, weeklyTests, dailyLogs, tasks] = await Promise.all([
    db.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    db.weeklyTest.findMany({
      where: { userId: { in: studentIds }, courseId: { in: courseIds } },
      select: { userId: true, week: true, score: true, status: true },
    }),
    db.dailyLog.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, date: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    db.projectTask.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, status: true },
    }),
  ]);

  // Enrichment: attention score (mirrors the v1 /api/stats rules).
  const lastLogByUser = new Map<string, Date>();
  for (const l of dailyLogs) {
    if (!lastLogByUser.has(l.userId)) lastLogByUser.set(l.userId, l.date);
  }
  const testsByUser = new Map<string, { week: number; score: number | null; status: string }[]>();
  for (const t of weeklyTests) {
    const list = testsByUser.get(t.userId) ?? [];
    list.push(t);
    testsByUser.set(t.userId, list);
  }
  const tasksByUser = new Map<string, { status: string }[]>();
  for (const t of tasks) {
    const list = tasksByUser.get(t.userId) ?? [];
    list.push(t);
    tasksByUser.set(t.userId, list);
  }

  const items: RosterRow[] = students.map((s) => {
    const attentionReasons: string[] = [];
    let attentionScore = 0;

    const lastLog = lastLogByUser.get(s.id);
    if (lastLog) {
      const days = Math.floor((Date.now() - new Date(lastLog).getTime()) / 86_400_000);
      if (days >= 3) {
        attentionScore += 30;
        attentionReasons.push(`Inactive ${days} days`);
      } else if (days >= 2) {
        attentionScore += 15;
        attentionReasons.push(`Inactive ${days} days`);
      }
    }

    const tests = (testsByUser.get(s.id) ?? []).filter((t) => t.score !== null);
    const latest = tests[tests.length - 1];
    if (latest && latest.score !== null && latest.score < 60) {
      attentionScore += 25;
      attentionReasons.push(`Last test ${latest.score}%`);
    }

    const userTasks = tasksByUser.get(s.id) ?? [];
    const done = userTasks.filter((t) => t.status === "completed").length;
    const progress = userTasks.length > 0 ? Math.round((done / userTasks.length) * 100) : 0;

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      progress,
      attentionScore,
      attentionReasons,
      latestScore: latest?.score ?? null,
      lastCheckIn: lastLog?.toISOString() ?? null,
    };
  });

  const filtered = items.filter((i) => {
    if (riskOnly && i.attentionScore < 30) return false;
    if (q && !i.name.toLowerCase().includes(q) && !i.email.toLowerCase().includes(q)) return false;
    return true;
  });

  return apiSuccess({ items: filtered, total: items.length });
}
