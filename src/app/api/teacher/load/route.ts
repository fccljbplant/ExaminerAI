import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBatchFilter, getTeacherBatchIds, canAccessBatch } from "@/lib/batch-teachers";
import { requireRole, UserRole } from "@/lib/rbac";

/** GET /api/teacher/load — teacher wellbeing/load view.
 *
 *  Computed, not AI-generated. Fully transparent, deterministic math
 *  the teacher can audit. This is the one place where "the algorithm
 *  decided" needs to be fully inspectable by the person it's about.
 *
 *  Returns:
 *  - responseTimeTrend: avg time between student message/flag and
 *    teacher's reply, last 4 weeks vs this week
 *  - touchpointCompletionRate: MentorshipTouchpoint count vs overdue count
 *  - loadVsCapacity: assigned student count vs historical baseline
 *  - crisisLoad: count of currently-open CrisisFlags across their students
 *  - tier: green / amber / red (explainable thresholds)
 *  - tierReasons: why this tier
 */

export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.TEACHER, UserRole.TEACHING_ASSISTANT,
    UserRole.COURSE_COORDINATOR, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const teacherId = auth.ctx.payload.sub;
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get teacher's batch
  const teacher = await db.user.findUnique({
    where: { id: teacherId },
    select: { batchId: true },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  // Get assigned students
  const students = await db.user.findMany({
    where: {
      role: "student",
      blocked: false,
      ...(await getBatchFilter(auth.ctx.payload.sub, auth.ctx.payload.role)),
    },
    select: { id: true },
  });
  const studentIds = students.map(s => s.id);
  const studentCount = students.length;

  // 1. Response time trend: time between student messages and teacher replies
  const messages = await db.message.findMany({
    where: {
      OR: [
        { fromId: { in: studentIds }, toId: teacherId }, // student → teacher
        { fromId: teacherId, toId: { in: studentIds } }, // teacher → student
      ],
      sentAt: { gte: fourWeeksAgo },
    },
    orderBy: { sentAt: "asc" },
    select: { fromId: true, toId: true, sentAt: true },
    take: 500,
  });

  // Compute average response time (student message → teacher reply)
  let totalResponseTimeMs = 0;
  let responseCount = 0;
  let thisWeekResponseTimeMs = 0;
  let thisWeekResponseCount = 0;

  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const next = messages[i + 1];
    // If student sent a message and teacher replied
    if (studentIds.includes(msg.fromId) && next.fromId === teacherId) {
      const responseTime = new Date(next.sentAt).getTime() - new Date(msg.sentAt).getTime();
      if (responseTime > 0 && responseTime < 7 * 24 * 60 * 60 * 1000) { // ignore >7d gaps (probably unrelated)
        totalResponseTimeMs += responseTime;
        responseCount++;
        if (new Date(next.sentAt) > oneWeekAgo) {
          thisWeekResponseTimeMs += responseTime;
          thisWeekResponseCount++;
        }
      }
    }
  }

  const avgResponseTimeHours = responseCount > 0 ? totalResponseTimeMs / responseCount / (1000 * 60 * 60) : 0;
  const thisWeekResponseTimeHours = thisWeekResponseCount > 0 ? thisWeekResponseTimeMs / thisWeekResponseCount / (1000 * 60 * 60) : 0;

  // 2. Touchpoint completion rate
  const touchpoints = await db.mentorshipTouchpoint.count({
    where: {
      actorUserId: teacherId,
      createdAt: { gte: oneWeekAgo },
    },
  });

  // Overdue students: last touchpoint > 7 days ago or never
  const latestTouchpoints = await db.mentorshipTouchpoint.findMany({
    where: { userId: { in: studentIds } },
    orderBy: { createdAt: "desc" },
    distinct: ['userId'],
    select: { userId: true, createdAt: true },
  });

  const touchedStudentIds = new Set(latestTouchpoints.map(t => t.userId));
  const overdueStudents = studentIds.filter(id => {
    const tp = latestTouchpoints.find(t => t.userId === id);
    if (!tp) return true; // never touched
    const days = (now.getTime() - new Date(tp.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days > 7;
  });

  const touchpointCompletionRate = studentCount > 0
    ? Math.round(((studentCount - overdueStudents.length) / studentCount) * 100)
    : 100;

  // 3. Crisis load: open crisis flags
  const openCrisisFlags = await db.crisisFlag.count({
    where: { userId: { in: studentIds }, status: "open" },
  });

  // 4. Compute tier (explainable thresholds)
  const reasons: string[] = [];
  let tier: "green" | "warning" | "red" = "green";

  // Amber if: response time >2x rolling average OR >5 overdue students OR >2 open crisis flags
  if (avgResponseTimeHours > 0 && thisWeekResponseTimeHours > avgResponseTimeHours * 2) {
    reasons.push(`Response time this week (${Math.round(thisWeekResponseTimeHours)}h) is more than 2x your rolling average (${Math.round(avgResponseTimeHours)}h)`);
    tier = "warning";
  }
  if (overdueStudents.length > 5) {
    reasons.push(`${overdueStudents.length} students overdue for contact (threshold: 5)`);
    tier = "warning";
  }
  if (openCrisisFlags > 2) {
    reasons.push(`${openCrisisFlags} open crisis flags across your students (threshold: 2)`);
    tier = "red";
  }

  // Red if: response time >4x OR >10 overdue OR >5 crisis flags
  if (avgResponseTimeHours > 0 && thisWeekResponseTimeHours > avgResponseTimeHours * 4) {
    reasons.push(`Response time this week (${Math.round(thisWeekResponseTimeHours)}h) is more than 4x your rolling average — unsustainable pace`);
    tier = "red";
  }
  if (overdueStudents.length > 10) {
    reasons.push(`${overdueStudents.length} students overdue for contact — high caseload pressure`);
    tier = "red";
  }

  if (reasons.length === 0) {
    reasons.push("All metrics within sustainable range");
  }

  return NextResponse.json({
    teacherId,
    generatedAt: now.toISOString(),
    studentCount,
    responseTime: {
      rollingAverageHours: Math.round(avgResponseTimeHours * 10) / 10,
      thisWeekHours: Math.round(thisWeekResponseTimeHours * 10) / 10,
      responseCount,
    },
    touchpoints: {
      thisWeek: touchpoints,
      completionRate: touchpointCompletionRate,
      overdueStudentCount: overdueStudents.length,
    },
    crisisLoad: openCrisisFlags,
    tier,
    tierReasons: reasons,
    // Explicitly labeled — only the teacher sees this until the Principal view is built
    visibility: "self-only",
  });
}
