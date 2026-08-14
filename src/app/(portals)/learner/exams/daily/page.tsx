import type { Metadata } from "next";
import { SocraticDaily } from "@/modules/assessment";

/**
 * /learner/exams/daily — Socratic daily test (V1 concept restored).
 *
 * Three concept questions for the current course day, with probing
 * replies and per-question feedback — the same engine as practice and
 * the weekly test.
 */

export const metadata: Metadata = {
  title: "Daily test — TraineesAI",
};

export default function LearnerDailyTestPage() {
  return <SocraticDaily />;
}
