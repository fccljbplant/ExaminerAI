import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasRole, ADMIN_ROLES, STAFF_ROLES } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

/** All possible nav items (the full menu). Admin picks which ones each role sees. */
export const ALL_NAV_KEYS = [
  "dashboard", "checkin", "question", "weekly-test", "gantt", "report-card",
  "batch", "course-planner",
  "admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system",
  "ai-tutor", "course-outline", "messages", "journey", "settings",
] as const;

/** Default nav items per role (used when no DB config exists). */
export const DEFAULT_NAV_PER_ROLE: Record<string, string[]> = {
  student: ["dashboard", "checkin", "question", "weekly-test", "gantt", "report-card", "ai-tutor", "course-outline", "messages", "journey", "settings"],
    teacher: ["batch", "course-planner", "ai-tutor", "course-outline", "messages", "settings"],
  course_coordinator: ["course-planner", "ai-tutor", "course-outline", "messages", "settings"],
  counselor: ["batch", "messages", "settings"],
  guardian: ["dashboard", "report-card", "course-outline", "messages", "settings"],
  principal: ["admin-dashboard", "admin-users", "admin-courses", "admin-system", "messages"],
  administrator: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system", "messages"],
  developer: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system", "messages"],
  admin: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system", "messages"],
};

/** GET /api/role-nav-config — returns all role nav configs.
 *  Admin-only. Returns defaults merged with DB overrides. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isStaff = hasRole(user.role, STAFF_ROLES);
  if (!isStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get all configs from DB
  const configs = await db.roleNavConfig.findMany();
  const configMap = new Map(configs.map(c => [c.role, JSON.parse(c.navItems || "[]")]));

  // Merge with defaults
  const allRoles = Object.keys(DEFAULT_NAV_PER_ROLE);
  const result = allRoles.map(role => ({
    role,
    navItems: configMap.get(role) || DEFAULT_NAV_PER_ROLE[role] || [],
    isCustom: configMap.has(role),
  }));

  return NextResponse.json({ configs: result, allNavKeys: ALL_NAV_KEYS });
}

/** POST /api/role-nav-config — update nav items for a role.
 *  Body: { role: string, navItems: string[] }
 *  Admin-only. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = hasRole(user.role, ADMIN_ROLES);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { role, navItems } = body as { role?: string; navItems?: string[] };

  if (!role || !Array.isArray(navItems)) {
    return NextResponse.json({ error: "role and navItems array required" }, { status: 400 });
  }

  // Validate navItems against ALL_NAV_KEYS
  const validKeys = new Set(ALL_NAV_KEYS as readonly string[]);
  const filtered = navItems.filter(k => validKeys.has(k));

  try {
    const config = await db.roleNavConfig.upsert({
      where: { role },
      create: { role, navItems: JSON.stringify(filtered) },
      update: { navItems: JSON.stringify(filtered) },
    });
    logger.info("Role nav config updated", { role, itemCount: filtered.length, by: user.id });
    return NextResponse.json({ config });
  } catch (err) {
    logger.error("Role nav config update failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

/** DELETE /api/role-nav-config — reset a role's config to defaults.
 *  Body: { role: string } */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = hasRole(user.role, ADMIN_ROLES);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { role } = body as { role?: string };
  if (!role) return NextResponse.json({ error: "role required" }, { status: 400 });

  await db.roleNavConfig.delete({ where: { role } }).catch(err => console.error("Failed to delete role nav config:", err instanceof Error ? err.message : String(err)));
  return NextResponse.json({ ok: true });
}
