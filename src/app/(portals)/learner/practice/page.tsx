import type { Metadata } from "next";
import { SocraticPractice } from "@/modules/assessment";

/**
 * /learner/practice — Socratic AI practice (V1 concept restored,
 * W10 audit: the Socratic examiner was never meant to be deleted).
 *
 * Pick a week + topic and have a Socratic conversation with the AI
 * examiner: it asks, probes your answers, and teaches — the original
 * concept-based testing experience, re-skinned on the v2 tokens.
 */

export const metadata: Metadata = {
  title: "Socratic practice — TraineesAI",
};

export default function LearnerPracticePage() {
  return <SocraticPractice />;
}
