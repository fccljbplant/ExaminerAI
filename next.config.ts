import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles output internally — no `standalone` needed.
  // Keeping it off avoids the extra .next/standalone copy step on Vercel.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Sharp is used for image optimization. Vercel provides it natively.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Aggressive cache-busting for HTML pages so users always get the latest
  // UI. Static assets (JS/CSS) are already content-hashed by Next.js so they
  // cache safely. This prevents users from seeing a stale teacher panel
  // after a deploy.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        // Static assets are content-hashed — safe to cache aggressively
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
