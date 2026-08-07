import { hasRole, ADMIN_ROLES, isStaffRole, UserRole, normalizeRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/users — list users with pagination + search.
 *
 *  Query params:
 *    - q: search string (matches name OR email, case-insensitive)
 *    - role: filter by role (e.g. 'learner', 'instructor')
 *    - page: 1-indexed page number (default 1)
 *    - pageSize: items per page (default 50, max 200)
 *
 *  Role-based scoping (post-purge 2026-08, 4-role model):
 *    - Instructors: see learners + pending-status users only
 *    - Admins (org_admin / platform_admin): see all users
 *    - Demo (read-only): sees all users for preview
 *    - Learners: see only instructors in their courses + admins
 *
 *  Returns: { users, pagination: { page, pageSize, total, totalPages } }
 */
export async function GET(req: NextRequest) {
  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Learners are allowed to call this endpoint, but with a restricted scope
  // (only instructors in their courses + admins). This makes the Messages
  // compose recipient search work for them.
  // Staff roles fall through to the existing logic below.
  const normalizedRole = normalizeRole(payload.role);
  const isLearner = normalizedRole === UserRole.LEARNER;
  if (!isStaffRole(payload.role) && !isLearner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse query params
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const roleFilter = url.searchParams.get("role") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50", 10)));

  // For learners, restrict to instructors in their courses + admins.
  // This is the only scope they need (to message their teachers).
  if (isLearner) {
    const studentId = payload.sub;

    // Find instructor IDs via CourseEnrollment for the learner's courses
    const instructorIds = new Set<string>();
    const studentEnrollments = await db.courseEnrollment.findMany({
      where: { userId: studentId, role: "student" },
      select: { courseId: true },
    });
    const courseIds = studentEnrollments.map(e => e.courseId);
    if (courseIds.length > 0) {
      const instructorEnrollments = await db.courseEnrollment.findMany({
        where: { courseId: { in: courseIds }, role: "instructor" },
        select: { userId: true },
      });
      instructorEnrollments.forEach(e => instructorIds.add(e.userId));
    }
    // Always include admins (so learners can message org_admin / platform_admin)
    const admins = await db.user.findMany({
      where: { role: { in: ["org_admin", "platform_admin"] }, blocked: false },
      select: { id: true },
    });
    admins.forEach(a => instructorIds.add(a.id));

    // Build the where clause for learners
    const searchClause = q ? {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
      ],
    } : {};
    const where = {
      id: { in: Array.from(instructorIds) },
      blocked: false,
      ...searchClause,
    };

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { name: "asc" },
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
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }

  // Build the where clause
  // Instructors only see learners (legacy "student" rows included).
  // Admins (org_admin / platform_admin) and demo (read-only preview)
  // see all users.
  const roleScope = normalizedRole === UserRole.INSTRUCTOR
    ? { role: { in: ["learner", "student"] } }
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

/** POST /api/users — admin/instructor creates a new user.
 *  Instructors can ONLY create learner accounts. Only admins can create instructors/admins.
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
  // Only ADMIN_ROLES (org_admin, platform_admin) can create non-learner accounts.
  // Everyone else (instructor, demo) can only create learner accounts. This
  // prevents privilege escalation via account creation.
  // Allowlist of valid roles — reject unknown roles instead of silent downgrade.
  const VALID_ROLES = ["learner", "instructor", "org_admin", "platform_admin", "demo"];
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }
  const requestedRole = role || "learner";
  if (!hasRole(payload.role, ADMIN_ROLES) && requestedRole !== "learner") {
    return NextResponse.json({ error: "Only administrators can create non-learner accounts" }, { status: 403 });
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
      approvedAt: requestedRole === "learner" ? new Date() : null,
    },
  });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
