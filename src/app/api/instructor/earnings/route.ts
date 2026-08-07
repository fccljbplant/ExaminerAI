import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/instructor/earnings
 *
 * Auth: required (instructor OR admin).
 *
 * Returns the calling instructor's revenue summary:
 *   - totalEarnings:  sum of all `amount`s (gross).
 *   - platformFees:   sum of platformFee (20% cut).
 *   - netEarnings:    sum of instructorShare (80% cut).
 *   - monthlyData:    earnings grouped by YYYY-MM (newest first).
 *   - topCourses:     earnings + sales grouped by course (sorted desc, top 10).
 *   - recentSales:    latest 10 payments with student + course names.
 *
 * Scoping:
 *   - Instructors: only payments on courses they teach (via CourseEnrollment
 *     where role = "instructor").
 *   - Admins: all payments platform-wide.
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = hasRole(payload.role, ADMIN_ROLES);
  const isInstructor = normalizeRoleIsInstructor(payload.role);
  if (!isAdmin && !isInstructor) {
    return NextResponse.json(
      { error: "Forbidden — instructor or admin role required" },
      { status: 403 },
    );
  }

  try {
    // Determine which courseIds to scope the query to.
    // For admins → all courses (no filter).
    // For instructors → courses they're enrolled in as role="instructor".
    let courseFilter: { courseId?: { in: string[] } } = {};
    if (!isAdmin) {
      const instructorEnrollments = await db.courseEnrollment.findMany({
        where: { userId: payload.sub, role: "instructor" },
        select: { courseId: true },
      });
      const instructorCourseIds = instructorEnrollments.map(e => e.courseId);
      if (instructorCourseIds.length === 0) {
        // Instructor with no courses — return empty result set.
        return NextResponse.json(emptyEarnings());
      }
      courseFilter = { courseId: { in: instructorCourseIds } };
    }

    // Fetch all completed payments in scope.
    // Status filter: "completed" only — excludes refunded / pending.
    const payments = await db.payment.findMany({
      where: { ...courseFilter, status: "completed" },
      select: {
        id: true,
        amount: true,
        platformFee: true,
        instructorShare: true,
        currency: true,
        createdAt: true,
        courseId: true,
        userId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000, // safety cap — page-through if we ever exceed this
    });

    if (payments.length === 0) {
      return NextResponse.json(emptyEarnings());
    }

    // --- Aggregates ---
    const totalEarnings = round2(payments.reduce((s, p) => s + p.amount, 0));
    const platformFees = round2(payments.reduce((s, p) => s + p.platformFee, 0));
    const netEarnings = round2(payments.reduce((s, p) => s + p.instructorShare, 0));

    // --- Monthly breakdown (YYYY-MM, newest first) ---
    const monthMap = new Map<string, { earnings: number; sales: number }>();
    for (const p of payments) {
      const key = formatMonthKey(p.createdAt);
      const entry = monthMap.get(key) ?? { earnings: 0, sales: 0 };
      entry.earnings += p.amount;
      entry.sales += 1;
      monthMap.set(key, entry);
    }
    const monthlyData = Array.from(monthMap.entries())
      .map(([month, v]) => ({ month, earnings: round2(v.earnings), sales: v.sales }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));

    // --- Top courses by earnings ---
    const courseMap = new Map<string, { sales: number; earnings: number }>();
    for (const p of payments) {
      const entry = courseMap.get(p.courseId) ?? { sales: 0, earnings: 0 };
      entry.sales += 1;
      entry.earnings += p.amount;
      courseMap.set(p.courseId, entry);
    }
    const courseIds = Array.from(courseMap.keys());
    const courseMeta = await db.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, name: true },
    });
    const courseNameById = new Map(courseMeta.map(c => [c.id, c.name]));
    const topCourses = Array.from(courseMap.entries())
      .map(([courseId, v]) => ({
        courseId,
        courseName: courseNameById.get(courseId) ?? "Unknown course",
        sales: v.sales,
        earnings: round2(v.earnings),
      }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 10);

    // --- Recent sales (latest 10) with student + course names ---
    const recentPaymentIds = payments.slice(0, 10);
    const userIds = Array.from(new Set(recentPaymentIds.map(p => p.userId)));
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userNameById = new Map(users.map(u => [u.id, u.name]));
    const recentSales = recentPaymentIds.map(p => ({
      studentName: anonymizeName(userNameById.get(p.userId) ?? "Student"),
      courseName: courseNameById.get(p.courseId) ?? "Unknown course",
      amount: round2(p.amount),
      currency: p.currency,
      date: p.createdAt.toISOString(),
    }));

    return NextResponse.json({
      totalEarnings,
      platformFees,
      netEarnings,
      monthlyData,
      topCourses,
      recentSales,
    });
  } catch (err) {
    logger.error("Failed to fetch instructor earnings", {
      userId: payload.sub,
      role: payload.role,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to load earnings" },
      { status: 500 },
    );
  }
}

// ============================================================
// Helpers
// ============================================================

function emptyEarnings() {
  return {
    totalEarnings: 0,
    platformFees: 0,
    netEarnings: 0,
    monthlyData: [],
    topCourses: [],
    recentSales: [],
  };
}

/** Normalize a role string and check if it's "instructor" (incl. legacy aliases). */
function normalizeRoleIsInstructor(role: string): boolean {
  const r = (role || "").toLowerCase();
  return r === "instructor" || r === "teacher" || r === "teaching_assistant";
}

/** Round to 2 decimal places — avoids float drift in JS sums. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format a Date as "YYYY-MM" (UTC). */
function formatMonthKey(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Anonymize a student's full name to "FirstName L." (last initial only).
 *  Earnings dashboards shouldn't expose full student names to instructors
 *  who may not be the student's actual teacher. */
function anonymizeName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Student";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
