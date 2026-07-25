import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { assertCanAccessStudent } from "@/lib/auth";
import { logAudit, AuditAction } from "@/lib/audit-log";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/grades/override — teacher/admin overrides a grade.
 *  Phase RBAC+AUDIT: centralized RBAC + universal audit log. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("overriding grades"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.TEACHING_ASSISTANT, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEVELOPER]);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await req.json().catch(() => ({}));
  const { type, id, score, reason } = body as { type?: string; id?: string; score?: number; reason?: string };

  if (!type || !id || score === undefined) return NextResponse.json({ error: "type, id, and score required" }, { status: 400 });
  if (score < 0 || score > 100) return NextResponse.json({ error: "Score must be 0-100" }, { status: 400 });

  try {
    if (type === "interaction") {
      const interaction = await db.interaction.findUnique({ where: { id }, select: { userId: true, correctness: true, topic: true, week: true } });
      if (!interaction) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const oldScore = interaction.correctness;
      // IDOR protection: verify the caller can access this student's data
      try {
        await assertCanAccessStudent(ctx.payload, interaction.userId);
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
      }
      // H4-rel: wrap grade override + comment in a transaction so a
      // comment failure doesn't leave the grade changed with no audit trail.
      await db.$transaction(async (tx) => {
        await tx.interaction.update({ where: { id }, data: { correctness: score } });
        await tx.comment.create({
          data: {
            interactionId: id, studentId: interaction.userId, teacherId: ctx.payload.sub,
            body: `Grade overridden by teacher: ${oldScore}% → ${score}%${reason ? ` — ${reason}` : ""}`,
            marksOverride: score,
          },
        });
      });
      await logAudit({
        actor: { id: ctx.payload.sub, name: ctx.payload.name, role: ctx.payload.role },
        action: AuditAction.GRADE_CHANGED, target: { type: "interaction", id },
        before: { score: oldScore, topic: interaction.topic, week: interaction.week },
        after: { score, topic: interaction.topic, week: interaction.week },
        metadata: { studentId: interaction.userId, reason: reason ?? null }, req,
      });
      return NextResponse.json({ ok: true, oldScore, newScore: score });
    } else if (type === "weeklyTest") {
      const test = await db.weeklyTest.findUnique({ where: { id }, select: { userId: true, score: true, week: true } });
      if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const oldScore = test.score;
      // IDOR protection: verify the caller can access this student's data
      try {
        await assertCanAccessStudent(ctx.payload, test.userId);
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
      }
      await db.weeklyTest.update({ where: { id }, data: { score } });
      await logAudit({
        actor: { id: ctx.payload.sub, name: ctx.payload.name, role: ctx.payload.role },
        action: AuditAction.GRADE_CHANGED, target: { type: "weeklyTest", id },
        before: { score: oldScore, week: test.week },
        after: { score, week: test.week },
        metadata: { studentId: test.userId, reason: reason ?? null }, req,
      });
      return NextResponse.json({ ok: true, oldScore, newScore: score });
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
