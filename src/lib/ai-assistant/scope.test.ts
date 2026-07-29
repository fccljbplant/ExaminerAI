/**
 * Scope Resolver Tests
 *
 * Confirms:
 * 1. An instructor's scope does NOT include students outside their courses
 * 2. A principal's scope includes all institution students
 * 3. A counselor's scope includes students + teachers but not courses
 * 4. A coordinator's scope includes courses but not students
 */
import { describe, it, expect, beforeAll } from "vitest";
import { resolveAssistantScope, assertStudentInScope } from "@/lib/ai-assistant/scope";
import { db } from "@/lib/db";

describe("AI Assistant — Scope Resolver", () => {
  let instructorId: string;
  let teacherStudentId: string; // student in teacher's batch
  let otherStudentId: string; // student NOT in teacher's batch
  let principalId: string;
  let counselorId: string;
  let coordinatorId: string;
  let institutionId: string;

  beforeAll(async () => {
    // Find a teacher (or instructor - for backward compat)
    const teacher = await db.user.findFirst({ where: { role: "instructor" } });
    instructorId = teacher!.id;

    // Find a principal
    const principal = await db.user.findFirst({ where: { role: "principal" } });
    principalId = principal!.id;

    // Find a counselor
    const counselor = await db.user.findFirst({ where: { role: "counselor" } });
    counselorId = counselor!.id;

    // Find a coordinator
    const coordinator = await db.user.findFirst({ where: { role: "coordinator" } });
    coordinatorId = coordinator!.id;

    institutionId = teacher!.institutionId!;

    // Find the instructor's courses via CourseEnrollment
    const instructorCourses = await db.courseEnrollment.findMany({
      where: { userId: instructorId, role: "instructor" },
      select: { courseId: true },
    });
    const teacherCourseIds = instructorCourses.map(ec => ec.courseId);

    // Find a student enrolled in one of the instructor's courses
    const inCourseEnrollment = await db.courseEnrollment.findFirst({
      where: { courseId: { in: teacherCourseIds }, role: "student" },
      select: { userId: true },
    });
    teacherStudentId = inCourseEnrollment!.userId;

    // Find all student IDs enrolled in the instructor's courses
    const enrolledInCourses = await db.courseEnrollment.findMany({
      where: { courseId: { in: teacherCourseIds }, role: "student" },
      select: { userId: true },
    });
    const enrolledStudentIds = enrolledInCourses.map(e => e.userId);

    // Find a student NOT in any of the instructor's courses
    const outOfBatchStudent = await db.user.findFirst({
      where: { role: "student", id: { notIn: enrolledStudentIds }, institutionId },
    });
    otherStudentId = outOfBatchStudent!.id;
  });

  it("instructor scope includes only students in their courses", async () => {
    const scope = await resolveAssistantScope(instructorId, "instructor");

    expect(scope.studentIds).toContain(teacherStudentId);
    expect(scope.studentIds).not.toContain(otherStudentId);
    expect(scope.isInstitutionWide).toBe(false);
  });

  it("instructor scope does NOT include students outside their courses (security guarantee)", async () => {
    const scope = await resolveAssistantScope(instructorId, "instructor");

    // This is the core security assertion
    const inScope = await assertStudentInScope(scope, otherStudentId);
    expect(inScope).toBe(false);
  });

  it("principal scope includes all institution students", async () => {
    const scope = await resolveAssistantScope(principalId, "principal");

    expect(scope.isInstitutionWide).toBe(true);
    expect(scope.studentIds.length).toBeGreaterThan(0);
    expect(scope.studentIds).toContain(teacherStudentId);
    expect(scope.studentIds).toContain(otherStudentId);
  });

  it("counselor scope includes students + teachers but not courses", async () => {
    const scope = await resolveAssistantScope(counselorId, "counselor");

    expect(scope.studentIds.length).toBeGreaterThan(0);
    expect(scope.instructorIds.length).toBeGreaterThan(0);
    expect(scope.courseIds).toEqual([]);
    expect(scope.isInstitutionWide).toBe(false);
  });

  it("coordinator scope includes courses/batches but not students", async () => {
    const scope = await resolveAssistantScope(coordinatorId, "coordinator");

    expect(scope.courseIds.length).toBeGreaterThan(0);
    expect(scope.studentIds).toEqual([]);
    expect(scope.isInstitutionWide).toBe(false);
  });
});
