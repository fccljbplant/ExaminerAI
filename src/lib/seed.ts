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
 * Idempotent seed: creates the admin account + a default course + a default batch.
 *
 * The default course ("Modern Web Dev & AI Bootcamp (Default)") is marked
 * isDefault=true and linked to the Default Batch. This ensures that newly-
 * approved students automatically land in a batch with a real course —
 * they don't see the "No course assigned yet" notice.
 *
 * The default batch ("Default Batch") ensures that new students who
 * are approved without a specific batch assignment still have a batch
 * to belong to. Without this, students get batchId = null which means
 * they can't be assigned courses and the struggle detection can't
 * group them properly.
 *
 * Admin account:
 *   - admin@examiner.ai (developer super-account, env-driven password)
 *
 * To test the full workflow:
 *   1. Sign up a student via the login page
 *   2. Admin approves the student (→ Default Batch → default course)
 *   3. Student sees the course outline + daily tasks immediately
 *   4. Student does daily check-ins, answers questions, takes weekly tests
 *   5. Teacher views student portfolio + adds comments
 */
export async function seedDatabase(): Promise<void> {
  await ensureAdminUser();

  // Make sure admin is flagged as approved (in case the row pre-existed).
  // Non-blocking — on read-only DBs this is a no-op.
  db.user.update({
    where: { email: ADMIN_EMAIL },
    data: { role: "admin", approvedAt: new Date() },
  }).catch(() => {});

  // Ensure the default course exists + is marked isDefault. This is the course
  // that newly-approved students get when they land in the Default Batch.
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
      // Backfill: mark the existing default course as isDefault
      await db.course.update({ where: { id: course.id }, data: { isDefault: true } });
    }
    defaultCourseId = course.id;

    // Unset isDefault on any OTHER courses that may have it set
    if (defaultCourseId) {
      await db.course.updateMany({
        where: { isDefault: true, id: { not: defaultCourseId } },
        data: { isDefault: false },
      });
    }
  } catch {
    // Non-blocking — on read-only DBs this is a no-op.
  }

  // Ensure a default batch exists, linked to the default course so approved
  // students automatically see the course outline + daily tasks.
  try {
    const existing = await db.batch.findUnique({ where: { name: "Default Batch" } });
    if (!existing) {
      await db.batch.create({
        data: {
          name: "Default Batch",
          description: "Auto-created default batch for students without a specific assignment.",
          courseId: defaultCourseId, // link to the default course (may be null if course creation failed)
        },
      });
    } else if (defaultCourseId && existing.courseId !== defaultCourseId) {
      // Backfill: link the existing Default Batch to the default course
      await db.batch.update({
        where: { id: existing.id },
        data: { courseId: defaultCourseId },
      });
    }
  } catch {
    // Non-blocking — on read-only DBs this is a no-op.
  }
}
