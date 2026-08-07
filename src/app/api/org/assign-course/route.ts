import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload || (payload.role !== "org_admin" && payload.role !== "platform_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, courseId } = body as { userId?: string; courseId?: string };
  if (!userId || !courseId) return NextResponse.json({ error: "userId and courseId required" }, { status: 400 });

  const existing = await db.courseEnrollment.findFirst({ where: { userId, courseId, role: "student" } });
  if (existing) return NextResponse.json({ error: "Already enrolled" }, { status: 409 });

  const enrollment = await db.courseEnrollment.create({ data: { userId, courseId, role: "student" } });
  await db.course.update({ where: { id: courseId }, data: { enrollmentCount: { increment: 1 } } });
  return NextResponse.json({ enrollment });
}
