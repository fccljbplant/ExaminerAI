import type { ReactNode } from "react";
import { getAuthUser } from "@/lib/auth";
import { homeForRole } from "@/lib/portal-home";
import { db } from "@/lib/db";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace";
import { SiteHeader, SiteFooter } from "@/modules/site";

/**
 * (public)/layout.tsx — shared storefront chrome (2026-08-15)
 *
 * Every public page now gets ONE header (announcement bar, nav, course
 * search, category strip, auth state) and ONE footer. Previously each
 * page hand-rolled its own banner — several had no chrome at all and
 * nothing had a footer.
 *
 * Note: /learn (the classroom + legacy catalog) lives in the sibling
 * (classroom) group so it skips this chrome.
 */

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  const dashboardHref = user ? homeForRole(user.role) : "/login";

  const categoryCounts = await db.course
    .groupBy({
      by: ["category"],
      where: { published: true },
      _count: { _all: true },
    })
    .catch(
      () => [] as { category: string; _count: { _all: number } }[],
    );
  const countByCategory = new Map<string, number>(
    categoryCounts.map((c) => [c.category, c._count._all] as [string, number]),
  );
  const categories = MARKETPLACE_CATEGORIES.filter(
    (c) => (countByCategory.get(c.value) ?? 0) > 0,
  ).map((c) => ({ value: c.value, label: c.label, count: countByCategory.get(c.value) ?? 0 }));

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <SiteHeader categories={categories} signedIn={Boolean(user)} dashboardHref={dashboardHref} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
