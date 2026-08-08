import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, signToken, getCookieOptions } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";
import { logAudit } from "@/lib/audit-log";

/**
 * POST /api/org/signup — B2B organization self-registration.
 *
 * Creates:
 *   1. A new Organization (slug derived from org name)
 *   2. An org_admin user (the person registering)
 *   3. Links the user to the org as an OrgMember with role=admin
 *
 * Body:
 *   { orgName, adminName, adminEmail, adminPassword, seats }
 *
 * Returns: { ok: true, orgId, userId } + sets JWT cookie.
 *
 * Rate-limited: 3 signups per hour per IP (anti-abuse).
 */

const PLAN_BY_SEATS: Record<string, string> = {
  "1-10": "starter",
  "11-50": "team",
  "51-200": "business",
  "200+": "enterprise",
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`org-signup:${ip}`, 3, 3_600_000)) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again in an hour." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { orgName, adminName, adminEmail, adminPassword, seats } = body as {
    orgName?: string;
    adminName?: string;
    adminEmail?: string;
    adminPassword?: string;
    seats?: string;
  };

  // Validation
  if (!orgName || orgName.trim().length < 2) {
    return NextResponse.json({ error: "Organization name is required (min 2 characters)" }, { status: 400 });
  }
  if (!adminName || adminName.trim().length < 2) {
    return NextResponse.json({ error: "Your name is required (min 2 characters)" }, { status: 400 });
  }
  const email = adminEmail?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!adminPassword || adminPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Check if email already exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });
  }

  // Generate a slug from org name
  const baseSlug = orgName.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  let slug = baseSlug;
  let suffix = 1;
  while (await db.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const plan = PLAN_BY_SEATS[seats || "1-10"] || "starter";
  const seatsNum = seats === "200+" ? 200 : parseInt(seats?.split("-").pop() || "10", 10);

  try {
    // Create org + admin user + org membership in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create the organization
      const org = await tx.organization.create({
        data: {
          name: orgName.trim(),
          slug,
          plan,
          seats: seatsNum,
        },
      });

      // 2. Create the admin user
      const passwordHash = await hashPassword(adminPassword);
      const user = await tx.user.create({
        data: {
          email,
          name: adminName.trim(),
          passwordHash,
          role: "org_admin",
          status: "active",
          approvedAt: new Date(),
        },
      });

      // 3. Link user to org as admin
      await tx.orgMember.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: "admin",
          seat: true,
          status: "active",
        },
      });

      return { org, user };
    });

    // Sign JWT + set cookie
    const token = signToken({
      sub: result.user.id,
      email: result.user.email,
      role: result.user.role,
      name: result.user.name,
    });

    logger.info("Org signup completed", {
      orgId: result.org.id,
      orgName: result.org.name,
      userId: result.user.id,
      email: result.user.email,
    });

    try {
      await logAudit({
        actor: { id: result.user.id, name: result.user.name, role: "org_admin" },
        action: "org_signup",
        target: { type: "organization", id: result.org.id },
        metadata: { orgName: result.org.name, plan: result.org.plan, seats: result.org.seats },
      });
    } catch { /* non-blocking */ }

    const response = NextResponse.json({
      ok: true,
      orgId: result.org.id,
      userId: result.user.id,
      message: "Welcome to TraineesAI. Your organization is ready.",
    });
    response.cookies.set("token", token, getCookieOptions());
    return response;
  } catch (e) {
    logger.error("Org signup failed", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json(
      { error: "Failed to create organization. Please try again." },
      { status: 500 },
    );
  }
}
