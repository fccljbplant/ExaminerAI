"use client";

import { DailyTestPanel } from "./components/DailyTestPanel";

/**
 * modules/assessment — SocraticDaily (W11 audit: concept restored)
 *
 * Standalone entry for the V1 daily Socratic test (3 questions, one
 * per course day). The panel is self-contained (fetches its own
 * day/state), so no dashboard wrapper is needed.
 */

export function SocraticDaily() {
  return <DailyTestPanel />;
}
