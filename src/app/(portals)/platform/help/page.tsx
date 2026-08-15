import type { Metadata } from "next";
import { RoleHelp, type HelpTopic } from "@/modules/shell/role-help";

/**
 * /platform/help — platform admin help (2026-08-15).
 */

export const metadata: Metadata = {
  title: "Help — TraineesAI",
};

const TOPICS: HelpTopic[] = [
  {
    q: "How do I approve or block users?",
    a: "Users → search, filter by role or status, then use the row menu to approve, block, change role or delete. Every action confirms first and is written to the audit log.",
  },
  {
    q: "How do I manage feature rollouts?",
    a: "Features lets you flip global features and the per-portal rollout flags. Changes are audited and take effect within the 30-second cache window.",
  },
  {
    q: "How do I manage organizations?",
    a: "The Overview shows every org with seats and member counts; Users covers individuals. Org-level branding and catalogs are managed by each org admin in their own Control center.",
  },
  {
    q: "What do the diagnostics mean?",
    a: "System shows live DB / AI / JWT health, environment presence, the cron schedule and the AI token cache with per-subject hit/miss. Purge a subject cache individually if a curriculum was edited.",
  },
  {
    q: "How do I change my photo, theme or password?",
    a: "Open the avatar menu (top-right) → Settings — or the Theme section of the same menu for a quick switch.",
  },
];

export default function PlatformHelpPage() {
  return <RoleHelp title="Platform admin help" topics={TOPICS} />;
}
