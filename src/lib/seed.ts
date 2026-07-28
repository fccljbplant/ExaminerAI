import { db } from "./db";
import { ensureAdminUser, ADMIN_EMAIL } from "./auth";
import { WEEKLY_TOPICS } from "./course-topics";
import {
  DEFAULT_TEST_CONFIG,
  DEFAULT_REPORT_CARD_TEMPLATE,
  DEFAULT_PROJECT_TEMPLATE,
  DEFAULT_JOURNEY_STEPS,
  DEFAULT_AI_PROMPTS,
} from "./course-defaults";

/**
 * Idempotent seed: creates the admin account + a default course.
 *
 * Course-Centric Architecture:
 * - No Batch/BatchTeacher models — students are directly enrolled in courses
 *   via CourseEnrollment.
 * - The default course is marked isDefault=true for newly-approved students.
 * - The admin user is enrolled as "instructor" in the default course.
 *
 * Admin account:
 *   - admin@examiner.ai (developer super-account, env-driven password)
 */
export async function seedDatabase(): Promise<void> {
  await ensureAdminUser();

  // Make sure admin is flagged as approved.
  db.user.update({
    where: { email: ADMIN_EMAIL },
    data: { role: "admin", approvedAt: new Date() },
  }).catch(() => {});

  // Ensure the default course exists
  let defaultCourseId: string | null = null;
  try {
    const courseName = "Modern Web Dev & AI Bootcamp (Default)";
    let course = await db.course.findUnique({ where: { name: courseName } });
    if (!course) {
      course = await db.course.create({
        data: {
          name: courseName,
          domain: "technology",
          level: "beginner",
          assessmentType: "socratic",
          description: "The default 6-week Modern Web Development & AI Bootcamp curriculum.",
          journeyStepsJson: JSON.stringify(DEFAULT_JOURNEY_STEPS),
          projectTemplateJson: JSON.stringify(DEFAULT_PROJECT_TEMPLATE),
          aiPromptsJson: JSON.stringify(DEFAULT_AI_PROMPTS),
          testConfigJson: JSON.stringify(DEFAULT_TEST_CONFIG),
          reportCardTemplateJson: JSON.stringify(DEFAULT_REPORT_CARD_TEMPLATE),
          isDefault: true,
          weeks: {
            create: WEEKLY_TOPICS.map((wt) => ({
              weekNumber: wt.week,
              phase: wt.phase,
              milestone: "",
              days: {
                create: wt.topics.map((t, i) => ({
                  day: i + 1,
                  title: t.title,
                  objective: t.objective,
                  resources: JSON.stringify(t.resources),
                })),
              },
            })),
          },
        },
      });
    } else if (!course.isDefault) {
      await db.course.update({ where: { id: course.id }, data: { isDefault: true } });
    }
    defaultCourseId = course.id;

    if (defaultCourseId) {
      await db.course.updateMany({
        where: { isDefault: true, id: { not: defaultCourseId } },
        data: { isDefault: false },
      });
    }
  } catch {
    // Non-blocking
  }

  // Enroll the admin user as instructor in the default course
  if (defaultCourseId) {
    try {
      const adminUser = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
      if (adminUser) {
        const existing = await db.courseEnrollment.findUnique({
          where: { userId_courseId_role: { userId: adminUser.id, courseId: defaultCourseId, role: "instructor" } },
        });
        if (!existing) {
          await db.courseEnrollment.create({
            data: {
              userId: adminUser.id,
              courseId: defaultCourseId,
              role: "instructor",
            },
          });
        }
      }
    } catch {
      // Non-blocking
    }
  }
}