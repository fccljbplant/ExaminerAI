import type { Metadata } from "next";
import { SocraticWeeklyTest } from "@/modules/assessment";

/**
 * /learner/exams/weekly — Socratic weekly test (V1 concept restored).
 *
 * The classic 10-question Socratic conversation with the AI examiner
 * (15 question-type rotation, probing replies, per-question teaching
 * feedback) — alongside the v2 runner.
 */

export const metadata: Metadata = {
  title: "Weekly test — TraineesAI",
};

export default function LearnerWeeklyTestPage() {
  return <SocraticWeeklyTest />;
}
