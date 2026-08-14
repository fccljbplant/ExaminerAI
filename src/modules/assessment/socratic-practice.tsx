"use client";

import { SocraticShell } from "./components/socratic-shell";
import { QuestionPanel } from "./components/PracticePanel";

/**
 * modules/assessment — SocraticPractice (W10 audit: concept restored)
 *
 * Standalone entry for the Socratic practice conversation — wraps the
 * restored PracticePanel in the SocraticShell (learner stats fetch +
 * callbacks) so it runs as its own v2 page.
 */

export function SocraticPractice() {
  return (
    <SocraticShell
      render={({ stats, reload }) => (
        <QuestionPanel currentWeek={stats.stats.currentWeek} onAnswered={reload} stats={stats} />
      )}
    />
  );
}
