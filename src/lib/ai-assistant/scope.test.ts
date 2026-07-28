/**
 * Scope Resolver Tests (Section 1 VERIFY)
 *
 * Confirms:
 * 1. A teacher's scope does NOT include students outside their BatchTeacher batches
 * 2. A principal's scope includes all institution students
 * 3. A counselor's scope includes students + teachers but not courses
 * 4. A course_coordinator's scope includes courses/batches but not students
 */
import { describe, it, expect, beforeAll } from "vitest";
import { resolveAssistantScope, assertStudentInScope } from "@/lib/ai-assistant/scope";
import { db } from "@/lib/db";

describe("AI Assistant — Scope Resolver", () => {
  let teacherId: string;
  let teacherStudentId: string; // student in teacher's batch
  let otherStudentId: string; // student NOT in teacher's batch
  let principalId: string;
  let counselorId: string;
  let coordinatorId: string;
  let institutionId: string;

  beforeAll(async () => {
    // Find a teacher (or instructor - for backward compat)
    const teacher = await db.user.findFirst({ where: { role: { in: ["instructor", "teacher"] } } });
    teacherId = teacher!.id;

    // Find a principal
    const principal = await db.user.findFirst({ where: { role: "principal" } });
    principalId = principal!.id;

    // Find a counselor
    const counselor = await db.user.findFirst({ where: { role: "counselor" } });
    counselorId = counselor!.id;

    // Find a course_coordinator
    const coordinator = await db.user.findFirst({ where: { role: "course_coordinator" } });
    coordinatorId = coordinator!.id;

    institutionId = teacher!.institutionId!;

    // Find the teacher's batches
    const batchTeachers = await db.batchTeacher.findMany({
      where: { teacherId },
      select: { batchId: true },
    });
    const batchIds = batchTeachers.map(bt => bt.batchId);

    // Find a student in one of the teacher's batches
    const inBatchStudent = await db.user.findFirst({
      where: { role: "student", batchId: { in: batchIds } },
    });
    teacherStudentId = inBatchStudent!.id;

    // Find a student NOT in any of the teacher's batches
    const outOfBatchStudent = await db.user.findFirst({
      where: { role: "student", batchId: { notIn: batchIds }, institutionId },
    });
    otherStudentId = outOfBatchStudent!.id;
  });

  it("teacher scope includes only students in their batches", async () => {
    const scope = await resolveAssistantScope(teacherId, "teacher");

    expect(scope.studentIds).toContain(teacherStudentId);
    expect(scope.studentIds).not.toContain(otherStudentId);
    expect(scope.isInstitutionWide).toBe(false);
  });

  it("teacher scope does NOT include students outside their batches (security guarantee)", async () => {
    const scope = await resolveAssistantScope(teacherId, "teacher");

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
    expect(scope.teacherIds.length).toBeGreaterThan(0);
    expect(scope.courseIds).toEqual([]);
    expect(scope.isInstitutionWide).toBe(false);
  });

  it("course_coordinator scope includes courses/batches but not students", async () => {
    const scope = await resolveAssistantScope(coordinatorId, "course_coordinator");

    expect(scope.courseIds.length).toBeGreaterThan(0);
    expect(scope.studentIds).toEqual([]);
    expect(scope.isInstitutionWide).toBe(false);
  });
});
