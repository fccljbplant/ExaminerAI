import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { SocraticDaily } from "@/modules/assessment";

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
      <main className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-lg font-semibold text-fg">Daily test</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Enroll in a course first — the daily test follows the course you&apos;re learning.
        </p>
      </main>
    );
  }

  return <SocraticDaily courseId={enrollment.courseId} />;
}
