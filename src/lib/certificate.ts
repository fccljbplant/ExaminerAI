/**
 * Certificate generation utility — Phase 6.
 *
 * Issue flow:
 *   1. Check the student has CurriculumProgress rows for every course week.
 *   2. Average score across completed weekly tests must be >= 75.
 *   3. On success:
 *      - Create a Certificate with a human-readable `credentialId`.
 *      - Set distinction=true when score >= 85.
 *      - Set capstonePassed when the student has any completed project task.
 *      - Set skillsVerified from the course's `skillsVerified` JSON.
 *      - Create a Milestone (course_completion, + distinction when applicable).
 *      - Fire a `credential_earned` notification (best-effort).
 *
 * The function is IDEMPOTENT — calling it twice for the same user+course
 * returns the existing certificate instead of creating a duplicate.
 *
 * This module is safe to call fire-and-forget from API routes (e.g. the
 * weekly-test route calls it after a test is marked "completed").
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { scoreToGrade } from "@/lib/constants";
import { sendCredentialEarned, sendMilestoneEarned } from "@/lib/email";

/** Public credential-ID prefix — TraineesAI. */
const CREDENTIAL_PREFIX = "TRN-AI";

/** Minimum average score required to earn a certificate. */
export const CERTIFICATE_MIN_SCORE = 75;

/** Score required for "with Distinction" (cert.distinction = true). */
export const DISTINCTION_MIN_SCORE = 85;

/** Platform fee share — 20% of every payment. */
export const PLATFORM_FEE_RATE = 0.2;

/** Instructor revenue share — 80% of every payment. */
export const INSTRUCTOR_SHARE_RATE = 0.8;

/**
 * Generate a human-readable credential ID like "TRN-AI-2026-08-NA-87".
 *
 * Format: PREFIX-YEAR-MONTH-INITIALS-SCORE
 *   - PREFIX: "TRN-AI"
 *   - YEAR: 4-digit year (issuedAt, UTC)
 *   - MONTH: 2-digit month (01-12)
 *   - INITIALS: 1-2 uppercase letters derived from the student's name
 *     (falls back to course-name initials when the student name is too short)
 *   - SCORE: integer percentage (0-100)
 *
 * `salt` is an optional disambiguator appended when a previous credential
 * already holds the base ID (collision retry). When salted, the format
 * becomes "TRN-AI-2026-08-NA-87-2", "-3", …
 */
export function generateCredentialId(
  studentName: string,
  courseName: string,
  score: number,
  salt = 0,
): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const initials = computeInitials(studentName, courseName);
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const base = `${CREDENTIAL_PREFIX}-${year}-${month}-${initials}-${safeScore}`;
  return salt > 0 ? `${base}-${salt}` : base;
}

/** Derive 1-2 uppercase initials from the student name, falling back to the
 *  course name when the student name doesn't yield enough characters. */
function computeInitials(studentName: string, courseName: string): string {
  const nameParts = studentName.trim().split(/\s+/).filter(Boolean);
  let initials = "";
  if (nameParts.length >= 2) {
    initials = (nameParts[0][0] || "") + (nameParts[1][0] || "");
  } else if (nameParts.length === 1) {
    initials = nameParts[0].slice(0, 2);
  }
  if (initials.length < 2) {
    const courseParts = courseName.trim().split(/\s+/).filter(Boolean);
    const courseInitials = courseParts.map(p => p[0] || "").join("");
    initials = (initials + courseInitials).slice(0, 2);
  }
  return (initials.toUpperCase().padEnd(2, "X")).slice(0, 2);
}

/** Eligibility snapshot returned by `checkEligibility`. Useful for surfacing
 *  "Week X of Y, avg Z%" in the UI without issuing the certificate. */
export interface CertificateEligibility {
  eligible: boolean;
  hasCertificate: boolean;
  avgScore: number;
  weeksCompleted: number;
  totalWeeks: number;
  capstonePassed: boolean;
}

