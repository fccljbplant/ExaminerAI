import { NextResponse } from "next/server";
import { getAuthUser } from "./auth";

/**
 * DEMO WRITE GUARD
 *
 * The demo account (demo@examiner.ai) has READ access to everything but
 * CANNOT perform any write action (create/update/delete). This keeps the
 * demo data stable for all visitors.
 *
 * Usage at the top of any POST/PUT/PATCH/DELETE handler:
 *
 *   const block = await demoWriteBlock();
 *   if (block) return block;
 *
 * The guard checks if the authenticated user is the demo account (by email)
 * and returns a 403 response with a friendly message if so. Returns null
 * if the user is NOT the demo account (write allowed).
 */

const DEMO_EMAIL = "demo@examiner.ai";

/** Returns true if the current authenticated user is the demo account. */
export async function isDemoUser(): Promise<boolean> {
  const payload = await getAuthUser();
  if (!payload) return false;
  return payload.email === DEMO_EMAIL;
}

/**
 * Call this at the top of any write handler.
 * Returns a 403 NextResponse if the user is demo, or null if write is allowed.
 */
export async function demoWriteBlock(action?: string): Promise<NextResponse | null> {
  if (await isDemoUser()) {
    return NextResponse.json(
      {
        error: "Demo account restriction",
        message: `🚫 This is a demo account — ${action || "this action"} is not allowed. You can open all forms, menus, and dialogs for preview, but no changes will be saved. Sign up your institution to enable full functionality.`,
        code: "DEMO_BLOCKED",
      },
      { status: 403 }
    );
  }
  return null;
}
