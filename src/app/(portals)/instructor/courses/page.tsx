import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import Link from "next/link";

/**
 * /instructor/courses — I2 Course & Exam Studio placeholder (REDESIGN-P3 §I2).
 *
 * The studio (structure/lessons/assignments/quizzes/AI-config/versions/
 * publish) is its own workstream — until it lands, the tab shows an
 * honest empty state instead of a dead control.
 */

export const metadata: Metadata = {
  title: "Courses — TraineesAI",
};

export default function InstructorCoursesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Courses</h1>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-subtle text-fg">
          <LayoutTemplate className="h-7 w-7" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-fg">Course Studio — coming next</p>
        <p className="max-w-sm text-xs leading-relaxed text-fg-muted">
          The studio will let you build courses and exams from blocks — lessons, assignments
          with rubric grading, quizzes, AI configuration and versioned publishing. Your existing
          courses stay fully visible in the classroom until then.
        </p>
        <Link
          href="/instructor"
          className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
