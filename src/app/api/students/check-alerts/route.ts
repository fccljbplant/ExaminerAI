import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getBatchFilter, getTeacherBatchIds, canAccessBatch } from "@/lib/batch-teachers";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";
import { getCourseProjectConfig } from "@/lib/course-db";

/** POST /api/students/check-alerts — scans all students for struggle signals
 *  and auto-creates Messages to nudge students + alert teachers.
 *
 *  Phase 3.2: Auto-nudge students who have been inactive for 2+ days.
 *  Phase 3.3: Auto-alert teachers when a student shows declining trajectory
 *  or sustained low confidence.
 *
 *  This endpoint is idempotent — it checks whether a similar message was
 *  already sent in the last 3 days before sending a new one, so it's safe
 *  to call repeatedly (e.g. via a daily cron job or manual admin trigger).
 *
 *  Auth: admin only (this is a system-level operation).
 *  Cron: GET requests with ?secret=CRON_SECRET env var bypass admin auth
 *  for automated Vercel cron jobs.
 *
 *  Body: { dryRun?: boolean } — if true, returns what WOULD be sent without
 *  actually creating messages. Useful for previewing.
 */

/** Core logic — shared between POST (admin manual) and GET (cron automated).
 *  senderId: the user ID of the admin/system sending the messages. */
