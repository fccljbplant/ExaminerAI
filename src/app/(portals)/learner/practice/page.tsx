import type { Metadata } from "next";
import { SocraticPractice } from "@/modules/assessment";
import { RoleplayPractice } from "@/modules/learner-portal/roleplay";

/**
 * /learner/practice — practice hub (2026-08-16):
 *
 *  - Socratic AI practice (V1 concept restored, W10 audit): a Socratic
 *    conversation with the AI examiner over a week + topic.
 *  - Roleplay practice: scenario-based conversations with AI personas
 *    (customer service, negotiation, sales discovery), scored turn by
 *    turn via the roleplay engine.
 */

export const metadata: Metadata = {
  title: "Practice — TraineesAI",
};

export default function LearnerPracticePage() {
  return (
    <div className="space-y-8">
      <SocraticPractice />
      <hr className="border-line" />
      <RoleplayPractice />
    </div>
  );
}
