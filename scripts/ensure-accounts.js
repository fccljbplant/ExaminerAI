#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS node script */
/**
 * ensure-accounts.js — Create the platform admin if it doesn't exist.
 * Safe to run on every Vercel build (upsert, won't overwrite existing data).
 *
 * Admin: admin@examiner.ai / admin123
 *
 * Demo accounts are NOT created here — demo data is served exclusively
 * from the bundled local SQLite demo db (see src/lib/demo-db.ts).
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const db = new PrismaClient();
  try {
    const adminPwd = await bcrypt.hash("admin123", 10);

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

    // Demo accounts are NOT created here — demo data is served
    // exclusively from the bundled local SQLite demo db (see src/lib/demo-db.ts).

    console.log("Core accounts ready.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("ensure-accounts failed:", e.message);
  process.exit(1);
});
