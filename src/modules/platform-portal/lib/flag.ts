/**
 * modules/platform-portal/lib/flag.ts — W7 single flag source
 */

import { isPortalEnabled } from "@/lib/feature-flags";

export function isPlatformPortalEnabled(): Promise<boolean> {
  return isPortalEnabled("platform");
}
