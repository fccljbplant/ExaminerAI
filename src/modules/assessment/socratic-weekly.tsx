"use client";

import { WeeklyTestPanel } from "./components/WeeklyTestPanel";

/**
 * modules/assessment — SocraticWeeklyTest
 *
 * Course-scoped weekly test (2026-08-18 audit): the host page resolves
 * the learner's enrolled course + current progression week server-side
 * and passes both through — the panel never derives context from the
 * first enrollment or the legacy User.currentWeek.
 */

export function SocraticWeeklyTest({
  courseId,
  week,
  weekLabel,
}: {
  courseId: string;
  week: number;
  weekLabel?: string;
}) {
  return <WeeklyTestPanel courseId={courseId} week={week} weekLabel={weekLabel} />;
}
