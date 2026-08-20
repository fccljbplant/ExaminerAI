import type { Metadata } from "next";
import { CoursePlanner } from "@/modules/platform-portal";
import { V3Wrapper } from "@/modules/ui-v3";

/** /platform/courses/planner — course studio (W16: V1 CoursePlanner restored).
 *  P1c.17: v3 wrapper around v2 CoursePlanner (922 lines — too complex
 *  to fully restyle in P1c). */

export const metadata: Metadata = { title: "Course planner — TraineesAI" };

export default function CoursePlannerPage() {
  return (
    <V3Wrapper
      title="Course planner"
      subtitle="Design course structure — weeks, days, topics, deliverables, and assessment rubric."
    >
      <CoursePlanner />
    </V3Wrapper>
  );
}
