import { hasRole, PLATFORM_ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getCacheStats, clearTokenCache } from "@/modules/assessment/lib/token-cache";
import { getCacheOverview, clearNamespace, evictExpired } from "@/modules/ai";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/admin/cache — token-cache stats for the admin dashboard.
 *
 *  Two cache layers, both visible:
 *    • memory — the in-memory response cache inside callAI (hits/misses/
 *      evictions/hit-rate/estimated tokens saved per process)
 *    • namespaces — the per-subject context packs (course-outline,
 *      tutor-topic, learner, cohort, project), DB-backed + encrypted,
 *      with per-namespace entries/hits/misses/tokens-saved
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, PLATFORM_ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await evictExpired();
  const memory = getCacheStats();
  const namespaces = await getCacheOverview();
  const totals = namespaces.reduce(
    (acc, n) => {
      acc.entries += n.entries;
      acc.hits += n.hits;
      acc.misses += n.misses;
      acc.tokensSaved += n.tokensSaved;
      return acc;
    },
    { entries: 0, hits: 0, misses: 0, tokensSaved: 0 },
  );
  return NextResponse.json({ stats: memory, namespaces, totals });
}

/** DELETE /api/admin/cache[?namespace=...] — clears the token cache.
 *  Without a namespace: clears the in-memory response cache.
 *  With ?namespace=learner (or any pack namespace): clears just that
 *  subject's context cache — e.g. after re-seeding or a curriculum edit. */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("clearing cache"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, PLATFORM_ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const namespace = url.searchParams.get("namespace");
  if (namespace) {
    const cleared = await clearNamespace(namespace);
    return NextResponse.json({ ok: true, message: `Cleared ${cleared} entries in "${namespace}".` });
  }
  clearTokenCache();
  return NextResponse.json({ ok: true, message: "Token cache cleared." });
}
