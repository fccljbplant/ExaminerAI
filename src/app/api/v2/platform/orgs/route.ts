/**
 * GET/POST /api/v2/platform/orgs — SaaS Tenants list + manual create
 * (2026-08-17). Platform-admin tenant roster with ?search= filtering;
 * POST creates a tenant directly (name + optional slug/plan/seats).
 * Lifecycle actions live on /api/v2/platform/orgs/[id].
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { listTenants } from "@/modules/platform-portal/lib/platform-db";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, dashes").optional(),
  plan: z.string().min(1).max(30).optional(),
  seats: z.number().int().min(1).max(100000).optional(),
});

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

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return apiError("Platform access only", "FORBIDDEN", 403);
  }
  if (!(await isPlatformPortalEnabled())) {
    return apiError("Platform portal is not enabled yet", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const baseSlug = parsed.data.slug ?? parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  let slug = baseSlug;
  let suffix = 1;
  while (await db.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const org = await db.organization.create({
    data: {
      name: parsed.data.name.trim(),
      slug,
      plan: parsed.data.plan ?? "free",
      seats: parsed.data.seats ?? 5,
      status: "trial",
    },
  });

  await logAudit({
    actor: { id: user.sub, name: user.name, role: user.role },
    action: "tenant_created",
    target: { type: "organization", id: org.id },
    after: { name: org.name, slug: org.slug },
    metadata: { source: "platform_tenants" },
    req,
  }).catch(() => {});

  return apiSuccess({ tenant: { id: org.id, name: org.name, slug: org.slug } }, 201);
}
