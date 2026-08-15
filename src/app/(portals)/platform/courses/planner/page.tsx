import type { Metadata } from "next";
import { CoursePlanner } from "@/modules/platform-portal";

/** /platform/courses/planner — course studio (W16: V1 CoursePlanner restored). */

export const metadata: Metadata = { title: "Course planner — TraineesAI" };

export default function CoursePlannerPage() {
  return <CoursePlanner />;
}
