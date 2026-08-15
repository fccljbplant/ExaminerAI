import type { Metadata } from "next";
import { RoleHelp, type HelpTopic } from "@/modules/shell/role-help";

/**
 * /org/help — org admin help (2026-08-15).
 */

export const metadata: Metadata = {
  title: "Help — TraineesAI",
};

const TOPICS: HelpTopic[] = [
  {
    q: "How do I invite members and manage seats?",
    a: "Open People. Invite by email (the person signs up first, then the invite links them), assign mentor or admin roles, and toggle seats. Deactivation has an undo.",
  },
  {
    q: "How do I brand our portal?",
    a: "Control center → Branding: pick one brand color and it derives an accessible palette automatically. Upload your logo in Organization profile — it appears in the portal header and on member certificates.",
  },
  {
    q: "How do I set up our public storefront page?",
    a: "Control center → Organization profile sets your name, public address (checked for availability), description and website. Add courses to your catalog in the Public catalog section — they appear at your page instantly.",
  },
  {
    q: "How do I review what happened in the org?",
    a: "Reports → Full audit shows every org action, filterable and exportable to CSV.",
  },
  {
    q: "How do I change my photo, theme or password?",
    a: "Open the avatar menu (top-right) → Settings — or the Theme section of the same menu for a quick switch.",
  },
];

export default function OrgHelpPage() {
  return <RoleHelp title="Org admin help" topics={TOPICS} />;
}
