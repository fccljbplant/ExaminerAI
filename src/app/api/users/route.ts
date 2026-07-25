import { hasRole, ADMIN_ROLES, isStaffRole, UserRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/users — list users with pagination + search.
 *
 *  Query params:
 *    - q: search string (matches name OR email, case-insensitive)
 *    - role: filter by role (e.g. 'student', 'teacher', 'pending')
 *    - page: 1-indexed page number (default 1)
 *    - pageSize: items per page (default 50, max 200)
 *
 *  Teachers see students+pending only. Admins see all.
 *  Demo (read-only) sees all users for preview purposes but cannot modify them.
 *
 *  Returns: { users, pagination: { page, pageSize, total, totalPages } }
 */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse query params
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const roleFilter = url.searchParams.get("role") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50", 10)));

  // Build the where clause
  // Teachers, TAs, course_coordinators, and counselors only see students and
  // pending users (not other teachers/admins). Admins (principal/administrator)
  // and demo (read-only preview) see all users.
  const roleScope = (payload.role === "teacher" || payload.role === "course_coordinator" || payload.role === "counselor")
    ? { role: { in: ["student", "pending"] } }
    : {};

  // Optional role filter (admin can filter by any role)
  const roleFilterClause = roleFilter ? { role: roleFilter } : {};

  // Search clause (name OR email contains q, case-insensitive)
  const searchClause = q ? {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
    ],
  } : {};

  const where = { ...roleScope, ...roleFilterClause, ...searchClause };

  // Run count + fetch in parallel
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, email: true, name: true, role: true, blocked: true,
        approvedAt: true, createdAt: true, lastLogin: true, currentWeek: true, projectName: true,
      },
    }),
  ]);

  return NextResponse.json({
    users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

/** POST /api/users — admin/teacher creates a new user.
 *  Teachers can ONLY create student accounts. Only admins can create teachers/admins.
 *  Demo is read-only and cannot create users at all. */
export async function POST(req: Request) {
  const _demoBlock = await demoWriteBlock("creating users"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || payload.role === UserRole.DEMO) {
    // Demo is read-only — cannot create users, even though it's a "staff"
    // role for preview purposes.
    return NextResponse.json({ error: "Demo accounts cannot create users" }, { status: 403 });
  }
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { name, email, password, role } = body as {
    name?: string; email?: string; password?: string; role?: string;
  };
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  // Only ADMIN_ROLES (principal, administrator) can create non-student accounts.
  // Everyone else (teacher, TA, coordinator, counselor, demo) can only
  // create student accounts. This prevents privilege escalation via account
  // creation — e.g. a counselor creating an admin account for themselves.
  // Allowlist of valid roles — reject unknown roles instead of silent downgrade
  const VALID_ROLES = ["student", "teacher", "course_coordinator", "counselor", "principal", "administrator", "demo"];
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }
  const requestedRole = role || "student";
  if (!hasRole(payload.role, ADMIN_ROLES) && requestedRole !== "student") {
    return NextResponse.json({ error: "Only administrators can create non-student accounts" }, { status: 403 });
  }
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }
  const bcrypt = (await import("bcryptjs")).default;
  const user = await db.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role: requestedRole,
      approvedAt: requestedRole === "student" ? new Date() : null,
    },
  });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
