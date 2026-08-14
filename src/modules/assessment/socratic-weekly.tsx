"use client";

import { SocraticShell } from "./components/socratic-shell";
import { WeeklyTestPanel } from "./components/WeeklyTestPanel";

/**
 * modules/assessment — SocraticWeeklyTest (W10 audit: concept restored)
 *
 * Standalone entry for the classic 10-question Socratic weekly test —
 * wraps the restored WeeklyTestPanel in the SocraticShell so it runs
 * as its own v2 page (mode switch is a no-op outside the old
 * dashboard).
 */

export function SocraticWeeklyTest() {
  return (
    <SocraticShell
      render={({ stats, reload }) => (
        <WeeklyTestPanel stats={stats} onReload={reload} onMode={() => undefined} />
      )}
    />
  );
}
