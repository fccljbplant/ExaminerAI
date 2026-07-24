import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, UserRole } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * GET /api/events?batchId=X — list events for a batch (or all upcoming).
 *   - Students: see events for their batch only
 *   - Staff: see events for the specified batch (or all if no batchId)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batchId = req.nextUrl.searchParams.get("batchId");

  let where: { batchId?: string } = {};
  if (user.role === "student" || user.role === "pending") {
    where.batchId = user.batchId ?? "none"; // if no batch, see nothing
  } else if (batchId) {
    where.batchId = batchId;
  }

  const events = await db.event.findMany({
    where,
    orderBy: { startDate: "asc" },
    take: 50, // limit to next 50 events
  });

  return NextResponse.json({ events });
}

/**
 * POST /api/events — create a new event (teachers/admins only).
 * Body: { title, description?, type?, startDate, endDate?, location?, batchId?, isAllDay? }
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("creating events"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { title, description, type, startDate, endDate, location, batchId, isAllDay, activityType } = body as {
    title?: string; description?: string; type?: string;
    startDate?: string; endDate?: string; location?: string;
    batchId?: string; isAllDay?: boolean; activityType?: string;
  };

  if (!title?.trim() || !startDate) {
    return NextResponse.json({ error: "title and startDate required" }, { status: 400 });
  }
  // Input validation
  if (title.length > 500) return NextResponse.json({ error: "title too long (max 500 chars)" }, { status: 400 });
  if (description && description.length > 10_000) return NextResponse.json({ error: "description too long" }, { status: 400 });
  if (location && location.length > 500) return NextResponse.json({ error: "location too long" }, { status: 400 });

  const event = await db.event.create({
    data: {
      title: title.trim(),
      description: description?.trim() || "",
      type: type || "deadline",
      activityType: activityType || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      location: location?.trim() || null,
      batchId: batchId || auth.ctx.user?.batchId || null,
      createdById: auth.ctx.payload.sub,
      isAllDay: isAllDay ?? false,
    },
  });

  return NextResponse.json({ event });
}

/**
 * DELETE /api/events — delete an event.
 * Body: { eventId }
 */
export async function DELETE(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("creating events"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { eventId } = body as { eventId?: string };
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  await db.event.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
