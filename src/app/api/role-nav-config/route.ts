import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasRole, ADMIN_ROLES, STAFF_ROLES } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";

/** All possible nav items (the full menu). Admin picks which ones each role sees.
 *
 *  Post-purge 2026-08 (4-role model + demo):
 *    learner, instructor, org_admin, platform_admin, demo
 *  Legacy nav keys (counselor-dashboard, guardian-dashboard, guardian-progress,
 *  principal-dashboard) are kept in the whitelist for backward compat with
 *  any persisted RoleNavConfig rows from the old model. They simply won't be
 *  shown to anyone because no role defaults to them anymore.
 */
export const ALL_NAV_KEYS = [
  // Learner (4-view model: Home, Study, Project, Progress)
  "dashboard", "checkin", "gantt", "report-card",
  // Instructor (5 prominent views)
  "batch", "batch-students", "batch-mentorship", "batch-assignments", "batch-insights",
  // Course planner (shared: instructor + org_admin)
  "course-planner",
  // Org admin
  "org-admin-dashboard",
  // Platform admin
  "admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system",
  // Legacy nav keys (kept for backward compat with persisted RoleNavConfig rows)
  "counselor-dashboard",
  "guardian-dashboard", "guardian-progress",
  "principal-dashboard",
  // Shared
  "ai-tutor", "instructor-ai-tutor", "course-outline", "messages", "settings",
] as const;

/** Default nav items per role (used when no DB config exists).
 *  Post-purge 2026-08: 4-role model + demo. */
export const DEFAULT_NAV_PER_ROLE: Record<string, string[]> = {
  learner: ["dashboard", "checkin", "gantt", "report-card", "ai-tutor", "course-outline", "messages", "settings"],
  instructor: ["batch", "batch-students", "batch-mentorship", "batch-assignments", "batch-insights", "course-planner", "instructor-ai-tutor", "course-outline", "messages", "settings"],
  org_admin: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-system", "course-outline", "messages", "settings"],
  platform_admin: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system", "messages"],
  demo: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system", "messages", "instructor-ai-tutor"],
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
  const _demoBlock = await demoWriteBlock("managing role nav config"); if (_demoBlock) return _demoBlock;
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
  const _demoBlock = await demoWriteBlock("managing role nav config"); if (_demoBlock) return _demoBlock;
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
