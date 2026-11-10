import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { SocraticWeeklyTest } from "@/modules/assessment";

export const metadata: Metadata = {
  title: "Weekly test — TraineesAI",
};

function CourseChoices({ courses }: { courses: Array<{ courseId: string; name: string }> }) {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold text-fg">Choose a course</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Weekly tests are tied to one course. Choose the course you want to continue.
      </p>
      <ul className="mt-6 space-y-3">
        {courses.map((course) => (
          <li key={course.courseId}>
            <Link
              href={`/learner/exams/weekly?courseId=${encodeURIComponent(course.courseId)}`}
              className="flex min-h-12 items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span>{course.name}</span>
              <span aria-hidden="true" className="text-fg-muted">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default async function LearnerWeeklyTestPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { courseId: requestedCourseId } = await searchParams;
  const enrollments = await db.courseEnrollment.findMany({
    where: { userId: user.sub, role: "student" },
    orderBy: { enrolledAt: "asc" },
    select: { courseId: true, course: { select: { name: true } } },
  });
  const courses = enrollments.map((enrollment) => ({
    courseId: enrollment.courseId,
    name: enrollment.course.name,
  }));

  if (courses.length === 0) {
    return (
      <main className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-lg font-semibold text-fg">Weekly test</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Enroll in a course first — weekly tests follow the course you are learning.
        </p>
      </main>
    );
  }

  if (!requestedCourseId && courses.length > 1) {
    return <CourseChoices courses={courses} />;
  }

  const enrollment = courses.find((course) => course.courseId === requestedCourseId)
    ?? (courses.length === 1 && !requestedCourseId ? courses[0] : null);

  if (!enrollment) {
    return (
      <main className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-lg font-semibold text-fg">Course unavailable</h1>
        <p className="mt-2 text-sm text-fg-muted">
          This course is not part of your current enrolments. Choose an enrolled course to continue.
        </p>
        <Link
          href="/learner/exams/weekly"
          className="mt-4 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Choose a course
        </Link>
      </main>
    );
  }

  // Resolve the current week from this learner's progression in the selected course.
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId: enrollment.courseId } },
    select: { masteryMap: true },
  });
  const mastery = (profile?.masteryMap as { topicProgress?: { current?: { week?: number } } } | null) ?? {};
  const week = mastery.topicProgress?.current?.week ?? 1;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg">Weekly test</h1>
          <p className="text-sm text-fg-muted">{enrollment.name}</p>
        </div>
        {courses.length > 1 ? (
          <Link
            href="/learner/exams/weekly"
            className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Change course
          </Link>
        ) : null}
      </div>
      <SocraticWeeklyTest courseId={enrollment.courseId} week={week} weekLabel={`Week ${week}`} />
    </main>
  );
}
