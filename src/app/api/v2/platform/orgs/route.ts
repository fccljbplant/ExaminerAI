/**
 * GET /api/v2/platform/orgs — SaaS Tenants list (2026-08-17)
 *
 * Platform-admin tenant roster with optional ?search= filtering over
 * name/slug. Lifecycle actions live on /api/v2/platform/orgs/[id].
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { listTenants } from "@/modules/platform-portal/lib/platform-db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const search = req.nextUrl.searchParams.get("search")?.trim() || undefined;
  const tenants = await listTenants(search);
  return apiSuccess({ tenants });
}
