import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { getBatchFilter } from "@/lib/batch-teachers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/** GET /api/stats — aggregated stats for the dashboard.
 *  - For students: their own progress, streak, weakest topic, etc.
 *  - For teachers/admins: batch overview + counts.
 *  - For admin impersonating (via ?as=student|teacher): returns that role's stats. */
export async function GET(req: Request) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const asRole = url.searchParams.get("as"); // student | teacher — for admin impersonation
  const role = asRole === "student" || asRole === "teacher" ? asRole : payload.role;

  if (role === "teacher" || (role === "admin" && asRole === "teacher")) {
    // Scale: server-side pagination — don't load ALL students at once.
    // Default page size 100 (renders 4 pages of 25 in the UI). Max 200.
    const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10));
    const pageSize = Math.min(200, parseInt(url.searchParams.get("pageSize") || "100", 10));
    const skip = page * pageSize;

    // For stats (total counts), we need the full count — but we can get it
    // without loading all records. The enriched student list is paginated.
    // Multi-teacher: scope students to the teacher's batches via BatchTeacher
    const batchFilter = await getBatchFilter(payload.sub, payload.role);
    const studentWhere = { role: "student" as const, ...batchFilter };

    const [students, pending, teachers, totalStudents] = await Promise.all([
      db.user.findMany({
        where: studentWhere,
        skip,
        take: pageSize,
        include: {
          dailyLogs: { select: { date: true, confidence: true }, orderBy: { date: "desc" }, take: 5 },
          weeklyTests: { where: { status: "completed" }, select: { week: true, score: true, completedAt: true }, orderBy: { week: "asc" } },
          psychObs: { select: { week: true, confidence: true, cognitiveLoad: true, engagement: true }, orderBy: { week: "asc" } },
          tasks: { select: { status: true, week: true } },
          _count: { select: { interactions: true } },
        },
      }),
      db.user.count({ where: { role: "pending" } }),
      db.user.count({ where: { role: "teacher" } }),
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

      // 6. High cognitive load in recent psych obs
      const recentHighLoad = s.psychObs.slice(-3).filter(o => o.cognitiveLoad === "high").length;
      if (recentHighLoad >= 2) {
        attentionScore += 15;
        attentionReasons.push("Sustained high cognitive load");
      }

      return {
        id: s.id,
        email: s.email,
        name: s.name,
        currentWeek: s.currentWeek,
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
      role: "teacher",
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

  // Student (default) — return current user's progress data.
  // Admin can impersonate by passing ?as=student — we then return the
  // demo student's data so they can test the dashboard UI with real content.
  // Guardians see their linked student's data (read-only — the StudentDashboard
  // hides action buttons when role === "guardian").
  let targetUserId = payload.sub;
  if (hasRole(payload.role, ADMIN_ROLES) && asRole === "student") {
    const demoStudent = await db.user.findUnique({ where: { email: "student@examiner.ai" } });
    if (demoStudent) targetUserId = demoStudent.id;
  } else if (payload.role === "guardian") {
    // Load linked student — guardian has read-only access to this student's data
    const link = await db.guardianLink.findFirst({
      where: { guardianId: payload.sub },
      select: { studentId: true },
    });
    if (!link?.studentId) {
      return NextResponse.json({
        error: "No student is linked to your guardian account. Please ask an administrator to link you to your child.",
      }, { status: 403 });
    }
    targetUserId = link.studentId;
  }
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
        include: { teacher: { select: { name: true, email: true } } },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ---- Self-healing: fix stale weekly test statuses ----
  // Some tests were completed by the AI (score + psychAnalysis were set) but
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
      console.error("stats self-healing failed:", err instanceof Error ? err.message : String(err));
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
  let streak = 0; // kept for backward compat in the UI
  let consistencyPercent = 0;
  let consistencyDays = 0; // how many of the last 14 days had activity
  if (user.dailyLogs.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seen = new Set(user.dailyLogs.map((l) => {
      const d = new Date(l.date); d.setHours(0, 0, 0, 0); return d.toISOString();
    }));
    // Calculate old streak (backward compat)
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (seen.has(d.toISOString())) streak++; else break;
    }
    // Calculate rolling 14-day consistency
    const ROLLING_DAYS = 14;
    for (let i = 0; i < ROLLING_DAYS; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (seen.has(d.toISOString())) consistencyDays++;
    }
    consistencyPercent = Math.round((consistencyDays / ROLLING_DAYS) * 100);
  }
  // bugs: removed (Bug model deleted — feature never built out)
  const openBugs = 0;
  const weakestTopic = user.competencies[0]?.topic ?? "N/A";
  const latestTest = user.weeklyTests.filter((t) => t.status === "completed").slice(-1)[0];
  const latestScore = latestTest?.score ?? null;

  return NextResponse.json({
    role: "student",
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
  });
}
