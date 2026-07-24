import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles output internally — no `standalone` needed.
  // Keeping it off avoids the extra .next/standalone copy step on Vercel.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Sharp is used for image optimization. Vercel provides it natively.
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
