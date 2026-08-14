import { db } from "./db";

/** Check if a feature flag is enabled. Returns true by default (all features on).
 *  Reads from the Setting table where key = "feature_{name}".
 *  Cached per-request via a simple module-level cache. */
const cache = new Map<string, boolean>();

export async function isFeatureEnabled(name: string): Promise<boolean> {
  if (cache.has(name)) return cache.get(name)!;
  try {
    const setting = await db.setting.findUnique({ where: { key: `feature_${name}` } });
    const enabled = setting ? setting.value === "true" : true; // default: enabled
    cache.set(name, enabled);
    // Clear cache after 30s so admin changes propagate
    setTimeout(() => cache.delete(name), 30_000);
    return enabled;
  } catch {
    return true; // default: enabled on error
  }
}

/**
 * Portal rollout flags (REDESIGN-P5 §2) — unlike feature flags these are
 * default-OFF: a portal only serves the v2 experience once flipped.
 *
 * Resolution order (first explicit setting wins):
 *   1. org override   feature_portal_<name>_v2_org:<orgId>
 *   2. global         feature_portal_<name>_v2
 *   3. fallback       false
 */
export async function isPortalEnabled(
  name: string,
  orgId?: string | null
): Promise<boolean> {
  const base = `feature_portal_${name}_v2`;
  try {
    if (orgId) {
      const orgSetting = await db.setting.findUnique({
        where: { key: `${base}_org:${orgId}` },
      });
      if (orgSetting) return orgSetting.value === "true";
    }
    const global = await db.setting.findUnique({ where: { key: base } });
    return global ? global.value === "true" : false;
  } catch {
    return false; // rollout flags fail closed to the legacy portal
  }
}
