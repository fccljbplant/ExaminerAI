import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/messages/teacher — returns the student's assigned teacher. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can use Ask My Teacher" }, { status: 403 });
  }
  if (user.batchId) {
    const batchTeacher = await db.user.findFirst({
      where: { role: "teacher", batchId: user.batchId, blocked: false },
      orderBy: { lastLogin: "desc" },
      select: { id: true, name: true, email: true },
    });
    if (batchTeacher) return NextResponse.json({ teacher: batchTeacher });
  }
  const anyTeacher = await db.user.findFirst({
    where: { role: "teacher", blocked: false },
    orderBy: { lastLogin: "desc" },
    select: { id: true, name: true, email: true },
  });
  if (anyTeacher) return NextResponse.json({ teacher: anyTeacher });
  return NextResponse.json({ teacher: null });
}
