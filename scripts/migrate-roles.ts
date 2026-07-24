/**
 * migrate-roles.ts — Phase RBAC+AUDIT Phase 2 migration script.
 * Run with: npx tsx scripts/migrate-roles.ts
 *
 * Maps pending/student/teacher directly. 'admin' accounts are defaulted
 * to 'platform_admin' (safer — no default crisis-content visibility) and
 * written to scripts/role-migration-decisions.md for MANUAL REVIEW.
 * Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const db = new PrismaClient();

const NEW_ROLES = new Set([
  "pending", "student", "teaching_assistant", "teacher", "course_coordinator",
  "counselor", "guardian", "institution_admin", "platform_admin",
]);

async function main() {
  console.log("\n=== Role Migration Script ===\n");
  const allUsers = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, lastLogin: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Found ${allUsers.length} total users.`);

  const admins = allUsers.filter(u => u.role === "admin");
  const legacyNonAdmins = allUsers.filter(u => u.role !== "admin" && !NEW_ROLES.has(u.role));
  const alreadyMigrated = allUsers.filter(u => NEW_ROLES.has(u.role));

  console.log(`  ${admins.length} legacy "admin" accounts → defaulted to "platform_admin" (REVIEW NEEDED).`);
  console.log(`  ${legacyNonAdmins.length} legacy non-admin accounts → mapped directly.`);
  console.log(`  ${alreadyMigrated.length} accounts already use a new role value (skipped).`);

  for (const u of legacyNonAdmins) {
    await db.user.update({ where: { id: u.id }, data: { role: u.role } });
  }
  for (const u of admins) {
    await db.user.update({ where: { id: u.id }, data: { role: "platform_admin" } });
  }

  if (admins.length > 0) {
    const lines = [
      "# Role Migration Manual Decisions", "",
      `Generated: ${new Date().toISOString()}`, "",
      "Each admin below was defaulted to `platform_admin` (operational access, NO default crisis-content visibility).",
      "Review and reassign to `institution_admin` if appropriate (pastoral/crisis-response access).", "",
      "| Name | Email | Last Login | Created | Default Assigned |",
      "|---|---|---|---|---|",
    ];
    for (const u of admins) {
      const lastLogin = u.lastLogin ? new Date(u.lastLogin).toISOString().slice(0, 10) : "never";
      const created = new Date(u.createdAt).toISOString().slice(0, 10);
      lines.push(`| ${u.name} | ${u.email} | ${lastLogin} | ${created} | platform_admin |`);
    }
    lines.push("");
    writeFileSync("scripts/role-migration-decisions.md", lines.join("\n"));
    console.log(`→ Wrote scripts/role-migration-decisions.md with ${admins.length} entries.`);
  }
  console.log("\n=== Migration complete ===\n");
}
main().catch((err) => { console.error("Migration failed:", err); process.exit(1); }).finally(() => db.$disconnect());
