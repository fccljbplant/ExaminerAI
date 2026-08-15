/**
 * GET /api/v2/org/check-name — name/slug availability for the org's
 * public storefront address (2026-08-15).
 *
 * Query: ?name=Inzet Enterprises   (display name — slugified then checked)
 *        ?slug=inzetenterprises    (explicit slug)
 *
 * Returns { available, slug, reason } — checked against the slug
 * pattern, the reserved platform list and existing organizations.
 */

import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { getOrgContext, checkOrgSlug } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { slugifyOrgName } from "@/modules/site/lib/org-storefront";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "org_admin" && user.role !== "platform_admin") {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  const slugParam = url.searchParams.get("slug");
  if (!name && !slugParam) {
    return apiError("Pass ?name= or ?slug=", "VALIDATION_ERROR", 400);
  }

  const candidate = (slugParam ?? slugifyOrgName(name ?? "")).toLowerCase().trim();
  const check = await checkOrgSlug(candidate, ctx.orgId);
  return apiSuccess(check);
}
