import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { SocraticWeeklyTest } from "@/modules/assessment";
import { StateEmpty } from "@/modules/ui-v3";
import Link from "next/link";

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
      <StateEmpty
        headline="Weekly test"
        description="Enroll in a course first — the weekly test follows the course you're learning."
        cta={
          <Link href="/learner/learn" className="v3-btn v3-btn-primary">
            Browse courses →
          </Link>
        }
      />
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
