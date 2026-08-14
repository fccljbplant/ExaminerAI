import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isExamsEnabled } from "@/modules/assessment/lib/exam-flag";
import { ExamRunner } from "@/modules/learner-portal";

/**
 * /learner/exams/[id] — L9 Exam runner (REDESIGN-P3 §L9, W5).
 *
 * [id] is the exam slug (daily-<courseId>-<date> | weekly-<courseId>-<week>).
 * Flag-gated like every W5 surface — bounces to the Exams tab when off.
 */

export const metadata: Metadata = {
  title: "Exam — TraineesAI",
};

export default async function LearnerExamRunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const membership = await db.orgMember.findFirst({
      where: { userId: user.id, status: "active" },
      select: { orgId: true },
    });
    if (!(await isExamsEnabled(membership?.orgId))) {
      redirect("/learner/exams");
    }
  }

  const { id } = await params;
  return <ExamRunner examId={id} />;
}
