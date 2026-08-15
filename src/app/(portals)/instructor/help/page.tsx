import type { Metadata } from "next";
import { RoleHelp, type HelpTopic } from "@/modules/shell/role-help";

/**
 * /instructor/help — instructor help (2026-08-15).
 */

export const metadata: Metadata = {
  title: "Help — TraineesAI",
};

const TOPICS: HelpTopic[] = [
  {
    q: "How does the review queue work?",
    a: "New submissions land in Grading → Review queue. Open one to see the learner's evidence, leave feedback on the thread, grade against the rubric, and approve or request changes. Approvals with sign-off complete the cycle.",
  },
  {
    q: "How do I approve a student's project?",
    a: "Open Students → the learner → Project approvals. Review the proposal and approve or reject it with a note. Once approved, the learner can generate their AI timeline and tasks.",
  },
  {
    q: "How do I send announcements to my students?",
    a: "Use Messages → outreach to draft a note to your enrolled students. The AI assistant on your home page can draft the message for you.",
  },
  {
    q: "Where are my earnings?",
    a: "More → Earnings shows your revenue share (80% of every paid enrollment) with a monthly breakdown and per-course totals.",
  },
  {
    q: "How do I change my photo, theme or password?",
    a: "Open the avatar menu (top-right) → Settings — or the Theme section of the same menu for a quick switch.",
  },
];

export default function InstructorHelpPage() {
  return <RoleHelp title="Instructor help" topics={TOPICS} />;
}
