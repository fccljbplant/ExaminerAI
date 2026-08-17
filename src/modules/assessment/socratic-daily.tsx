"use client";

import { DailyTestPanel } from "./components/DailyTestPanel";

/**
 * modules/assessment — SocraticDaily
 *
 * Standalone entry for the V1 daily Socratic test (3 questions, one
 * per course day). Course-scoped (2026-08-18 audit): the host page
 * resolves the learner's enrolled course and passes courseId through —
 * the panel is never course-blind.
 */

export function SocraticDaily({ courseId }: { courseId: string }) {
  return <DailyTestPanel courseId={courseId} />;
}
