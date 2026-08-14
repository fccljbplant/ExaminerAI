import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isExamsEnabled } from "@/modules/assessment/lib/exam-flag";
import { ExamResults } from "@/modules/learner-portal";

/**
 * /learner/exams/[id]/results — L10 Exam results (REDESIGN-P3 §L10, W5).
 * Flag-gated like every W5 surface.
 */

export const metadata: Metadata = {
  title: "Exam results — TraineesAI",
};

export default async function LearnerExamResultsPage({
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
  return <ExamResults examId={id} />;
}
