/**
 * modules/submission/lib/submission-flag.ts — W4 single flag source
 *
 * Every W4 surface (v2 routes, crons, pages) gates through this helper so
 * the rollout flag name can never fork. Setting:
 *   feature_portal_submissions_v2          (global)
 *   feature_portal_submissions_v2_org:<id> (org override)
 * Default OFF — fails closed to the legacy portal.
 */

import { isPortalEnabled } from "@/lib/feature-flags";

export function isSubmissionsEnabled(orgId?: string | null): Promise<boolean> {
  return isPortalEnabled("submissions", orgId);
}
