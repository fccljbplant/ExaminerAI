/**
 * Course-centric instructor helpers — replaces the old batch-teachers.ts.
 *
 * Instructors have access to students via CourseEnrollment.
 * This module provides helpers to query an instructor's course memberships
 * and check access.
 */

import { db } from "@/lib/db";

/** Get all course IDs an instructor is assigned to via CourseEnrollment.
 *  Returns null for admin roles (meaning unrestricted access). */
export async function getInstructorCourseIds(userId: string, role: string): Promise<string[] | null> {
  const adminRoles = ["principal", "administrator", "demo", "admin"];
  if (adminRoles.includes(role)) return null;

  const memberships = await db.courseEnrollment.findMany({
    where: { userId, role: "instructor" },
    select: { courseId: true },
  });
  return memberships.map(m => m.courseId);
}

/** Check if an instructor has access to students in a specific course.
 *  Admins always have access. */
export async function canAccessCourse(userId: string, role: string, courseId: string): Promise<boolean> {
  const adminRoles = ["principal", "administrator", "demo", "admin"];
  if (adminRoles.includes(role)) return true;

  const membership = await db.courseEnrollment.findFirst({
    where: { userId, courseId, role: "instructor" },
    select: { id: true },
  });
  return !!membership;
}

/** Build a Prisma `where` clause for filtering students by the caller's
 *  course access. Returns {} (no filter) for admins. */
export async function getStudentFilter(userId: string, role: string): Promise<Record<string, unknown>> {
  const courseIds = await getInstructorCourseIds(userId, role);
  if (courseIds === null) return {}; // admin — no filter
  if (courseIds.length === 0) return { id: null }; // sees nothing

  const studentEnrollments = await db.courseEnrollment.findMany({
    where: { courseId: { in: courseIds }, role: "student" },
    select: { userId: true },
  });
  const studentIds = [...new Set(studentEnrollments.map(e => e.userId))];
  if (studentIds.length === 0) return { id: null };
  return { id: { in: studentIds } };
}