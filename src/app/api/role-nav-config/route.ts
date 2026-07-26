import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasRole, ADMIN_ROLES, STAFF_ROLES } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";

/** All possible nav items (the full menu). Admin picks which ones each role sees.
 *
 *  C10 fix (audit 2026-07-26): the previous version was missing 9 nav keys
 *  that ARE present in AppShell.tsx's ALL_NAV array:
 *    - batch-students, batch-mentorship, batch-assignments, batch-insights (teacher sub-tabs)
 *    - counselor-dashboard (counselor's purpose-built dashboard)
 *    - guardian-dashboard, guardian-progress (guardian's two views)
 *    - principal-dashboard (principal's institution dashboard)
 *    - teacher-ai-tutor (staff AI assistant)
 *
 *  Saving config with a role that had any of these keys would silently drop
 *  them from the saved list (the `filtered = navItems.filter(k => validKeys.has(k))`
 *  line was filtering against an incomplete whitelist), bricking that role's
 *  sidebar until an admin reset the config. This version includes ALL keys.
 */
export const ALL_NAV_KEYS = [
  // Student
  "dashboard", "checkin", "question", "weekly-test", "gantt", "report-card", "journey",
  // Teacher
  "batch", "batch-students", "batch-mentorship", "batch-assignments", "batch-insights",
  // Counselor
  "counselor-dashboard",
  // Course coordinator / teacher
  "course-planner",
  // Guardian
  "guardian-dashboard", "guardian-progress",
  // Principal
  "principal-dashboard",
  // Admin
  "admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system",
  // Shared
  "ai-tutor", "teacher-ai-tutor", "course-outline", "messages", "settings",
] as const;

/** Default nav items per role (used when no DB config exists).
 *  C10 fix: aligned with AppShell.tsx's ALL_NAV array. */
export const DEFAULT_NAV_PER_ROLE: Record<string, string[]> = {
  student: ["dashboard", "checkin", "gantt", "report-card", "ai-tutor", "course-outline", "messages", "settings"],
  teacher: ["batch", "batch-students", "batch-mentorship", "batch-assignments", "batch-insights", "course-planner", "teacher-ai-tutor", "course-outline", "messages", "settings"],
  course_coordinator: ["course-planner", "teacher-ai-tutor", "course-outline", "messages", "settings"],
  counselor: ["counselor-dashboard", "messages", "settings"],
  guardian: ["guardian-dashboard", "guardian-progress", "ai-tutor", "course-outline", "messages", "settings"],
  principal: ["principal-dashboard", "admin-users", "admin-courses", "messages", "settings"],
  administrator: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system", "messages"],
  demo: ["admin-dashboard", "admin-users", "admin-courses", "admin-features", "admin-resets", "admin-system", "messages", "teacher-ai-tutor"],
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
