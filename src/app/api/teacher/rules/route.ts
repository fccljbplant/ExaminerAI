import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/teacher/rules — list teacher's personal rules */
export async function GET() {
  const auth = await requireRole([UserRole.TEACHER, UserRole.COURSE_COORDINATOR, UserRole.COUNSELOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const rules = await db.teacherRule.findMany({
    where: { teacherId: auth.ctx.payload.sub },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ rules });
}

/** POST /api/teacher/rules — create a new rule */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing teacher rules"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.COURSE_COORDINATOR, UserRole.COUNSELOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { condition, action } = body as { condition?: string; action?: string };

  const VALID_CONDITIONS = ["days_missed >= 2", "days_missed >= 3", "days_since_contact >= 5", "days_since_contact >= 7", "tier_change_to_amber", "tier_change_to_red", "confidence_gap > 20"];
  const VALID_ACTIONS = ["draft_checkin", "flag_in_today", "notify"];

  if (!condition || !VALID_CONDITIONS.includes(condition)) {
    return NextResponse.json({ error: `Invalid condition. Valid: ${VALID_CONDITIONS.join(", ")}` }, { status: 400 });
  }
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Invalid action. Valid: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
  }

  const rule = await db.teacherRule.create({
    data: { teacherId: auth.ctx.payload.sub, condition, action },
  });
  return NextResponse.json({ rule });
}

/** DELETE /api/teacher/rules?id=X — delete a rule */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing teacher rules"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.COURSE_COORDINATOR, UserRole.COUNSELOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.teacherRule.deleteMany({ where: { id, teacherId: auth.ctx.payload.sub } });
  return NextResponse.json({ ok: true });
}
