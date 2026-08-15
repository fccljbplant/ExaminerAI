import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * /learner/exams/[id]/results — W12: the v2 runner results page is
 * retired with the runner; legacy links resolve to the Socratic
 * surfaces (the panels render their own results inline).
 */

export const metadata: Metadata = {
  title: "Exam results — TraineesAI",
};

export default async function LearnerExamResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(id.startsWith("w_") ? "/learner/exams/weekly" : "/learner/exams/daily");
}
