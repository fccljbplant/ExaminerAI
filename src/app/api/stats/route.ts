import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { getCourseProjectConfig } from "@/lib/course-db";
import { logger } from "@/lib/logger";

/** GET /api/stats — aggregated stats for the dashboard.
 *  - For students: their own progress, streak, weakest topic, etc.
 *  - For instructors/admins: course overview + counts.
 *  - For admin impersonating (via ?as=student|teacher|instructor): returns that role's stats. */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const asRole = url.searchParams.get("as"); // learner | instructor — for admin impersonation
  const role = (asRole === "learner" || asRole === "student" || asRole === "instructor") ? asRole : payload.role;

  // M4 fix (audit 2026-07-26): course_coordinator now has access to teacher
  // stats so they can see students in their institution's courses.
  // Post-purge 2026-08: org_admin also has access to instructor stats.
  if (role === "instructor" || role === "course_coordinator" || role === "org_admin" || (role === "platform_admin" && asRole === "instructor") || (role === "admin" && asRole === "instructor")) {
    // Scale: server-side pagination — don't load ALL students at once.
    // Default page size 100 (renders 4 pages of 25 in the UI). Max 200.
    const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10));
    const pageSize = Math.min(200, parseInt(url.searchParams.get("pageSize") || "100", 10));
    const skip = page * pageSize;
    // Search — filter by name or email (case-insensitive)
    const q = (url.searchParams.get("q") || "").trim();
    // Optional courseId filter — scope to a single course
    const courseIdFilter = url.searchParams.get("courseId");

    // Scope students to the instructor's courses via CourseEnrollment.
    // Course coordinators and admins see all students (no scope filter).
    const isAdminRole = hasRole(payload.role, ADMIN_ROLES);
    let scopedStudentIds: string[] | null = null;
    if (!isAdminRole && role === "instructor") {
      const enrollmentWhere: any = { userId: payload.sub, role: "instructor" };
      if (courseIdFilter) {
        enrollmentWhere.courseId = courseIdFilter;
      }
      const enrollments = await db.courseEnrollment.findMany({
        where: enrollmentWhere,
        select: { courseId: true },
      });
      const courseIds = enrollments.map(e => e.courseId);
      if (courseIds.length > 0) {
        const studentEnrollments = await db.courseEnrollment.findMany({
          where: { courseId: { in: courseIds }, role: "student" },
          select: { userId: true },
        });
        scopedStudentIds = [...new Set(studentEnrollments.map(e => e.userId))];
      } else {
        scopedStudentIds = [];
      }
    }
    const searchClause = q ? {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
      ],
    } : {};
    const studentWhere = { role: "student" as const, ...(scopedStudentIds !== null ? { id: { in: scopedStudentIds } } : {}), ...searchClause };

    const [students, pending, teachers, totalStudents] = await Promise.all([
      db.user.findMany({
        where: studentWhere,
        skip,
        take: pageSize,
        include: {
          dailyLogs: { select: { date: true, confidence: true }, orderBy: { date: "desc" }, take: 5 },
          weeklyTests: { where: { status: "completed" }, select: { week: true, score: true, completedAt: true }, orderBy: { week: "asc" } },
          tasks: { select: { status: true, week: true } },
          _count: { select: { interactions: true } },
        },
      }),
      db.user.count({ where: { role: "pending" } }),
      db.user.count({ where: { role: "instructor" } }),
      db.user.count({ where: studentWhere }),
    ]);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const testsThisWeek = students.reduce(
      (acc, s) => acc + s.weeklyTests.filter((t) => t.completedAt && t.completedAt >= weekStart).length,
      0
    );
    const enriched = students.map((s) => {
      const tasks = s.tasks;
      const completedTasks = tasks.filter((t) => t.status === "completed").length;
      const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
      const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
      const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
      const latestTest = s.weeklyTests[s.weeklyTests.length - 1];

      // Phase 3.1: Compute attention flags so the teacher dashboard can
      // sort students by who needs help most. This is a lightweight version
      // of computePsychTrend (in portfolio/route.ts) — runs for every student
      // in the batch list, so it must be fast.
      const attentionReasons: string[] = [];
      let attentionScore = 0; // higher = more attention needed

      // 1. Inactive for 2+ days (last daily log)
      const lastLog = s.dailyLogs[0]?.date;
      if (lastLog) {
        const daysSince = Math.floor((Date.now() - new Date(lastLog).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 3) {
          attentionScore += 30;
          attentionReasons.push(`Inactive for ${daysSince} days`);
        } else if (daysSince >= 2) {
          attentionScore += 15;
          attentionReasons.push(`Inactive for ${daysSince} days`);
        }
      } else if (tasks.length > 0) {
        // Has project but no daily logs at all
        attentionScore += 20;
        attentionReasons.push("Never checked in");
      }

      // 2. Low latest test score (< 60)
      if (latestTest?.score !== null && latestTest?.score !== undefined && latestTest.score < 60) {
        attentionScore += 25;
        attentionReasons.push(`Last test score: ${latestTest.score}%`);
      }

      // 3. Declining test scores (last 2 tests, dropped by 15+ points)
      if (s.weeklyTests.length >= 2) {
        const scores = s.weeklyTests.map(t => t.score).filter((sc): sc is number => sc !== null);
        if (scores.length >= 2) {
          const last = scores[scores.length - 1];
          const prev = scores[scores.length - 2];
          if (last < prev - 15) {
            attentionScore += 20;
            attentionReasons.push(`Score dropped ${prev}% → ${last}%`);
          }
        }
      }

      // 4. Sustained low confidence in recent daily logs (2+ of last 5 logs at confidence ≤ 2)
      const lowConfidenceLogs = s.dailyLogs.filter(l => l.confidence <= 2).length;
      if (lowConfidenceLogs >= 2) {
        attentionScore += 20;
        attentionReasons.push(`${lowConfidenceLogs} recent low-confidence check-ins`);
      }

      // 5. Blocked tasks (stuck on something)
      if (blockedTasks > 0) {
        attentionScore += 10;
        attentionReasons.push(`${blockedTasks} blocked task${blockedTasks === 1 ? "" : "s"}`);
      }

      return {
        id: s.id,
        email: s.email,
        name: s.name,
        currentWeek: s.currentWeek,
        currentDay: s.currentDay,
        selfPacedEnabled: s.selfPacedEnabled,
        progress,
        latestScore: latestTest?.score ?? null,
        interactions: s._count.interactions,
        lastActive: s.dailyLogs[0]?.date ?? null,
        // Project tracking fields
        hasProject: tasks.length > 0,
        taskCount: tasks.length,
        completedTasks,
        inProgressTasks,
        blockedTasks,
        // Phase 3.1: Attention flags for the batch dashboard
        attentionScore,
        attentionReasons,
        needsAttention: attentionScore >= 20,
      };
    });

    // Phase 3.1: Sort students by attention score (highest first) so the
    // teacher sees who needs help most at the top of the list.
    enriched.sort((a, b) => b.attentionScore - a.attentionScore);

    // D3 FIX: Compute batch-level aggregates from the FULL batch (not just
    // the paginated page). These are used by the teacher dashboard's stat
    // cards + batch analytics. Without this, averages would be wrong when
    // a batch crosses 100 students (only the first 100 would be counted).
    // We already have `totalStudents` from db.user.count() — now compute the
    // rest with separate count queries (fast, no joins needed).
    const [
      totalWithProjects,
      totalNeedingAttention,
      totalWithTests,
      totalActiveToday,
    ] = await Promise.all([
      db.user.count({ where: { ...studentWhere, tasks: { some: {} } } }),
      // Approximation: students with low scores or inactivity (can't easily
      // replicate the full attention-score logic in a count query, so we
      // use the enriched array for this one — it's a best-effort signal)
      Promise.resolve(enriched.filter(s => s.needsAttention).length),
      db.user.count({ where: { ...studentWhere, weeklyTests: { some: { status: "completed", score: { not: null } } } } }),
      db.user.count({
        where: {
          ...studentWhere,
          dailyLogs: { some: { date: { gte: new Date(new Date().toISOString().slice(0, 10)) } } },
        },
      }),
    ]);

    const studentsWithProjects = totalWithProjects;
    const studentsWithoutProjects = totalStudents - totalWithProjects;
    const studentsNeedingAttention = totalNeedingAttention;

    return NextResponse.json({
      role: "instructor",
      stats: {
        totalStudents,
        pendingApprovals: pending,
        totalTeachers: teachers,
        testsThisWeek,
        studentsWithProjects,
        studentsWithoutProjects,
        studentsNeedingAttention,
        // D3: server-side aggregates for the full batch (not just the page)
        totalWithTests,
        totalActiveToday,
        // Scale: pagination metadata
        page,
        pageSize,
        hasMore: skip + students.length < totalStudents,
        loadedCount: students.length,
      },
      students: enriched,
    });
  }

  // Learner (default) — return current user's progress data.
  // Admin can impersonate by passing ?as=learner (or legacy ?as=student) —
  // we then return the demo learner's data so they can test the dashboard
  // UI with real content. Post-purge 2026-08: guardian role was removed
  // (orphaned). Any guardian rows in the DB are treated as learners.
  let targetUserId = payload.sub;
  if (hasRole(payload.role, ADMIN_ROLES) && (asRole === "student" || asRole === "learner")) {
    const demoStudent = await db.user.findUnique({
      where: { email: "student@examiner.ai" },
    }).catch(() => null) || await db.user.findFirst({
      where: { role: { in: ["learner", "student"] } },
      select: { id: true },
    });
    if (demoStudent && "id" in demoStudent) targetUserId = demoStudent.id;
  }
  const courseId = req.nextUrl.searchParams.get("courseId") || undefined;
  if (courseId) {
    const enrollment = await db.courseEnrollment.findUnique({
      where: { userId_courseId_role: { userId: targetUserId, courseId, role: "student" } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in this course" }, { status: 403 });
    }
  }
  let statsData;
  if (courseId) {
    const [dailyLogs, tasks, projectWeeks, projectReports, interactions, weeklyTests, competencies, reportCards, comments] = await Promise.all([
      db.dailyLog.findMany({ where: { userId: targetUserId, courseId }, orderBy: { date: "asc" }, take: 100 }),
      db.projectTask.findMany({ where: { userId: targetUserId, courseId }, take: 200 }),
      db.projectWeek.findMany({ where: { userId: targetUserId, courseId }, take: 50 }),
      db.projectReport.findMany({ where: { userId: targetUserId, courseId }, take: 50 }),
      db.interaction.findMany({ where: { userId: targetUserId, courseId }, orderBy: { date: "desc" }, take: 500 }),
      db.weeklyTest.findMany({ where: { userId: targetUserId, courseId }, orderBy: { week: "asc" }, take: 50 }),
      db.competency.findMany({ where: { userId: targetUserId }, orderBy: { score: "asc" }, take: 100 }),
      db.reportCard.findMany({ where: { userId: targetUserId, courseId }, orderBy: { week: "asc" }, take: 50 }),
      db.comment.findMany({ where: { studentId: targetUserId }, orderBy: { createdAt: "desc" }, take: 100, include: { instructor: { select: { name: true, email: true } } } }),
    ]);
    const user = await db.user.findUnique({ where: { id: targetUserId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    statsData = { ...user, dailyLogs, tasks, projectWeeks, projectReports, interactions, weeklyTests, competencies, reportCards, commentsRecv: comments };
  } else {
    const user = await db.user.findUnique({
      where: { id: targetUserId },
      include: {
        dailyLogs: { orderBy: { date: "asc" }, take: 100 },
        tasks: { take: 200 },
        weeklyTests: { orderBy: { week: "asc" }, take: 50 },
        competencies: { orderBy: { score: "asc" }, take: 100 },
        reportCards: { orderBy: { week: "asc" }, take: 50 },
        interactions: { orderBy: { date: "desc" }, take: 500 },
        commentsRecv: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { instructor: { select: { name: true, email: true } } },
        },
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    statsData = user;
  }
  const user = statsData;

  // ---- Self-healing: fix stale weekly test statuses ----
  // Some tests were completed by the AI (score was set) but
  // the `status` field wasn't updated to "completed". Fix them here so the
  // Progress tab charts and Weekly Test Summary always reflect reality.
  const staleTests = user.weeklyTests.filter(
    (t) => t.score !== null && t.status !== "completed"
  );
  if (staleTests.length > 0) {
    try {
      await db.weeklyTest.updateMany({
        where: { id: { in: staleTests.map((t) => t.id) } },
        data: { status: "completed", completedAt: new Date() },
      });
      // Update the in-memory copies so the response reflects the fix
      for (const t of user.weeklyTests) {
        if (t.score !== null && t.status !== "completed") {
          t.status = "completed";
        }
      }
    } catch (err) {
      // M3-rel: log self-healing failures (was silent)
      logger.warn("stats self-healing failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  const currentWeek = user.currentWeek;
  const weekTasks = user.tasks.filter((t) => t.week === currentWeek);
  const completedTasks = weekTasks.filter((t) => t.status === "completed").length;
  const progress = weekTasks.length > 0 ? Math.round((completedTasks / weekTasks.length) * 100) : 0;

  // SDT rebalance: Replace fragile streak with rolling 14-day consistency
  // percentage. A missed day doesn't reset to zero — it's recoverable.
  // Research: the "what-the-hell effect" shows that broken streaks cause
  // people to give up entirely. A rolling percentage is both more honest
  // (a 90%-consistent student IS different from a 10%-consistent one)
  // and more motivating (recoverable, not all-or-nothing).
  // ME-10 fix: use UTC midnight instead of server-local midnight for date
  // bucketing. The previous version used `today.setHours(0,0,0,0)` which
  // uses the server's local timezone — daily logs submitted late in PST
  // may be bucketed as the next UTC day, breaking the consistency calc.
  let streak = 0; // kept for backward compat in the UI
  let consistencyPercent = 0;
  let consistencyDays = 0; // how many of the last 14 days had activity
  if (user.dailyLogs.length > 0) {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const seen = new Set(user.dailyLogs.map((l) => {
      const d = new Date(l.date);
      const dUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      return dUTC.toISOString();
    }));
    // Calculate old streak (backward compat) — ME-10 fix: use todayUTC
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayUTC); d.setUTCDate(todayUTC.getUTCDate() - i);
      if (seen.has(d.toISOString())) streak++; else break;
    }
    // Calculate rolling 14-day consistency — ME-10 fix: use todayUTC
    const ROLLING_DAYS = 14;
    for (let i = 0; i < ROLLING_DAYS; i++) {
      const d = new Date(todayUTC); d.setUTCDate(todayUTC.getUTCDate() - i);
      if (seen.has(d.toISOString())) consistencyDays++;
    }
    consistencyPercent = Math.round((consistencyDays / ROLLING_DAYS) * 100);
  }
  // bugs: removed (Bug model deleted — feature never built out)
  const openBugs = 0;
  const weakestTopic = user.competencies[0]?.topic ?? "N/A";
  const latestTest = user.weeklyTests.filter((t) => t.status === "completed").slice(-1)[0];
  const latestScore = latestTest?.score ?? null;

  // Project config from the user's assigned course — drives whether the
  // student dashboard shows the Project nav, banners, and the duration limits.
  const projectConfig = await getCourseProjectConfig(user.id, courseId);

  return NextResponse.json({
    role: "student",
    courseId: courseId ?? null,
    stats: {
      currentWeek,
      progress,
      streak,
      consistencyPercent,
      consistencyDays,
      openBugs,
      weakestTopic,
      latestScore,
      interactionsCount: user.interactions.length,
      tasksThisWeek: weekTasks.length,
      completedTasksThisWeek: completedTasks,
      // Project planning metadata — needed by the Project Progress chart
      // so it can render weeks 1..projectDurationWeeks instead of hardcoding 6.
      projectDurationWeeks: user.projectDurationWeeks ?? 6,
    },
    weeklyTests: user.weeklyTests,
    competencies: user.competencies,
    reportCards: user.reportCards,
    dailyLogs: user.dailyLogs,
    recentInteractions: user.interactions,
    tasks: user.tasks,
    bugs: [], // removed (Bug model deleted)
    comments: user.commentsRecv,
    // Course + project configuration — used by the student dashboard to
    // hide/show the Project nav + banners, and to enforce duration limits
    // in the project setup form.
    projectConfig,
  });
}
