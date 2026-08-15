import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * /learner/exams/[id] — W12: the v2 ExamSession runner has been removed
 * in favour of the Socratic testing system. Legacy runner links now
 * resolve to the Socratic equivalent: weekly slugs to the Socratic
 * weekly test, everything else to the Socratic daily test.
 */

export const metadata: Metadata = {
  title: "Exam — TraineesAI",
};

export default async function LearnerExamRunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(id.startsWith("w_") ? "/learner/exams/weekly" : "/learner/exams/daily");
}
