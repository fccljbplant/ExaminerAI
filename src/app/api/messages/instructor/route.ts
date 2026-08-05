import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/messages/teacher — returns the student's assigned instructor(s). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can use Ask My Teacher" }, { status: 403 });
  }
  // Find the student's courses and return the first instructor
  const enrollments = await db.courseEnrollment.findMany({
    where: { userId: user.id, role: "student" },
    select: { courseId: true },
  });
  const courseIds = enrollments.map(e => e.courseId);
  if (courseIds.length > 0) {
    const instructorEnrollments = await db.courseEnrollment.findMany({
      where: { courseId: { in: courseIds }, role: "instructor" },
      select: { userId: true },
    });
    const instructorIds = [...new Set(instructorEnrollments.map(e => e.userId))];
    if (instructorIds.length > 0) {
      const instructor = await db.user.findFirst({
        where: { id: { in: instructorIds }, blocked: false },
        orderBy: { lastLogin: "desc" },
        select: { id: true, name: true, email: true },
      });
      if (instructor) return NextResponse.json({ instructor });
    }
  }
  const anyInstructor = await db.user.findFirst({
    where: { role: "instructor", blocked: false },
    orderBy: { lastLogin: "desc" },
    select: { id: true, name: true, email: true },
  });
  if (anyInstructor) return NextResponse.json({ instructor: anyInstructor });
  return NextResponse.json({ instructor: null });
}
