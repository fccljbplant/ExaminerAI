import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/report-cards?userId=... */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userIdParam = req.nextUrl.searchParams.get("userId");
  let targetUserId = payload.sub;
  if (userIdParam && (isStaffRole(payload.role))) {
    targetUserId = userIdParam;
    // IDOR protection
    try { await assertCanAccessStudent(payload, targetUserId); } catch (err: any) {
      return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
    }
  }
  const cards = await db.reportCard.findMany({
    where: { userId: targetUserId },
    orderBy: { week: "asc" },
  });
  return NextResponse.json({ reportCards: cards });
}

/** POST /api/report-cards — instructor/admin writes a report card. */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("generating report cards"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const {
    userId, week, grade, score, strengths, weaknesses,
    progress, nextSteps,
  } = body as Record<string, unknown>;
  if (!userId || !week) {
    return NextResponse.json({ error: "userId and week required" }, { status: 400 });
  }
  // IDOR protection
  try { await assertCanAccessStudent(payload, String(userId)); } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }
  // Input validation — prevent resource exhaustion
  const MAX_TEXT = 10_000;
  if (strengths && String(strengths).length > MAX_TEXT) return NextResponse.json({ error: "strengths too long" }, { status: 400 });
  if (weaknesses && String(weaknesses).length > MAX_TEXT) return NextResponse.json({ error: "weaknesses too long" }, { status: 400 });
  if (progress && String(progress).length > MAX_TEXT) return NextResponse.json({ error: "progress too long" }, { status: 400 });
  if (nextSteps && String(nextSteps).length > MAX_TEXT) return NextResponse.json({ error: "nextSteps too long" }, { status: 400 });
  const numScore = Number(score ?? 0);
  if (isNaN(numScore) || numScore < 0 || numScore > 100) return NextResponse.json({ error: "score must be 0-100" }, { status: 400 });
  const card = await db.reportCard.upsert({
    where: { userId_week: { userId: String(userId), week: Number(week) } },
    create: {
      userId: String(userId),
      week: Number(week),
      grade: String(grade ?? "B"),
      score: Number(score ?? 0),
      strengths: JSON.stringify(strengths ?? []),
      weaknesses: JSON.stringify(weaknesses ?? []),
      progress: String(progress ?? ""),
      nextSteps: JSON.stringify(nextSteps ?? []),
    },
    update: {
      grade: String(grade ?? "B"),
      score: Number(score ?? 0),
      strengths: JSON.stringify(strengths ?? []),
      weaknesses: JSON.stringify(weaknesses ?? []),
      progress: String(progress ?? ""),
      nextSteps: JSON.stringify(nextSteps ?? []),
    },
  });
  return NextResponse.json({ reportCard: card });
}
