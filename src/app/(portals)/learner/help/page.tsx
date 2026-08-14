import type { Metadata } from "next";
import { LearnerHelp } from "@/modules/learner-portal";

/**
 * /learner/help — L14 Help (REDESIGN-P3 §L14), reached from Profile.
 */

export const metadata: Metadata = {
  title: "Help — TraineesAI",
};

export default function LearnerHelpPage() {
  return <LearnerHelp />;
}
