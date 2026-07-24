/**
 * Batch teacher helpers — multi-teacher batch support.
 *
 * Teachers get multi-batch access via the BatchTeacher junction table.
 * This module provides helpers to query a teacher's batch memberships
 * and check access, replacing the old single-batchId approach.
 *
 * Students remain one-batch-each via User.batchId (unchanged).
 */

import { db } from "@/lib/db";

/** Get all batch IDs a teacher belongs to via BatchTeacher.
 *  Returns an empty array if the teacher has no batch memberships.
 *  For admin/principal/administrator/developer roles, returns null
 *  (meaning "all batches" — no scoping needed). */
export async function getTeacherBatchIds(userId: string, role: string): Promise<string[] | null> {
  // Admin roles — unrestricted access (no batch scoping)
  const adminRoles = ["principal", "administrator", "developer", "admin"];
  if (adminRoles.includes(role)) return null;

  const memberships = await db.batchTeacher.findMany({
    where: { teacherId: userId },
    select: { batchId: true },
  });
  return memberships.map(m => m.batchId);
}

/** Check if a teacher has access to a specific batch.
 *  Admins always have access. Teachers need a BatchTeacher row. */
export async function canAccessBatch(userId: string, role: string, batchId: string): Promise<boolean> {
  const adminRoles = ["principal", "administrator", "developer", "admin"];
  if (adminRoles.includes(role)) return true;

  const membership = await db.batchTeacher.findFirst({
    where: { teacherId: userId, batchId },
    select: { id: true },
  });
  return !!membership;
}

/** Build a Prisma `where` clause for filtering students by the caller's
 *  batch access. Returns {} (no filter) for admins, or { batchId: { in: [...] } }
 *  for teachers with batch memberships.
 *  Returns { batchId: null } for teachers with NO batch memberships (sees nothing). */
export async function getBatchFilter(userId: string, role: string): Promise<Record<string, unknown>> {
  const batchIds = await getTeacherBatchIds(userId, role);
  if (batchIds === null) return {}; // admin — no filter
  if (batchIds.length === 0) return { batchId: null }; // teacher with no batches — sees nothing
  return { batchId: { in: batchIds } };
}
