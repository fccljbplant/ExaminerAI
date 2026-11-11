#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS node script */
/**
 * Explicit, one-time platform-admin bootstrap.
 *
 * This script is NOT called by the Vercel build. Invoke it manually only in
 * the intended environment with ADMIN_BOOTSTRAP_EMAIL and
 * ADMIN_BOOTSTRAP_PASSWORD supplied by a secret manager.
 *
 * Existing accounts are never modified: in particular, this script never
 * resets an existing password, role, approval state, or account status.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
  }
  if (!password || password.length < 16) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 16 characters.");
  }

  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      console.log("Bootstrap skipped: the requested account already exists; no changes made.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.create({
      data: {
        email,
        name: "Platform Administrator",
        passwordHash,
        role: "platform_admin",
        status: "active",
        approvedAt: new Date(),
      },
    });
    console.log("Platform administrator created. Store the credentials in the approved secret manager.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Platform-admin bootstrap failed:", error.message);
  process.exitCode = 1;
});
