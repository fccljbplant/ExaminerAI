/**
 * GET /api/cron/audit-retention — audit log retention (weekly).
 *
 * Deletes AuditLog rows older than RETENTION_DAYS (400) to keep the
 * audit tables bounded. Retention is deliberately generous; operators
 * needing longer history use the server-side CSV export first
 * (Platform → Audit → Server export).
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isCronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 400;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const result = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

  return Response.json({
    ok: true,
    data: { retentionDays: RETENTION_DAYS, purged: result.count, cutoff: cutoff.toISOString() },
  });
}
