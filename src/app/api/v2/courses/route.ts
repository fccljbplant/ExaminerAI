/**
 * GET /api/v2/courses — L2 Catalog (REDESIGN-P3 §L2)
 *
 * Domain-neutral course list: active courses the learner can see
 * (published marketplace courses + default curriculum), each with
 * enrollment state and coarse progress. Enrolled rows sort first.
 *
 * Query params: q (search), category, level.
 */

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const category = url.searchParams.get("category") ?? "";
  const level = url.searchParams.get("level") ?? "";

  const courses = await db.course.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ published: true }, { isDefault: true }] },
        ...(q
          ? [
              {
                OR: [
                  { name: { contains: q } },
                  { description: { contains: q } },
                ],
              },
            ]
          : []),
        ...(category ? [{ category }] : []),
        ...(level ? [{ level }] : []),
      ],
    },
    orderBy: [{ featured: "desc" }, { enrollmentCount: "desc" }],
    select: {
      id: true,
      name: true,
      subtitle: true,
      description: true,
      category: true,
      level: true,
      durationWeeks: true,
      rating: true,
      reviewCount: true,
      enrollmentCount: true,
      thumbnailUrl: true,
      featured: true,
      skillsVerified: true,
    },
  });

  // Learner state per course (enrollment + position).
  const profiles = await db.learnProfile.findMany({
    where: { userId: user.sub },
    select: { courseId: true, totalXP: true, masteryMap: true },
  });
  const byCourse = new Map(profiles.map((p) => [p.courseId, p]));

  const items = courses.map((c) => {
    const profile = byCourse.get(c.id);
    let progress: { week: number; day: number } | null = null;
    if (profile?.masteryMap) {
      try {
        const m = profile.masteryMap as { topicProgress?: { current?: { week?: number; day?: number } } };
        const cur = m.topicProgress?.current;
        if (cur?.week) progress = { week: cur.week, day: cur.day ?? 1 };
      } catch {
        progress = null;
      }
    }
    return {
      ...c,
      enrolled: Boolean(profile),
      progress,
    };
  });

  // Enrolled first (spec: org-assigned pinned — enrollment is the v1 proxy).
  items.sort((a, b) => Number(b.enrolled) - Number(a.enrolled));

  return apiSuccess({ items, categories: distinctValues(courses.map((c) => c.category)) });
}

function distinctValues(values: string[]): string[] {
  return [...new Set(values)].sort();
}
