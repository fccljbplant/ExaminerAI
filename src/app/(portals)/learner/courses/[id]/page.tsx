import type { Metadata } from "next";
import { CourseDetail } from "@/modules/learner-portal";

/**
 * /learner/courses/[id] — L3 Course detail (REDESIGN-P3 §L3).
 */

export const metadata: Metadata = {
  title: "Course — TraineesAI",
};

export default async function LearnerCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CourseDetail courseId={id} />;
}
