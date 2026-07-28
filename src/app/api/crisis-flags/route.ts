import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";
import { assertCanAccessStudent } from "@/lib/auth";

/** GET /api/crisis-flags?userId=X — list crisis flags for a student.
 *  Sensitive — content not duplicated. Returns metadata only, never the evidence text.
 *  IDOR protected: caller must have batch access to the student. */
export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.INSTRUCTOR, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO,
  ]);
  if (!auth.ok) return auth.response;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // IDOR protection
  try { await assertCanAccessStudent(auth.ctx.payload, userId); } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  const flags = await db.crisisFlag.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, category: true, severity: true, status: true, createdAt: true, resolvedAt: true },
  });
  return NextResponse.json({ flags });
}

/** POST /api/crisis-flags — create a crisis flag for a student.
 *
 *  Instructors, counselors, principals, and administrators can flag a student.
 *  The flag's existence is shown on the Psychological tab; the human response
 *  is tracked on the Mentorship tab.
 *
 *  Body: { userId, category, severity, evidenceRef? }
 *  - category: "self_harm_risk" | "severe_distress" | "disclosure" | "academic_crisis" | "behavioral_concern" | "other"
 *  - severity: "warning" | "red"
 *  - evidenceRef: optional JSON pointer to source (interaction ID, test ID, etc.)
 *
 *  CRITICAL: Never store the sensitive content of what was said — only the
 *  category + severity + reference. The actual evidence lives in the test/
 *  interaction it came from, not duplicated here.
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing crisis flags"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([
    UserRole.INSTRUCTOR, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR,
  ]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { userId, category, severity, evidenceRef } = body as {
    userId?: string;
    category?: string;
    severity?: string;
    evidenceRef?: string;
  };

  if (!userId || !category || !severity) {
    return NextResponse.json({ error: "userId, category, and severity required" }, { status: 400 });
  }

  const VALID_CATEGORIES = ["self_harm_risk", "severe_distress", "disclosure", "academic_crisis", "behavioral_concern", "other"];
  const VALID_SEVERITIES = ["warning", "red"];

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!VALID_SEVERITIES.includes(severity)) {
    return NextResponse.json({ error: "Invalid severity — must be 'amber' or 'red'" }, { status: 400 });
  }

  // Verify the target student exists (HI-1 fix: also fetch institutionId for scoping)
  const student = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, institutionId: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // IDOR protection
  try { await assertCanAccessStudent(auth.ctx.payload, userId); } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  try {
    const flag = await db.crisisFlag.create({
      data: {
        userId,
        flaggedBy: auth.ctx.payload.sub,
        category,
        severity,
        status: "open",
        evidenceRef: evidenceRef || null,
      },
    });

    // Audit log — log the FACT of the flag, not any content
    await logAudit({
      actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
      action: "crisis_flag_created",
      target: { type: "crisisFlag", id: flag.id },
      after: { category, severity, status: "open", targetStudent: student.name },
      req,
    });

    // Auto-create a MentorshipTouchpoint so the Mentorship tab shows it immediately
    await db.mentorshipTouchpoint.create({
      data: {
        userId,
        actorUserId: auth.ctx.payload.sub,
        type: "alert_response",
        relatedAlertId: flag.id,
        note: `Crisis flag created: ${category.replace(/_/g, " ")} (${severity}). Follow-up required.`,
        outcome: null, // pending action
      },
    });

    // Notify counselors + principals via in-app messages (best-effort, non-blocking).
    // HI-1 fix: scope notification to the student's institution — was sending to
    // ALL counselors/principals/admins globally, leaking cross-institution data.
    try {
      const notifyRoles = ["counselor", "principal", "administrator"];
      const recipients = await db.user.findMany({
        where: {
          role: { in: notifyRoles },
          blocked: false,
          // HI-1 fix: only notify staff in the SAME institution as the student.
          // Use a guaranteed-non-match when student has no institution (same
          // pattern as CR-3 fix — never pass undefined to Prisma).
          institutionId: student.institutionId || "__no_institution__",
        },
        select: { id: true },
      });
      const crisisMsg = `CRISIS FLAG: Student ${student.name} has been flagged with ${category.replace(/_/g, " ")} (${severity}). Immediate review recommended. Flag ID: ${flag.id}`;
      for (const recipient of recipients) {
        await db.message.create({
          data: {
            fromId: auth.ctx.payload.sub,
            toId: recipient.id,
            subject: `Crisis Flag: ${student.name} — ${severity.toUpperCase()}`,
            body: crisisMsg,
          },
        }).catch(() => {}); // best-effort per recipient
      }
    } catch { /* notification is best-effort, never blocks the flag creation */ }

    logger.info("Crisis flag created", {
      flagId: flag.id, userId, category, severity, by: auth.ctx.payload.sub,
    });

    return NextResponse.json({ flag });
  } catch (err) {
    logger.error("Crisis flag creation failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create crisis flag" }, { status: 500 });
  }
}

/** PATCH /api/crisis-flags — update a flag's status (resolve/acknowledge). */
export async function PATCH(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing crisis flags"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([
    UserRole.INSTRUCTOR, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR,
  ]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { flagId, status } = body as { flagId?: string; status?: string };

  if (!flagId || !status) {
    return NextResponse.json({ error: "flagId and status required" }, { status: 400 });
  }

  // HI-3 fix: add "escalated" as a valid status for counselor → principal escalation
  const VALID_STATUSES = ["open", "acknowledged", "resolved", "escalated"];
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    // HI-3 fix: when escalating, notify all principals in the student's institution
    if (status === "escalated") {
      const flag = await db.crisisFlag.findUnique({
        where: { id: flagId },
        select: { userId: true, category: true, severity: true },
      });
      if (flag) {
        const student = await db.user.findUnique({
          where: { id: flag.userId },
          select: { name: true, institutionId: true },
        });
        if (student?.institutionId) {
          const principals = await db.user.findMany({
            where: { role: { in: ["principal", "administrator"] }, blocked: false, institutionId: student.institutionId },
            select: { id: true },
          });
          const escalateMsg = `ESCALATED CRISIS FLAG: Student ${student.name} — ${flag.category.replace(/_/g, " ")} (${flag.severity}). A counselor has escalated this flag for principal review. Flag ID: ${flagId}`;
          for (const p of principals) {
            await db.message.create({
              data: {
                fromId: auth.ctx.payload.sub,
                toId: p.id,
                subject: `ESCALATED: ${student.name} — ${flag.severity.toUpperCase()}`,
                body: escalateMsg,
              },
            }).catch(() => {}); // best-effort
          }
        }
      }
    }

    const flag = await db.crisisFlag.update({
      where: { id: flagId },
      data: {
        status,
        resolvedAt: status === "resolved" ? new Date() : null,
      },
    });

    await logAudit({
      actor: { id: auth.ctx.payload.sub, name: auth.ctx.payload.name, role: auth.ctx.payload.role },
      action: "crisis_flag_updated",
      target: { type: "crisisFlag", id: flagId },
      after: { status },
      req,
    });

    return NextResponse.json({ flag });
  } catch (err) {
    logger.error("Crisis flag update failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update crisis flag" }, { status: 500 });
  }
}
