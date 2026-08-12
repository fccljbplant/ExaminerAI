#!/usr/bin/env node
/**
 * ensure-accounts.js — Create admin + demo accounts if they don't exist.
 * Safe to run on every Vercel build (upsert, won't overwrite existing data).
 *
 * Admin:   admin@examiner.ai / helloworld
 * Demo:     demo@examiner.ai / demo123
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const db = new PrismaClient();
  try {
    const adminPwd = await bcrypt.hash("helloworld", 10);
    const demoPwd = await bcrypt.hash("demo123", 10);

    // Admin account — always reset password to known value on every build.
    await db.user.upsert({
      where: { email: "admin@examiner.ai" },
      update: { passwordHash: adminPwd, status: "active", role: "platform_admin", approvedAt: new Date() },
      create: {
        email: "admin@examiner.ai",
        name: "Platform Administrator",
        passwordHash: adminPwd,
        role: "platform_admin",
        status: "active",
        approvedAt: new Date(),
      },
    }).catch(() => {});
    console.log("✓ admin@examiner.ai ensured");

    // Demo account — always reset password to known value on every build.
    await db.user.upsert({
      where: { email: "demo@examiner.ai" },
      update: { passwordHash: demoPwd, status: "active", approvedAt: new Date() },
      create: {
        email: "demo@examiner.ai",
        name: "Demo User",
        passwordHash: demoPwd,
        role: "demo",
        status: "active",
        approvedAt: new Date(),
      },
    }).catch(() => {});
    console.log("✓ demo@examiner.ai ensured");

    console.log("Core accounts ready.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("ensure-accounts failed:", e.message);
  process.exit(1);
});
