import { NextResponse } from "next/server";
import { getAuthUser } from "./auth";

/**
 * DEMO GUARD (neutralized since demo-routing, 2026-08-16)
 *
 * Demo accounts (@demo.ai + legacy demo@examiner.ai) are served from the
 * LOCAL SQLite demo db — every db call routes there per-request — so demo
 * writes are inherently safe and `demoWriteBlock` is a no-op. The old
 * blanket 403 caused a stream of "Demo account restriction" UI errors
 * across the demo instructor/learner flows.
 *
 * `isDemoUser()` is still exported for routes that need CONDITIONAL
 * behavior (e.g. hiding org-settings UI for preview accounts).
 */

const DEMO_EMAIL = "demo@examiner.ai";

/** Returns true if the current authenticated user is a demo account.
 *
 *  Two flavors of demo accounts are blocked:
 *  1. The legacy "demo@examiner.ai" superuser (read-only across the whole app).
 *  2. The role-preview demo accounts created by the Login page
 *     (`student@demo.ai`, `instructor@demo.ai`, `coordinator@demo.ai`,
 *     `principal@demo.ai`, etc.) — any email ending in `@demo.ai`.
 */
export async function isDemoUser(): Promise<boolean> {
  const payload = await getAuthUser();
  if (!payload) return false;
  if (payload.email === DEMO_EMAIL) return true;
  return payload.email.toLowerCase().endsWith("@demo.ai");
}

/**
 * Call this at the top of any write handler.
 *
 * INTENTIONALLY A NO-OP since demo-routing (2026-08): demo sessions route
 * EVERY db call to the local SQLite demo db (src/lib/db.ts AsyncLocalStorage
 * proxy), so demo writes are fully isolated — they can never touch
 * production data. The old 403 here used to block every learning and
 * instructor write for @demo.ai accounts, which surfaced as a stream of
 * "Demo account restriction" UI errors. Real-AI cost stays blocked
 * centrally in the AI provider (callAI/streamAI degrade for demo sessions).
 */
export async function demoWriteBlock(_action?: string): Promise<NextResponse | null> {
  return null;
}
