import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/notifications — current user's notifications.
 *
 * Returns: { notifications, unreadCount }
 *   - notifications: up to 30 most-recent notifications (read + unread),
 *     newest first.
 *   - unreadCount: how many are still unread (used for the bell badge).
 *
 * Auth required.
 */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: payload.sub },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          read: true,
          link: true,
          createdAt: true,
        },
      }),
      db.notification.count({
        where: { userId: payload.sub, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (err) {
    logger.error("Failed to fetch notifications", {
      userId: payload.sub,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications — mark notifications as read.
 *
 * Body: { id?: string }
 *   - If `id` is provided → mark only that notification as read.
 *   - If `id` is omitted   → mark ALL of the user's notifications as read.
 *
 * Auth required.
 */
export async function PATCH(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };

  try {
    if (id) {
      // Single notification — verify ownership before marking read so a
      // malicious client can't toggle other users' notifications by ID.
      const updated = await db.notification.updateMany({
        where: { id, userId: payload.sub },
        data: { read: true },
      });
      return NextResponse.json({ ok: true, updated: updated.count });
    }

    // Mark-all-as-read — scoped to the current user.
    const result = await db.notification.updateMany({
      where: { userId: payload.sub, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (err) {
    logger.error("Failed to mark notifications as read", {
      userId: payload.sub,
      notificationId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
