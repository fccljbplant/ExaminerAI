import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getCacheStats, clearTokenCache } from "@/modules/assessment/lib/token-cache";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/admin/cache — returns token cache stats for the admin dashboard.
 *
 *  Stats: size, hits, misses, evictions, hit rate, estimated tokens saved.
 *  Useful for verifying the cache is working and quantifying the savings.
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ stats: getCacheStats() });
}

/** DELETE /api/admin/cache — clears the token cache.
 *
 *  Useful when debugging AI responses (forces fresh calls) or when the
 *  admin wants to reclaim memory. Stats counters are NOT reset — they
 *  persist across clears for long-run visibility.
 */
export async function DELETE() {
  const _demoBlock = await demoWriteBlock("clearing cache"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  clearTokenCache();
  return NextResponse.json({ ok: true, message: "Token cache cleared." });
}
