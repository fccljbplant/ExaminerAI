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