async function runAlertCheck(dryRun: boolean, senderId: string) {
  const messagesCreated: Array<{
    type: "student_nudge" | "teacher_alert";
    toName: string;
    subject: string;
    body: string;
  }> = [];

  // Fetch all students with their recent activity + behavioral data
  const students = await db.user.findMany({
    where: { role: "student", blocked: false },
    include: {
      batch: { select: { id: true, name: true } },
      dailyLogs: {
        select: { date: true, confidence: true },
        orderBy: { date: "desc" },
        take: 5,
      },
      weeklyTests: {
        where: { status: "completed" },
        select: { week: true, score: true, completedAt: true },
        orderBy: { week: "asc" },
      },
      psychObs: {
        select: { week: true, confidence: true, cognitiveLoad: true, engagement: true },
        orderBy: { week: "asc" },
      },
      messagesSent: {
        where: { sentAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
        select: { subject: true, body: true, sentAt: true },
      },
      // For project-required checks: load currentWeek + projectName + tasks count
      // (projectName = null means the student hasn't created a project yet).
      // We don't load all tasks — just a count — to avoid pulling huge task lists.
      _count: { select: { tasks: true } },
    },
  });

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  for (const student of students) {
    // Fetch the student's course + project configuration. Used to:
    // - Skip project-related alerts when the course has projects disabled.
    // - Escalate project inactivity when the project is REQUIRED.
    // - Skip inactivity nudges when the student has no course assigned
    //   (their daily check-in is optional in that state).
    const projectConfig = await getCourseProjectConfig(student.id);

    // ---- Phase 3.2: Check for inactivity (2+ days since last daily log) ----
    const lastLog = student.dailyLogs[0]?.date;
    let daysInactive = 0;
    if (lastLog) {
      daysInactive = Math.floor((Date.now() - new Date(lastLog).getTime()) / (1000 * 60 * 60 * 24));
    } else if (student.weeklyTests.length > 0 || student.dailyLogs.length === 0) {
      // Has started the course but never checked in
      daysInactive = 999;
    }

    // Skip inactivity nudges for students with no course assigned — the daily
    // check-in is most valuable when tied to a course's daily curriculum.
    // (They can still log work, but we don't nag them about missing it.)
    if (projectConfig.courseAssigned && daysInactive >= 2 && daysInactive !== 999) {
      // Check if we already sent a nudge in the last 3 days
      const alreadyNudged = student.messagesSent.some(
        m => m.subject === "Checking in — everything okay?" || m.body?.includes("noticed you haven't checked in")
      );
      if (!alreadyNudged) {
        // SDT rebalance: autonomy-supportive invitation, not directive.
        // Implementation intention: concrete next action, not vague aspiration.
        // Relatedness: reference their actual progress (week, test history).
        const weekInfo = student.weeklyTests.length > 0
          ? `You're on Week ${student.weeklyTests[student.weeklyTests.length - 1]?.week ?? 1} — you've already completed ${student.weeklyTests.length} test${student.weeklyTests.length === 1 ? "" : "s"}, which means you've learned real material.`
          : `You've started the course — that first step matters.`;
        const nudgeBody = daysInactive >= 3
          ? `Hi ${student.name}, I noticed it's been ${daysInactive} days since your last check-in. ${weekInfo} No judgment at all — life happens. When you're ready, here's a low-pressure way back in: open the app and do just ONE practice question on any topic. That's it. One question. You can decide from there whether to keep going or take more time. I'm here if you want to talk through anything.`
          : `Hi ${student.name}, just a quick note — it's been ${daysInactive} days since your last check-in. ${weekInfo} If now's a good time, try opening the app and doing one practice question before anything else. Just one — it takes 2 minutes and keeps the momentum going. If now's not the right time, that's okay too. Reply here if you need anything.`;

        messagesCreated.push({
          type: "student_nudge",
          toName: student.name,
          subject: "Checking in — everything okay?",
          body: nudgeBody,
        });

        if (!dryRun) {
          await db.message.create({
            data: {
              fromId: senderId, // admin
              toId: student.id,
              subject: "Checking in — everything okay?",
              body: nudgeBody,
            },
          });
        }
      }
    }

    // ---- Phase 3.3: Check for struggle signals that should alert the teacher ----
    // SDT rebalance: every alert includes a strengthSignal alongside the concern.
    // No deficit-only alerts — the teacher needs the full picture.
    const struggleReasons: string[] = [];
    const strengthSignals: string[] = [];

    // Identify strengths alongside concerns
    if (student.weeklyTests.length > 0) {
      const scores = student.weeklyTests.map(t => t.score).filter((s): s is number => s !== null);
      if (scores.length > 0) {
        const bestScore = Math.max(...scores);
        if (bestScore >= 75) strengthSignals.push(`Scored ${bestScore}% on a previous test — capable of strong performance`);
        const completedCount = student.weeklyTests.length;
        if (completedCount >= 3) strengthSignals.push(`Completed ${completedCount} tests — showing persistence`);
      }
    }
    if (student.dailyLogs.length >= 5) strengthSignals.push(`${student.dailyLogs.length} check-ins total — has built a check-in habit`);
    const highConfidenceLogs = student.dailyLogs.filter(l => l.confidence >= 4).length;
    if (highConfidenceLogs > 0) strengthSignals.push(`${highConfidenceLogs} high-confidence check-ins — has moments of clarity`);

    // 1. Declining test scores (dropped 15+ points between last 2 tests)
    if (student.weeklyTests.length >= 2) {
      const scores = student.weeklyTests.map(t => t.score).filter((s): s is number => s !== null);
      if (scores.length >= 2) {
        const last = scores[scores.length - 1];
        const prev = scores[scores.length - 2];
        if (last < prev - 15) {
          struggleReasons.push(`Test score dropped from ${prev}% to ${last}%`);
        }
      }
    }

    // 2. Low latest test score (< 50)
    const latestTest = student.weeklyTests[student.weeklyTests.length - 1];
    if (latestTest?.score !== null && latestTest?.score !== undefined && latestTest.score < 50) {
      struggleReasons.push(`Last test score was ${latestTest.score}%`);
    }

    // 3. Sustained low confidence (2+ of last 5 daily logs at confidence ≤ 2)
    const lowConfidenceCount = student.dailyLogs.filter(l => l.confidence <= 2).length;
    if (lowConfidenceCount >= 2) {
      struggleReasons.push(`${lowConfidenceCount} recent low-confidence check-ins`);
    }

    // 4. Sustained high cognitive load (2+ of last 3 psych obs)
    const recentHighLoad = student.psychObs.slice(-3).filter(o => o.cognitiveLoad === "high").length;
    if (recentHighLoad >= 2) {
      struggleReasons.push("Sustained high cognitive load");
    }

    // 5. Project inactivity — ONLY when the course has projects enabled AND
    //    the project is required. We don't nag students about project work
    //    when the project is optional or disabled.
    //    Trigger: student is past week 2 of their course, project is required,
    //    and they haven't created any project tasks yet (tasks count is 0).
    if (projectConfig.courseAssigned && projectConfig.projectRequired) {
      const studentWeek = student.currentWeek ?? 1;
      const taskCount = student._count?.tasks ?? 0;
      if (studentWeek >= 2 && taskCount === 0) {
        struggleReasons.push(`Has not started the required capstone project (week ${studentWeek})`);
      }
    }

    // If we found struggle signals, alert the student's teacher (if they have one)
    if (struggleReasons.length > 0) {
      // Find the student's teacher — for now, alert all teachers + admins.
      // In the future when we have batch-assigned teachers, we can be more targeted.
      const teachers = await db.user.findMany({
        // M5-security: only notify teachers in the student's batch + admins
        where: {
          OR: [
            { role: { in: ["teacher"] }, blocked: false, batchId: student.batchId },
            { role: { in: ["administrator", "principal"] }, blocked: false },
          ],
        },
        select: { id: true, name: true },
      });

      for (const teacher of teachers) {
        // Don't alert the admin about themselves
        if (teacher.id === senderId && teachers.length > 1) continue;

        // Check if we already sent this alert recently
        const existingAlert = student.messagesSent.find(
          m => m.subject?.includes(`Student alert: ${student.name}`) && m.sentAt >= threeDaysAgo
        );
        if (existingAlert) continue;

        // Check if the teacher already has an unread alert about this student
        const teacherMessages = await db.message.findFirst({
          where: {
            toId: teacher.id,
            subject: { contains: `Student alert: ${student.name}` },
            sentAt: { gte: threeDaysAgo },
          },
        });
        if (teacherMessages) continue;

        const alertBody = `Student ${student.name} (${student.email}) may need attention.

WHAT'S GOING ON:
${struggleReasons.map(r => `• ${r}`).join("\n")}

WHAT'S ALREADY WORKING (reference these in your conversation):
${strengthSignals.length > 0 ? strengthSignals.map(s => `• ${s}`).join("\n") : "• Showed up and engaged with the platform — that's the foundation"}

SUGGESTED APPROACH:
- Lead with the strength, then explore the concern together
- Ask "what do you think would help here?" before prescribing a solution
- Consider a regular check-in (even a quick comment) — consistency of presence matters more than one big intervention

Review their portfolio: ${process.env.NEXT_PUBLIC_APP_URL || ""}/?view=batch

This is an automated alert — review the student's portfolio before acting.`;

        messagesCreated.push({
          type: "teacher_alert",
          toName: teacher.name,
          subject: `Student alert: ${student.name} — ${struggleReasons[0]}`,
          body: alertBody,
        });

        if (!dryRun) {
          await db.message.create({
            data: {
              fromId: senderId, // admin (system)
              toId: teacher.id,
              subject: `Student alert: ${student.name} — ${struggleReasons[0]}`,
              body: alertBody,
            },
          });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    studentsScanned: students.length,
    messagesCreated: messagesCreated.length,
    messages: messagesCreated,
  });
}

/** POST — admin manual trigger (from the AdminDashboard UI). */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("checking alerts"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "true" || (await req.json().catch(() => ({}))).dryRun === true;

  return runAlertCheck(dryRun, payload.sub);
}

/** GET — cron automated trigger (Vercel cron job).
 *  Auth: CRON_SECRET env var in the ?secret= query param.
 *  If CRON_SECRET is not set, falls back to admin auth (for manual testing). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cronSecret = url.searchParams.get("secret");

  // If CRON_SECRET env var is set, validate against it
  if (process.env.CRON_SECRET) {
    // M4-security: timing-safe comparison to prevent timing attacks
    try {
      const a = Buffer.from(cronSecret || "");
      const b = Buffer.from(process.env.CRON_SECRET);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        logger.warn("Cron check-alerts: invalid or missing secret", { hasSecret: !!cronSecret });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.info("Cron check-alerts: running automated scan");
    // For cron: use a system admin user as the sender. Find the first admin.
    // M9-security: prefer principal over administrator for the cron
    // sender. Per rbac.ts design, administrator is operational and
    // should NOT have pastoral access. Principal is the canonical
    // role with institution-wide pastoral access.
    const admin = await db.user.findFirst({
      where: { role: "principal", blocked: false },
      select: { id: true }
    }) || await db.user.findFirst({
      where: { role: "administrator", blocked: false },
      select: { id: true }
    });
    if (!admin) {
      logger.warn("Cron check-alerts: no admin user found to use as sender");
      return NextResponse.json({ ok: true, studentsScanned: 0, messagesCreated: 0, messages: [] });
    }
    return runAlertCheck(false, admin.id); // never dry-run from cron
  }

  // If no CRON_SECRET set, require admin auth (for manual testing)
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Admin only (or set CRON_SECRET env var for cron access)" }, { status: 403 });
  }

  const dryRun = url.searchParams.get("dryRun") === "true";
  return runAlertCheck(dryRun, payload.sub);
}
