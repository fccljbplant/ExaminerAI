import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/onboarding/status — one-shot onboarding progress check.
 *
 * Returns the per-step completion flags for the OnboardingGuide card so
 * the client doesn't have to fan out to four different endpoints.
 *
 * Response shape:
 *   {
 *     hasEnrollment: boolean,       // Step 2
 *     hasDailyLog: boolean,         // Step 3
 *     hasCompletedTest: boolean,    // Step 4 — weekly OR daily test
 *     hasCredential: boolean        // Step 5
 *   }
 *
 * Step 1 (visited /courses) is tracked client-side via localStorage —
 * the server has no way to know if the user has visited the marketplace.
 *
 * Auth required. Students only.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "student") {
    return NextResponse.json(
      { error: "Onboarding is for student accounts" },
      { status: 403 }
    );
  }

  // Run all four checks in parallel — one round-trip total.
  const [enrollmentCount, dailyLogCount, completedWeeklyTestCount, completedDailyTestCount, certificateCount] = await Promise.all([
    db.courseEnrollment.count({
      where: { userId: user.id, role: "student" },
    }),
    db.dailyLog.count({ where: { userId: user.id } }),
    db.weeklyTest.count({
      where: { userId: user.id, status: "completed" },
    }),
    db.dailyTest.count({
      where: { userId: user.id, status: "completed" },
    }),
    db.certificate.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    hasEnrollment: enrollmentCount > 0,
    hasDailyLog: dailyLogCount > 0,
    // "Has completed a test" — either a weekly test OR a daily test counts.
    hasCompletedTest: completedWeeklyTestCount > 0 || completedDailyTestCount > 0,
    hasCredential: certificateCount > 0,
  });
}
