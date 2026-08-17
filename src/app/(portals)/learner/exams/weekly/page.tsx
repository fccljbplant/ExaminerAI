import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { SocraticWeeklyTest } from "@/modules/assessment";

/**
 * /learner/exams/weekly — weekly test.
 *
 * Course-scoped (2026-08-18 audit): resolves the learner's first
 * enrolled course and their CURRENT progression week (masteryMap
 * topicProgress.current.week) server-side, then renders the
 * course-scoped weekly panel — never the course-blind legacy flow.
 */

export const metadata: Metadata = {
  title: "Weekly test — TraineesAI",
};

export default async function LearnerWeeklyTestPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const enrollment = await db.courseEnrollment.findFirst({
    where: { userId: user.sub, role: "student" },
    orderBy: { enrolledAt: "asc" },
    select: { courseId: true },
  });
  if (!enrollment) {
    return (
      <main className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-lg font-semibold text-fg">Weekly test</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Enroll in a course first — the weekly test follows the course you&apos;re learning.
        </p>
      </main>
    );
  }

  // Current week from the learner's progression in THAT course.
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId: enrollment.courseId } },
    select: { masteryMap: true },
  });
  const mastery = (profile?.masteryMap as { topicProgress?: { current?: { week?: number } } } | null) ?? {};
  const week = mastery.topicProgress?.current?.week ?? 1;

  return <SocraticWeeklyTest courseId={enrollment.courseId} week={week} weekLabel={`Week ${week}`} />;
}
