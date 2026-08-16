/**
 * GET/PUT /api/v2/platform/orgs/[id]/flags — per-org portal flag overrides
 * (2026-08-17). Writes feature_portal_<name>_v2_org:<orgId> Setting rows —
 * the resolution order the feature-flags module already reads. This is the
 * missing writer that turns org-scoped pilot rollouts into a real feature.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { isPlatformPortalEnabled } from "@/modules/platform-portal/lib/flag";
import { getOrgFlagOverrides, setOrgFlagOverride } from "@/modules/platform-portal/lib/platform-db";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

const PutBody = z.object({
  key: z.string().regex(/^feature_portal_[a-z_]+_v2$/, "Invalid portal flag key"),
  enabled: z.boolean(),
});

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
  return apiSuccess({ overrides: await getOrgFlagOverrides(id) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin();
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = PutBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const result = await setOrgFlagOverride(id, parsed.data.key, parsed.data.enabled);
  if (!result.ok) return apiError(result.error ?? "Failed to set override", "INVALID_INPUT", 400);

  await logAudit({
    actor: { id: auth.user.sub, name: auth.user.name, role: auth.user.role },
    action: "feature_flag.org_override",
    target: { type: "organization", id },
    after: { key: parsed.data.key, enabled: parsed.data.enabled },
    metadata: { source: "platform_tenants" },
    req,
  }).catch(() => {});

  return apiSuccess({ overrides: await getOrgFlagOverrides(id) });
}
