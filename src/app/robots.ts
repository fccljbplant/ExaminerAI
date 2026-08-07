import type { MetadataRoute } from "next";

/**
 * /robots.ts — robots.txt for the TraineesAI public marketplace.
 *
 * Allows all well-behaved crawlers to crawl the public marketplace,
 * course detail, and credential verification pages. Points to the
 * dynamic sitemap at /sitemap.xml.
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://examiner-ai-tau.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // App routes are gated behind auth — keep crawlers out of the
        // logged-in app shell, API routes, and the dashboard.
        disallow: ["/app/", "/api/"],
      },
      // Explicit allows for the social-scraper-friendly public paths so
      // misconfigured crawlers (Twitter, Facebook, LinkedIn) still pick
      // them up even if they interpreted the /app/ disallow broadly.
      {
        userAgent: "Googlebot",
        allow: ["/", "/courses/", "/verify/", "/sitemap.xml"],
        disallow: ["/app/", "/api/"],
      },
      {
        userAgent: "Twitterbot",
        allow: ["/", "/courses/", "/verify/"],
        disallow: ["/app/", "/api/"],
      },
      {
        userAgent: "facebookexternalhit",
        allow: ["/", "/courses/", "/verify/"],
        disallow: ["/app/", "/api/"],
      },
      {
        userAgent: "LinkedInBot",
        allow: ["/", "/courses/", "/verify/"],
        disallow: ["/app/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
