import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { demoWriteBlock } from "@/lib/demo-guard";

/** GET /api/users — list users. Teachers see students+pending only. Admins see all. */
export async function GET() {
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Teachers, TAs, course_coordinators, and counselors only see students and
  // pending users (not other teachers/admins). Admins (principal/administrator)
  // see all users. Developer sees all (technical role — needs visibility for
  // debugging, but cannot create/modify users via POST).
  const where = (payload.role === "teacher"  || payload.role === "course_coordinator" || payload.role === "counselor")
    ? { role: { in: ["student", "pending"] } }
    : {};
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true, role: true, blocked: true,
      approvedAt: true, createdAt: true, lastLogin: true, currentWeek: true, projectName: true,
    },
  });
  return NextResponse.json({ users });
}

/** POST /api/users — admin/teacher creates a new user.
 *  Teachers can ONLY create student accounts. Only admins can create teachers/admins. */
export async function POST(req: Request) {
  const _demoBlock = await demoWriteBlock("creating users"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
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