/** Inspect a student's progress + scores without issuing anything. */
export async function checkEligibility(
  userId: string,
  courseId: string,
): Promise<CertificateEligibility | null> {
  try {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        weeks: { select: { weekNumber: true }, orderBy: { weekNumber: "asc" } },
      },
    });
    if (!course) return null;

    const totalWeeks = course.weeks.length;
    if (totalWeeks === 0) {
      return {
        eligible: false,
        hasCertificate: false,
        avgScore: 0,
        weeksCompleted: 0,
        totalWeeks: 0,
        capstonePassed: false,
      };
    }

    const [progressRows, tests, existingCert, completedTask] = await Promise.all([
      db.curriculumProgress.findMany({
        where: { userId, courseId },
        select: { week: true },
      }),
      db.weeklyTest.findMany({
        where: { userId, courseId, status: "completed", score: { not: null } },
        select: { score: true },
      }),
      db.certificate.findFirst({
        where: { userId, courseId, grade: { not: "PENDING" } },
        select: { id: true },
      }),
      db.projectTask.findFirst({
        where: { userId, courseId, status: "completed" },
        select: { id: true },
      }),
    ]);

    const completedWeeksSet = new Set(progressRows.map(p => p.week));
    const weeksCompleted = course.weeks.filter(w => completedWeeksSet.has(w.weekNumber)).length;
    const avgScore = tests.length > 0
      ? Math.round(tests.reduce((s, t) => s + (t.score ?? 0), 0) / tests.length)
      : 0;
    const allWeeksCompleted = weeksCompleted >= totalWeeks;

    const eligible =
      !existingCert &&
      allWeeksCompleted &&
      tests.length > 0 &&
      avgScore >= CERTIFICATE_MIN_SCORE;

    return {
      eligible,
      hasCertificate: Boolean(existingCert),
      avgScore,
      weeksCompleted,
      totalWeeks,
      capstonePassed: Boolean(completedTask),
    };
  } catch (err) {
    logger.error("checkEligibility failed", {
      userId,
      courseId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Return value from `issueCertificate`. */
export interface IssueCertificateResult {
  /** The certificate row (newly issued OR pre-existing). */
  certificate: CertificateRow;
  /** true when a NEW certificate was created in this call;
   *  false when we returned a pre-existing one (idempotent path). */
  issued: boolean;
}

/** Minimal subset of the Certificate row we expose to callers. */
export type CertificateRow = Awaited<ReturnType<typeof db.certificate.findFirst>> & {};

/**
 * Idempotently issue a verified certificate for completing a course.
 *
 * Returns:
 *   - { certificate, issued: false } — if a cert already existed.
 *   - { certificate, issued: true }  — if we created a new cert this call.
 *   - null                            — if the student isn't eligible.
 *
 * All side effects (milestones, notifications) are best-effort and never
 * throw out of this function — they're caught + logged.
 */
export async function issueCertificate(
  userId: string,
  courseId: string,
): Promise<IssueCertificateResult | null> {
  try {
    // 0) Idempotency — if a non-pending cert already exists, return it.
    const existing = await db.certificate.findFirst({
      where: { userId, courseId, grade: { not: "PENDING" } },
    });
    if (existing) {
      return { certificate: existing, issued: false };
    }

    // 1) Fetch course + user + enrollment.
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        skillsVerified: true,
        weeks: { select: { weekNumber: true }, orderBy: { weekNumber: "asc" } },
      },
    });
    if (!course) return null;

    const [enrollment, user] = await Promise.all([
      db.courseEnrollment.findFirst({
        where: { userId, courseId, role: "student" },
        select: { id: true },
      }),
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      }),
    ]);
    if (!enrollment || !user) return null;

    const totalWeeks = course.weeks.length;
    if (totalWeeks === 0) return null;

    // 2) Check CurriculumProgress for all weeks (any day counts).
    const progressRows = await db.curriculumProgress.findMany({
      where: { userId, courseId },
      select: { week: true },
    });
    const completedWeeksSet = new Set(progressRows.map(p => p.week));
    const allWeeksCompleted = course.weeks.every(w => completedWeeksSet.has(w.weekNumber));
    if (!allWeeksCompleted) return null;

    // 3) Calculate avg score from completed weekly tests.
    const tests = await db.weeklyTest.findMany({
      where: { userId, courseId, status: "completed", score: { not: null } },
      select: { score: true },
    });
    if (tests.length === 0) return null;
    const avgScore = Math.round(tests.reduce((s, t) => s + (t.score ?? 0), 0) / tests.length);
    if (avgScore < CERTIFICATE_MIN_SCORE) return null;

    // 4) Capstone check — any completed project task for this course.
    const completedTask = await db.projectTask.findFirst({
      where: { userId, courseId, status: "completed" },
      select: { id: true },
    });
    const capstonePassed = Boolean(completedTask);

    // 5) Parse skills verified JSON.
    let skillsVerified: string[] = [];
    try {
      const parsed = JSON.parse(course.skillsVerified || "[]");
      if (Array.isArray(parsed)) {
        skillsVerified = parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {
      skillsVerified = [];
    }

    const distinction = avgScore >= DISTINCTION_MIN_SCORE;
    const grade = scoreToGrade(avgScore);
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const now = new Date();

    // 6) Create the certificate. Retry on credentialId collisions
    //    (rare: same student-name initials, same month, same score).
    const certificate = await createCertificateWithUniqueCredentialId({
      userId,
      courseId,
      courseName: course.name,
      studentName: user.name,
      grade,
      score: avgScore,
      signedBy: "TraineesAI Auto-Issue",
      verifyToken,
      capstonePassed,
      skillsVerified: JSON.stringify(skillsVerified),
      distinction,
      completedAt: now,
      issuedAt: now,
      studentNameRaw: user.name,
      courseNameRaw: course.name,
    });

    // 7) Milestones — best-effort. Use findFirst+create to avoid prisma
    //    upsert edge-cases with nullable courseId in the compound unique.
    await createMilestoneIfMissing({
      userId,
      courseId,
      type: "course_completion",
      title: `${course.name} — Score: ${avgScore}`,
      description: `Completed ${totalWeeks}-week professional training program with an average score of ${avgScore}%.`,
      evidence: { score: avgScore, capstonePassed, totalWeeks, skillsVerified, weeksCompleted: totalWeeks },
    });
    if (distinction) {
      await createMilestoneIfMissing({
        userId,
        courseId,
        type: "distinction",
        title: `${course.name} — With Distinction`,
        description: `Achieved a final score of ${avgScore}% (≥ ${DISTINCTION_MIN_SCORE}), earning the "With Distinction" credential.`,
        evidence: { score: avgScore, threshold: DISTINCTION_MIN_SCORE },
      });
    }

    // 8) Notifications — fire-and-forget.
    const credentialId = certificate.credentialId ?? certificate.verifyToken;
    void sendCredentialEarned(userId, course.name, credentialId).catch(() => {});
    void sendMilestoneEarned(userId, `${course.name} — Course Completion`, courseId).catch(() => {});

    logger.info("Certificate auto-issued", {
      userId,
      courseId,
      credentialId,
      score: avgScore,
      distinction,
      capstonePassed,
    });

    return { certificate, issued: true };
  } catch (err) {
    logger.error("Failed to issue certificate", {
      userId,
      courseId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Create a certificate, retrying with salted credentialIds when the
 *  base ID collides with an existing row. Tries up to 6 times. */
async function createCertificateWithUniqueCredentialId(
  data: {
    userId: string;
    courseId: string;
    courseName: string;
    studentName: string;
    grade: string;
    score: number;
    signedBy: string;
    verifyToken: string;
    capstonePassed: boolean;
    skillsVerified: string;
    distinction: boolean;
    completedAt: Date;
    issuedAt: Date;
    // Used to (re)generate the credentialId on retry:
    studentNameRaw: string;
    courseNameRaw: string;
  },
): Promise<NonNullable<Awaited<ReturnType<typeof db.certificate.create>>>> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const credentialId = generateCredentialId(
      data.studentNameRaw,
      data.courseNameRaw,
      data.score,
      attempt,
    );
    try {
      return await db.certificate.create({
        data: {
          userId: data.userId,
          courseId: data.courseId,
          courseName: data.courseName,
          studentName: data.studentName,
          grade: data.grade,
          score: data.score,
          signedBy: data.signedBy,
          verifyToken: data.verifyToken,
          credentialId,
          capstonePassed: data.capstonePassed,
          skillsVerified: data.skillsVerified,
          distinction: data.distinction,
          completedAt: data.completedAt,
          issuedAt: data.issuedAt,
        },
      });
    } catch (err: unknown) {
      lastErr = err;
      // Prisma unique-constraint violation code = "P2002".
      const code = (err as { code?: string } | null)?.code;
      if (code !== "P2002") break;
      // else retry with next salt.
    }
  }
  throw lastErr ?? new Error("Failed to create certificate after retries");
}

/** Insert a Milestone if one doesn't already exist for the same
 *  (userId, type, courseId). Best-effort — logs on failure. */
async function createMilestoneIfMissing(input: {
  userId: string;
  courseId: string;
  type: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
}): Promise<void> {
  try {
    const existing = await db.milestone.findFirst({
      where: { userId: input.userId, type: input.type, courseId: input.courseId },
      select: { id: true },
    });
    if (existing) return;
    await db.milestone.create({
      data: {
        userId: input.userId,
        courseId: input.courseId,
        type: input.type,
        title: input.title,
        description: input.description,
        evidence: JSON.stringify(input.evidence),
      },
    });
  } catch (err) {
    logger.warn("Milestone creation failed", {
      userId: input.userId,
      courseId: input.courseId,
      type: input.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
