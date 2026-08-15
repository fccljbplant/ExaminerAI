/**
 * GET/PUT /api/v2/org/settings — O4 Control Center (REDESIGN-P4 §2 O4, W7)
 *
 * GET: current branding (org-theme:<orgId> Setting). PUT: branding
 * (brandHex/mode) — audited. The client previews the derived palette
 * live via deriveBrandPalette before saving.
 *
 * Portal rollout flags are deliberately NOT writable here (2026-08-15
 * audit 9.2): they are global platform rows, so an org admin writing
 * them would flip portals for EVERY org. Platform Admin → Features is
 * the only writer.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { getOrgContext, getOrgSettings, updateOrgSettings } from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const PutBody = z
  .object({
    branding: z
      .object({
        brandHex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "brandHex must be #RRGGBB")
          .optional(),
        mode: z.enum(["light", "dark", "bed"]).optional(),
      })
      .optional(),
    flags: z.record(z.string().min(1).max(40), z.boolean()).optional(),
  })
  .strict();

export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  try {
    const settings = await getOrgSettings(ctx.orgId);
    return apiSuccess(settings);
  } catch (err) {
    return orgErrorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("updating org settings");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = PutBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid settings body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }
  if (parsed.data.flags) {
    return apiError(
      "Portal rollout flags are platform-level — manage them in Platform Admin → Features",
      "FORBIDDEN",
      403,
    );
  }

  try {
    const result = await updateOrgSettings(
      ctx.orgId,
      { id: user.sub, name: user.name, role: user.role },
      parsed.data,
    );
    return apiSuccess(result);
  } catch (err) {
    return orgErrorResponse(err);
  }
}
