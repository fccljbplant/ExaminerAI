import { db } from "@/lib/db";
import type { MarketplaceCourseListItem } from "@/modules/course/lib/marketplace";

/**
 * modules/site — org storefront data (2026-08-15)
 *
 * Every organization gets a public storefront page at /<slug>
 * (e.g. /inzetenterprises). It shows the org's profile (logo, name,
 * description, address) and the courses the org has added to its
 * catalog (OrgCourse), branded with the org's theme color.
 */

export interface OrgStorefront {
  org: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    description: string | null;
    address: string | null;
    website: string | null;
    brandHex: string | null;
    memberCount: number;
  };
  courses: MarketplaceCourseListItem[];
}

export const ORG_SLUG_RESERVED = new Set([
  "courses",
  "paths",
  "pricing",
  "for-business",
  "for-learners",
  "support",
  "signup",
  "verify",
  "instructors",
  "learn",
  "login",
  "register",
  "preview",
  "api",
  "admin",
  "dashboard",
  "learner",
  "instructor",
  "org",
  "platform",
  "app",
]);

export const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Turn a display name into a candidate slug ("Inzet Enterprises" → "inzet-enterprises"). */
export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function fetchOrgStorefront(slug: string): Promise<OrgStorefront | null> {
  if (ORG_SLUG_RESERVED.has(slug.toLowerCase())) return null;

  const org = await db.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      description: true,
      address: true,
      website: true,
      _count: { select: { members: { where: { status: "active" } } } },
    },
  });
  if (!org) return null;

  const [themeRow, links] = await Promise.all([
    db.setting
      .findUnique({ where: { key: `org-theme:${org.id}` }, select: { value: true } })
      .catch(() => null),
    db.orgCourse.findMany({
      where: { orgId: org.id, course: { published: true, isActive: true } },
      orderBy: { createdAt: "desc" },
      select: {
        course: {
          select: {
            id: true,
            name: true,
            subtitle: true,
            category: true,
            level: true,
            price: true,
            currency: true,
            durationWeeks: true,
            rating: true,
            reviewCount: true,
            enrollmentCount: true,
            thumbnailUrl: true,
            instructorName: true,
            featured: true,
          },
        },
      },
    }),
  ]);

  let brandHex: string | null = null;
  if (themeRow?.value) {
    try {
      const parsed = JSON.parse(themeRow.value) as { brandHex?: string };
      brandHex = parsed.brandHex ?? null;
    } catch {
      brandHex = null;
    }
  }

  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      description: org.description,
      address: org.address,
      website: org.website,
      brandHex,
      memberCount: org._count.members,
    },
    courses: links.map((l) => l.course),
  };
}
