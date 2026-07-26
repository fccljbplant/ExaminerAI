import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/guardian/overview
 *
 * A purpose-built endpoint for guardians. Returns everything a guardian
 * needs in a single call — no separate fetches, no student-dashboard cloning.
 *
 * Response shape:
 * {
 *   student: { id, name, email, currentWeek, projectName },
 *   snapshot: {
 *     wellbeingTier: "green" | "warning" | "red",
 *     latestGrade: "A" | "B" | ... | null,
 *     latestScore: number | null,
 *     avgScore: number | null,
 *     attendanceRate: number | null,  // % of days with activity
 *     engagementStreak: number,
 *     activeDaysThisWeek: number,
 *   },
 *   concerns: string[],              // plain-English concern list
 *   wins: string[],                  // plain-English wins list
 *   weeklySummary: {                 // last 4 weeks of test scores
 *     week: number, score: number | null, grade: string | null
 *   }[],
 *   recentActivity: {               // last 10 meaningful actions
 *     type: "test" | "checkin" | "project" | "comment" | "alert",
 *     title: string,
 *     description: string,
 *     date: string,
 *   }[],
 *   teacherComments: {              // last 5 teacher comments
 *     teacherName: string,
 *     body: string,
 *     createdAt: string,
 *   }[],
 *   teacher: {                       // the student's teacher
 *     name: string,
 *     email: string,
 *   } | null,
 * }
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (payload.role !== "guardian") {
    return NextResponse.json({ error: "Only guardians can access this endpoint" }, { status: 403 });
  }

  // Find the linked student
  const link = await db.guardianLink.findFirst({
    where: { guardianId: payload.sub },
    select: { studentId: true, relationship: true },
  });

  if (!link?.studentId) {
    return NextResponse.json({
      error: "No student is linked to your guardian account. Please ask an administrator to link you to your child.",
    }, { status: 403 });
  }

  const studentId = link.studentId;

  // Load student + all data in parallel
  const [student, wellbeing, weeklyTests, reportCards, dailyLogs, comments, healthSummary, alerts, touchpoints] = await Promise.all([
    db.user.findUnique({
      where: { id: studentId },
      select: {
        id: true, name: true, email: true, currentWeek: true,
        projectName: true, projectDescription: true,
        batchId: true, createdAt: true,
      },
    }),
    db.wellbeingState.findUnique({
      where: { userId: studentId },
      select: { tier: true, reasonsJson: true, updatedAt: true },
    }),
    db.weeklyTest.findMany({
      where: { userId: studentId, status: "completed" },
      orderBy: { week: "asc" },
      select: { week: true, score: true, completedAt: true, strengths: true, weaknesses: true, examinerComment: true },
      take: 10,
    }),
    db.reportCard.findMany({
      where: { userId: studentId },
      orderBy: { week: "desc" },
      take: 4,
    }),
    db.dailyLog.findMany({
      where: { userId: studentId },
      orderBy: { date: "desc" },
      take: 7,
      select: { id: true, date: true, week: true, whatDidYouDo: true, confidence: true, learningReflection: true, confusionNotes: true },
    }),
    db.comment.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { teacher: { select: { name: true, email: true } } },
    }),
    db.studentHealthSummary.findUnique({
      where: { userId: studentId },
      select: {
        moodScore: true, engagementScore: true, engagementStreak: true,
        avgScoreThisWeek: true, avgScoreOverall: true,
        frustrationCount: true, avoidanceCount: true, enthusiasmCount: true,
        wellbeingTier: true, lastActiveDate: true,
        tutorMessagesThisWeek: true, testsThisWeek: true,
      },
    }),
    db.studentAlert.findMany({
      where: { userId: studentId, status: { in: ["open", "acknowledged"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, severity: true, reason: true, createdAt: true },
    }),
    db.mentorshipTouchpoint.findMany({
      where: { userId: studentId, type: "praise_note" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, note: true, createdAt: true },
    }),
  ]);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Find the student's teacher (from batch)
  let teacher: { name: string; email: string } | null = null;
  if (student.batchId) {
    const batchTeacher = await db.batchTeacher.findFirst({
      where: { batchId: student.batchId },
      include: { teacher: { select: { name: true, email: true } } },
    });
    if (batchTeacher?.teacher) {
      teacher = batchTeacher.teacher;
    }
  }

  // ---- Compute snapshot ----
  const latestTest = weeklyTests[weeklyTests.length - 1];
  const latestReportCard = reportCards[0];
  const avgScore = healthSummary?.avgScoreOverall ?? null;

  // Attendance: % of last 7 days with a daily log
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const activeDaysThisWeek = dailyLogs.filter(d => new Date(d.date) >= sevenDaysAgo).length;

  // ---- Build concerns list (plain English) ----
  const concerns: string[] = [];
  if (wellbeing?.tier === "red") {
    concerns.push("Your child's wellbeing indicators show significant concern. The school counsellor has been notified.");
  } else if (wellbeing?.tier === "warning") {
    concerns.push("Your child is showing some warning signs. Teachers are monitoring closely.");
  }
  if (alerts.length > 0) {
    concerns.push(`${alerts.length} active ${alerts.length === 1 ? "alert" : "alerts"} from teachers regarding ${alerts[0].type} concerns.`);
  }
  if (latestTest && latestTest.score !== null && latestTest.score < 50) {
    concerns.push(`Latest test score was ${latestTest.score}%, which is below the passing threshold.`);
  }
  if (healthSummary && healthSummary.engagementStreak === 0) {
    concerns.push("Your child hasn't been active on the platform recently.");
  }
  if (healthSummary && healthSummary.frustrationCount > 2) {
    concerns.push("Increased frustration signals detected in recent AI Tutor sessions.");
  }
  if (healthSummary && healthSummary.avoidanceCount > 2) {
    concerns.push("Your child has been avoiding some practice questions — may indicate uncertainty or gaps.");
  }

  // ---- Build wins list (plain English) ----
  const wins: string[] = [];
  if (latestTest && latestTest.score !== null && latestTest.score >= 85) {
    wins.push(`Excellent! Latest test score: ${latestTest.score}%.`);
  }
  if (healthSummary && healthSummary.enthusiasmCount > 2) {
    wins.push("Showing enthusiasm and engagement in recent sessions.");
  }
  if (healthSummary && healthSummary.engagementStreak >= 5) {
    wins.push(`${healthSummary.engagementStreak}-day engagement streak — consistent effort!`);
  }
  if (touchpoints.length > 0) {
    wins.push("Received a praise note from mentor: \"" + touchpoints[0].note.slice(0, 100) + "...\"");
  }
  if (avgScore !== null && avgScore >= 75) {
    wins.push(`Overall average score: ${Math.round(avgScore)}% — on track.`);
  }

  // ---- Build weekly summary (last 4 weeks) ----
  const weeklySummary = weeklyTests.slice(-4).map(t => ({
    week: t.week,
    score: t.score,
    grade: t.score !== null ? scoreToGrade(t.score) : null,
  }));

  // ---- Build recent activity feed ----
  const recentActivity: Array<{ type: string; title: string; description: string; date: string }> = [];

  // Add tests
  weeklyTests.slice(-3).reverse().forEach(t => {
    if (t.score !== null) {
      recentActivity.push({
        type: "test",
        title: `Weekly Test ${t.week}`,
        description: `Scored ${t.score}% (${scoreToGrade(t.score)})`,
        date: t.completedAt?.toISOString() || new Date().toISOString(),
      });
    }
  });

  // Add daily logs
  dailyLogs.slice(0, 3).forEach(log => {
    recentActivity.push({
      type: "checkin",
      title: `Daily Check-in (Week ${log.week})`,
      description: log.whatDidYouDo.slice(0, 80) || "Checked in",
      date: log.date.toISOString(),
    });
  });

  // Add teacher comments
  comments.slice(0, 3).forEach(c => {
    recentActivity.push({
      type: "comment",
      title: `Comment from ${c.teacher?.name || "Teacher"}`,
      description: (c.body || "").slice(0, 80),
      date: c.createdAt.toISOString(),
    });
  });

  // Add alerts
  alerts.slice(0, 2).forEach(a => {
    recentActivity.push({
      type: "alert",
      title: `${a.severity === "red" ? "⚠️" : "🔔"} ${a.type} alert`,
      description: a.reason.slice(0, 80),
      date: a.createdAt.toISOString(),
    });
  });

  // Sort by date (most recent first) and take 10
  recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  recentActivity.splice(10);

  // ---- Format teacher comments ----
  const teacherComments = comments.map(c => ({
    teacherName: c.teacher?.name || "Teacher",
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  }));

  // ---- Build response ----
  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      currentWeek: student.currentWeek,
      projectName: student.projectName,
    },
    relationship: link.relationship,
    snapshot: {
      wellbeingTier: wellbeing?.tier || healthSummary?.wellbeingTier || "green",
      latestGrade: latestReportCard?.grade || (latestTest?.score !== null ? scoreToGrade(latestTest.score) : null),
      latestScore: latestTest?.score ?? null,
      avgScore: avgScore !== null ? Math.round(avgScore) : null,
      engagementStreak: healthSummary?.engagementStreak ?? 0,
      activeDaysThisWeek,
      tutorMessagesThisWeek: healthSummary?.tutorMessagesThisWeek ?? 0,
      testsThisWeek: healthSummary?.testsThisWeek ?? 0,
    },
    concerns,
    wins,
    weeklySummary,
    recentActivity,
    teacherComments,
    teacher,
    reportCards: reportCards.map(rc => ({
      week: rc.week,
      grade: rc.grade,
      score: rc.score,
      strengths: rc.strengths,
      weaknesses: rc.weaknesses,
      workHabits: rc.workHabits,
      progress: rc.progress,
      examinerObservations: rc.examinerObservations,
    })),
  });
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
