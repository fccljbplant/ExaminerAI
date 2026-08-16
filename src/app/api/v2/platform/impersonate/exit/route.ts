/**
 * POST /api/v2/platform/impersonate/exit — end support mode.
 *
 * Restores the admin's parked token from `examiner_support_token` and
 * clears the marker. Only callable while an impersonation token (sup)
 * is active — the parked cookie is never trusted on its own.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getCookieOptions, TOKEN_COOKIE, verifyToken } from "@/lib/auth";
import { apiUnauthorized, apiError } from "@/lib/api-response";
import { SUPPORT_COOKIE } from "../route";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const current = await getAuthUser();
  if (!current) return apiUnauthorized();
  if (!current.sup) {
    return apiError("Not in support mode", "FORBIDDEN", 403);
  }

  const parked = req.cookies.get(SUPPORT_COOKIE)?.value ?? "";
  const restored = parked ? verifyToken(parked) : null;
  if (!restored || (restored.role !== "platform_admin" && restored.role !== "admin")) {
    // Parked session missing/invalid — clear both cookies and force login.
    const clear = NextResponse.json(
      { ok: false, error: "Support session expired — please sign in again" },
      { status: 401 },
    );
    clear.cookies.set(TOKEN_COOKIE, "", { ...getCookieOptions(), maxAge: 0 });
    clear.cookies.set(SUPPORT_COOKIE, "", { ...getCookieOptions(), maxAge: 0 });
    return clear;
  }

  const res = NextResponse.json({ ok: true, data: { restoredEmail: restored.email } });
  res.cookies.set(TOKEN_COOKIE, parked, getCookieOptions());
  res.cookies.set(SUPPORT_COOKIE, "", { ...getCookieOptions(), maxAge: 0 });
  return res;
}
