import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace";

/**
 * /sitemap.ts — dynamic sitemap for the TraineesAI public marketplace.
 *
 * Emits all published course pages + category landing pages + the main
 * static marketing pages. Generated on every request (cached at the edge).
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://examiner-ai-tau.vercel.app";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // refresh hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1) Static marketing pages — always present.
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/courses`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/app`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  // 2) Category landing pages — one per marketplace category.
  const categoryPages: MetadataRoute.Sitemap = MARKETPLACE_CATEGORIES.map((c) => ({
    url: `${SITE_URL}/courses/category/${c.value}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // 3) Published course detail pages — best-effort; if the DB is unavailable
  //    we still serve the static + category URLs so the sitemap never 500s.
  let coursePages: MetadataRoute.Sitemap = [];
  try {
    const courses = await db.course.findMany({
      where: { published: true },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });
    coursePages = courses.map((c) => ({
      url: `${SITE_URL}/courses/${c.id}`,
      lastModified: c.updatedAt ?? new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    // DB cold-start or transient error — fall back to an empty list.
    // The static + category URLs are still served.
  }

  return [...staticPages, ...categoryPages, ...coursePages];
}
