import { NextRequest, NextResponse } from "next/server";
import { fetchMarketplacePathDetail } from "@/lib/marketplace";

/**
 * GET /api/marketplace/paths/[id] — PUBLIC learning-path detail.
 *
 * Phase 6. No auth required. Returns the path metadata plus an ordered list
 * of courses (with order, title, isCapstone, level, durationWeeks, price).
 *
 * Only returns if `published: true` — unpublished paths are 404.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = await fetchMarketplacePathDetail(id);
  if (!path) {
    return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
  }
  return NextResponse.json({ path });
}
