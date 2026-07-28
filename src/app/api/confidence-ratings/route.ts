import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/confidence-ratings?userId=X — list confidence ratings (calibration data).
 *  Staff can query any student. Students can query their own (no userId needed). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const isStaff = ["teacher", "instructor", "course_coordinator", "counselor", "principal", "administrator", "demo", "admin"].includes(user.role);
  const userId = isStaff ? (requestedUserId || user.id) : user.id;

  const ratings = await db.confidenceRating.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, source: true, rating: true, actualScore: true, context: true, week: true, createdAt: true },
    take: 50,
  });
  return NextResponse.json({ ratings });
}
