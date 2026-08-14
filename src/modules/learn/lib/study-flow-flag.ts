// src/modules/learn/lib/study-flow-flag.ts — W3 rollout flag (single source).

import { isPortalEnabled } from "@/lib/feature-flags";

/**
 * True once the W3 study-flow engine is live for this org (Setting
 * `feature_portal_study_flow_v2` or the `_org:<id>` override, default
 * off). Fails closed — legacy drill routes keep serving until flipped.
 *
 * Every W3 surface (v2 routes, L12 page, crons) routes through this one
 * helper so the flag name never forks across the codebase.
 */
export function isStudyFlowEnabled(orgId?: string | null): Promise<boolean> {
  return isPortalEnabled("study_flow", orgId);
}
