import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { getCurrentUser, assertCanAccessStudent, getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/psych-evidence?userId=X — list psychological evidence for a student.
 *  Staff can query students in their batch. Students can query their own. */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedUserId = req.nextUrl.searchParams.get("userId");
  // Students can only see their own evidence; staff can query students they have access to
  const userId = requestedUserId || payload.sub;

  // IDOR protection: if requesting another user's data, verify access
  if (userId !== payload.sub) {
    try { await assertCanAccessStudent(payload, userId); } catch (err: any) {
      return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
    }
  }

  const evidence = await db.psychEvidence.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, dimension: true, value: true, evidenceText: true, sourceType: true, sourceId: true, week: true, createdAt: true },
  });
  return NextResponse.json({ evidence });
}

/** POST /api/psych-evidence — write a new evidence row (staff only). */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing psychology evidence"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.COUNSELOR, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { userId, dimension, value, evidenceText, sourceType, sourceId, week } = body as {
    userId?: string; dimension?: string; value?: string; evidenceText?: string;
    sourceType?: string; sourceId?: string; week?: number;
  };
  if (!userId || !dimension || !value || !evidenceText) {
    return NextResponse.json({ error: "userId, dimension, value, evidenceText required" }, { status: 400 });
  }

  // IDOR protection
  try { await assertCanAccessStudent(auth.ctx.payload, userId); } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  const ev = await db.psychEvidence.create({
    data: { userId, dimension, value, evidenceText, sourceType: sourceType || "manual", sourceId, week },
  });
  return NextResponse.json({ evidence: ev });
}
