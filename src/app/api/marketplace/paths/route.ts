import { NextResponse } from "next/server";
import { fetchMarketplacePaths } from "@/lib/marketplace";

/**
 * GET /api/marketplace/paths — PUBLIC learning-paths listing.
 *
 * Phase 6. No auth required — anyone (prospective students, employers, search
 * engines) can browse published learning paths.
 *
 * Only returns paths where `published: true`. Sorted by featured first,
 * then by sortOrder asc, then createdAt desc.
 *
 * Returns: id, title, subtitle, description, category, icon, price,
 *          currency, durationWeeks, level, featured, courseCount
 */
export async function GET() {
  const paths = await fetchMarketplacePaths();
  return NextResponse.json({ paths });
}
