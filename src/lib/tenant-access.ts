/**
 * src/lib/tenant-access.ts — tenant lifecycle access checks (2026-08-17)
 *
 * Single source of truth for "is this user's organization suspended or
 * pending approval". Used by the login route (reject) and the portal
 * layouts (redirect) so a suspended tenant can never reach its
 * workspace.
 */

import { db } from "./db";

export interface TenantBlock {
  orgId: string;
  orgName: string;
  status: "suspended" | "pending";
}

/** The blocked tenant (suspended or pending) for a user's active org
 *  membership, or null when the user has no such block. */
export async function getTenantBlock(userId: string): Promise<TenantBlock | null> {
  const membership = await db.orgMember.findFirst({
    where: { userId, status: "active" },
    select: { orgId: true, org: { select: { name: true, status: true } } },
  });
  if (!membership) return null;
  const status = membership.org.status;
  if (status === "suspended" || status === "pending") {
    return { orgId: membership.orgId, orgName: membership.org.name, status };
  }
  return null;
}
