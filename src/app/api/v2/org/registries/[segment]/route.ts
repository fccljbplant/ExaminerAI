/**
 * /api/v2/org/registries/[segment] — O3 Registries editor (REDESIGN-P4 §2 O3, W7)
 *
 * One dynamic segment, three methods (sibling [kind]/[id] routes would
 * collide — Next dynamic segments at the same level must be unique):
 *   GET  [segment=kind]  → merged platform defaults + org overrides
 *   POST [segment=kind]  → upsert org-scoped row (zero-code domains)
 *   PATCH [segment=rowId] → enable/disable an org-scoped row (audited;
 *                         platform defaults are read-only — 404)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import {
  getOrgContext,
  listRegistries,
  REGISTRY_KINDS,
  setRegistryActive,
  upsertRegistry,
  type RegistryKind,
} from "@/modules/org-portal/lib/org-db";
import { isOrgPortalEnabled } from "@/modules/org-portal/lib/flag";
import { orgErrorResponse } from "@/modules/org-portal/lib/http";

export const runtime = "nodejs";

const ORG_ROLES = new Set(["org_admin", "platform_admin"]);

const UpsertBody = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  config: z.record(z.string(), z.unknown()).optional(),
});

const ActiveBody = z.object({ isActive: z.boolean() });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ segment: string }> },
) {
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

  const { segment } = await params;
  if (!REGISTRY_KINDS.includes(segment as RegistryKind)) {
    return apiError("Unknown registry kind", "VALIDATION_ERROR", 400);
  }
  const kind = segment as RegistryKind;

  try {
    const items = await listRegistries(ctx.orgId, kind);
    return apiSuccess({ kind, items });
  } catch (err) {
    return orgErrorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ segment: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("updating a registry");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const { segment } = await params;
  if (!REGISTRY_KINDS.includes(segment as RegistryKind)) {
    return apiError("Unknown registry kind", "VALIDATION_ERROR", 400);
  }
  const kind = segment as RegistryKind;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = UpsertBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid registry body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  try {
    const row = await upsertRegistry(
      ctx.orgId,
      { id: user.sub, name: user.name, role: user.role },
      { kind, ...parsed.data },
    );
    return apiSuccess({ row }, 201);
  } catch (err) {
    return orgErrorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ segment: string }> },
) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!ORG_ROLES.has(user.role)) {
    return apiError("Org access only", "FORBIDDEN", 403);
  }
  if (!(await isOrgPortalEnabled())) {
    return apiError("Org portal is not enabled yet", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("changing a registry row");
  if (demoBlock) return demoBlock;

  const ctx = await getOrgContext(user.sub);
  if (!ctx) return apiError("You are not part of an organization", "FORBIDDEN", 403);

  const { segment } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);
  const parsed = ActiveBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid body", "VALIDATION_ERROR", 400);
  }

  try {
    const row = await setRegistryActive(
      ctx.orgId,
      segment,
      { id: user.sub, name: user.name, role: user.role },
      parsed.data.isActive,
    );
    return apiSuccess({ row });
  } catch (err) {
    return orgErrorResponse(err);
  }
}
