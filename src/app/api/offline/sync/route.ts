import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/offline/sync — receive evidence captured while offline.
 *
 * The service worker (public/sw.js) queues POST requests in IndexedDB
 * when the network drops. When connectivity returns, it drains the
 * queue and replays each request. For most endpoints (daily-test
 * reply, message send, drill answer) the replay hits the original
 * route directly — this endpoint is only for the special case of
 * "evidence capture" (photos, voice memos, field notes) that needs
 * to be batched and attributed to a specific project task.
 *
 * Body shape:
 *   {
 *     items: [
 *       {
 *         type: "photo" | "note" | "voice",
 *         taskWeek: number,
 *         taskDay: number,
 *         payload: string,  // base64 for photo/voice, text for note
 *         capturedAt: string,  // ISO timestamp from when offline
 *         clientNote?: string,
 *       }
 *     ]
 *   }
 *
 * Returns: { received: number, saved: number, errors: string[] }
 */

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can sync offline evidence" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { items } = body as {
    items?: Array<{
      type: "photo" | "note" | "voice";
      taskWeek: number;
      taskDay: number;
      payload: string;
      capturedAt: string;
      clientNote?: string;
    }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }
  if (items.length > 50) {
    return NextResponse.json({ error: "Too many items (max 50 per sync)" }, { status: 400 });
  }

  const errors: string[] = [];
  let saved = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      if (!item.payload || !item.capturedAt) {
        errors.push(`Item ${i}: missing payload or capturedAt`);
        continue;
      }

      // Store as a self-addressed message with a special subject prefix.
      // The mentor sees it in the student's portfolio; the prefix lets
      // the UI render it as evidence rather than a normal message.
      await db.message.create({
        data: {
          fromId: user.id,
          toId: user.id, // self-addressed — mentor sees it via the portfolio view
          subject: `[evidence:${item.type}]`,
          body: `[Offline evidence · Week ${item.taskWeek} Day ${item.taskDay} · ${item.type}]\n${item.clientNote || "(no note)"}\nCaptured: ${item.capturedAt}`,
          sentAt: new Date(item.capturedAt),
          isRead: false,
        },
      });
      saved++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`Item ${i}: ${reason}`);
      logger.warn("Offline sync item failed", { userId: user.id, reason });
    }
  }

  logger.info("Offline sync completed", {
    userId: user.id,
    received: items.length,
    saved,
    errors: errors.length,
  });

  return NextResponse.json({
    received: items.length,
    saved,
    errors,
  });
}

/**
 * GET /api/offline/sync — returns the count of pending offline-evidence
 * items awaiting mentor review. The actual offline queue lives in the
 * browser's IndexedDB (per-device); this endpoint surfaces the count of
 * evidence messages that have already synced but haven't been reviewed.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pendingEvidence = await db.message.count({
    where: {
      fromId: user.id,
      toId: user.id,
      subject: { startsWith: "[evidence:" },
      isRead: false,
    },
  });

  return NextResponse.json({
    pendingEvidence,
    message: pendingEvidence > 0
      ? `${pendingEvidence} evidence item${pendingEvidence === 1 ? "" : "s"} awaiting mentor review.`
      : "No pending evidence.",
  });
}
