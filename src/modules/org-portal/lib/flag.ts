/**
 * modules/org-portal/lib/flag.ts — W7 single flag source
 *
 * Every W7 org surface gates through this helper (feature_portal_org_v2).
 */

import { isPortalEnabled } from "@/lib/feature-flags";

export function isOrgPortalEnabled(orgId?: string | null): Promise<boolean> {
  return isPortalEnabled("org", orgId);
}
