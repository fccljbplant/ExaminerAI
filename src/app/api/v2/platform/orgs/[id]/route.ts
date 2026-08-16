/**
 * GET/PATCH /api/v2/platform/orgs/[id] — tenant detail + lifecycle
 * (2026-08-17 SaaS control plane)
 *
 * GET: tenant row + subscription + invoices + per-org flag overrides.
 * PATCH: { plan?, seats?, status?, trialEndsAt?, suspendedReason? } —
 * suspend/unsuspend, extend trial, adjust plan/seats. Audited.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError, apiNotFound } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { getTenantDetail, updateTenant } from "@/modules/platform-portal/lib/platform-db";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

const PatchBody = z
  .object({
    plan: z.string().min(1).max(30).optional(),
    seats: z.number().int().min(1).max(100000).optional(),
    status: z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
    trialEndsAt: z.string().nullable().optional(),
    suspendedReason: z.string().max(500).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" });

async function requirePlatformAdmin() {
  const user = await getAuthUser();
  if (!user) return { denied: apiUnauthorized() };
  if (user.role !== "platform_admin" && user.role !== "admin") {
    return { denied: apiError("Platform access only", "FORBIDDEN", 403) };
  }
  if (!(await isPlatformPortalEnabled())) {
    return { denied: apiError("Platform portal is not enabled yet", "FORBIDDEN", 403) };
  }
  return { user };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin();
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const tenant = await getTenantDetail(id);
  if (!tenant) return apiNotFound("Organization not found");
  return apiSuccess({ tenant });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin();
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid update payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const result = await updateTenant(id, parsed.data);
  if (!result.ok) return apiError(result.error ?? "Failed to update tenant", "INVALID_INPUT", 400);

  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "tenant_updated",
    target: { type: "organization", id },
    after: parsed.data,
    metadata: { source: "platform_tenants" },
    req,
  }).catch(() => {});

  const tenant = await getTenantDetail(id);
  return apiSuccess({ tenant });
}
