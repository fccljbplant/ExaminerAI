import type { Metadata } from "next";
import { LearnerMessages } from "@/modules/learner-portal";

/** /learner/messages — learner↔instructor inbox (W11 audit: V1 Messages). */

export const metadata: Metadata = {
  title: "Messages — TraineesAI",
};

export default function LearnerMessagesPage() {
  return <LearnerMessages />;
}
