import { NextRequest, NextResponse } from "next/server";
import { runEscalationEngine } from "@/lib/ai-assistant/escalation";
import { getAuthUser } from "@/lib/auth";

/**
 * POST /api/assistant/escalation/run
 *
 * Runs the escalation engine on all open amber flags.
 * Can be called by:
 * - Cron job (with CRON_SECRET)
 * - Admin/principal manually
 */
export async function POST(req: NextRequest) {
  // Check for cron secret OR admin auth
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronCall) {
    const payload = await getAuthUser();
    if (!payload || !["principal", "administrator", "demo", "admin"].includes(payload.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runEscalationEngine();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Escalation engine failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
