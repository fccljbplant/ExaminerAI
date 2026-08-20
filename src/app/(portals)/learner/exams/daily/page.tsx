import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { SocraticDaily } from "@/modules/assessment";
import { StateEmpty } from "@/modules/ui-v3";
import Link from "next/link";

/**
 * /learner/exams/daily — Socratic daily test.
 *
 * Course-scoped (2026-08-18 audit): resolves the learner's first
 * enrolled course server-side and passes courseId into the panel, so
 * the test always targets the student's actual course topic — never a
 * course-blind default.
 */

export const metadata: Metadata = {
  title: "Daily test — TraineesAI",
};

export default async function LearnerDailyTestPage() {
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
        headline="Daily test"
        description="Enroll in a course first — the daily test follows the course you're learning."
        cta={
          <Link href="/learner/learn" className="v3-btn v3-btn-primary">
            Browse courses →
          </Link>
        }
      />
    );
  }

  return <SocraticDaily courseId={enrollment.courseId} />;
}
