import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/org/assign-course — org course assignment (B2B ops).
 *
 * Body: { userId, courseId, expiresInDays?, retakeAfterDays? } — the
 * optional compliance fields set CourseEnrollment.expiresAt (now +
 * expiresInDays) and retakeAfterDays. Omitted = permanent assignment
 * (backward compatible with the pre-compliance contract).
 */
export async function POST(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload || (payload.role !== "org_admin" && payload.role !== "platform_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, courseId, expiresInDays, retakeAfterDays } = body as {
    userId?: string;
    courseId?: string;
    expiresInDays?: number;
    retakeAfterDays?: number;
  };
  if (!userId || !courseId) return NextResponse.json({ error: "userId and courseId required" }, { status: 400 });

  if (expiresInDays !== undefined && (!Number.isFinite(expiresInDays) || expiresInDays <= 0)) {
    return NextResponse.json({ error: "expiresInDays must be a positive number" }, { status: 400 });
  }
  if (retakeAfterDays !== undefined && (!Number.isFinite(retakeAfterDays) || retakeAfterDays <= 0)) {
    return NextResponse.json({ error: "retakeAfterDays must be a positive number" }, { status: 400 });
  }

  const existing = await db.courseEnrollment.findFirst({ where: { userId, courseId, role: "student" } });
  if (existing) return NextResponse.json({ error: "Already enrolled" }, { status: 409 });

  const enrollment = await db.courseEnrollment.create({
    data: {
      userId,
      courseId,
      role: "student",
      ...(expiresInDays !== undefined
        ? { expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) }
        : {}),
      ...(retakeAfterDays !== undefined ? { retakeAfterDays } : {}),
    },
  });
  await db.course.update({ where: { id: courseId }, data: { enrollmentCount: { increment: 1 } } });
  logger.info("Org course assigned", { userId, courseId, expiresInDays, retakeAfterDays });
  return NextResponse.json({ enrollment });
}
