import { db } from "@/lib/db";
import { normalizeRole, UserRole } from "@/lib/rbac";
import type { JwtPayload } from "@/lib/auth";
import { getAuthorizedStudentCourseIds } from "./student-detail-visibility";

/**
 * Resolve staff-visible course IDs for a learner after the caller has passed
 * assertCanAccessStudent. Platform admins and explicitly granted demo staff
 * are bounded to the learner's actual enrolments; they never create enrolments.
 */
export async function getStaffAuthorizedStudentCourseIds(
  payload: JwtPayload,
  studentId: string,
): Promise<string[]> {
  const learnerEnrollments = await db.courseEnrollment.findMany({
    where: { userId: studentId, role: "student" },
    select: { courseId: true },
  });
  const learnerCourseIds = learnerEnrollments.map((enrollment) => enrollment.courseId);
  if (learnerCourseIds.length === 0) return [];

  const role = normalizeRole(payload.role);
  let staffCourseIds: string[] = [];

  if (role === UserRole.INSTRUCTOR) {
    const teaching = await db.courseEnrollment.findMany({
      where: { userId: payload.sub, role: "instructor" },
      select: { courseId: true },
    });
    staffCourseIds = teaching.map((enrollment) => enrollment.courseId);
  } else if (role === UserRole.ORG_ADMIN) {
    const adminMemberships = await db.orgMember.findMany({
      where: { userId: payload.sub, role: "admin", status: "active" },
      select: { orgId: true },
    });
    const adminOrgIds = adminMemberships.map((membership) => membership.orgId);
    if (adminOrgIds.length > 0) {
      const learnerMemberships = await db.orgMember.findMany({
        where: { userId: studentId, orgId: { in: adminOrgIds }, status: "active" },
        select: { orgId: true },
      });
      const sharedOrgIds = learnerMemberships.map((membership) => membership.orgId);
      if (sharedOrgIds.length > 0) {
        const orgCourses = await db.orgCourse.findMany({
          where: { orgId: { in: sharedOrgIds } },
          select: { courseId: true },
        });
        staffCourseIds = orgCourses.map((course) => course.courseId);
      }
    }
  } else if (role === UserRole.PLATFORM_ADMIN || role === UserRole.DEMO) {
    // assertCanAccessStudent has already enforced global-admin or explicit-grant access.
    staffCourseIds = learnerCourseIds;
  }

  return getAuthorizedStudentCourseIds(staffCourseIds, learnerCourseIds);
}
