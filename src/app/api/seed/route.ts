import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { ensureAdminUser, signToken, TOKEN_COOKIE, ADMIN_EMAIL, ADMIN_PASSWORD, getAuthUser, getCookieOptions } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/** GET /api/seed — bootstraps the database with admin. Admin-only.
 *  Safe to call repeatedly (idempotent). */
export async function POST() {
  const _demoBlock = await demoWriteBlock("seeding data"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || !hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  try {
    await seedDatabase();
    return NextResponse.json({ ok: true, message: "Database seeded." });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}

/** POST /api/seed — REMOVED (was an unauthenticated admin-login backdoor).
 *  Use POST /api/auth/login with admin credentials instead. */
