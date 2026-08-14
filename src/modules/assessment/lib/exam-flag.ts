/**
 * modules/assessment/lib/exam-flag.ts — W5 single flag source
 *
 * Every W5 surface (v2 exam routes, runner/results pages) gates through
 * this helper so the rollout flag name can never fork. Setting:
 *   feature_portal_exams_v2          (global)
 *   feature_portal_exams_v2_org:<id> (org override)
 * Default OFF — fails closed to the legacy test flows.
 */

import { isPortalEnabled } from "@/lib/feature-flags";

export function isExamsEnabled(orgId?: string | null): Promise<boolean> {
  return isPortalEnabled("exams", orgId);
}
