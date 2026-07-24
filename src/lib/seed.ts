import { db } from "./db";
import { ensureAdminUser, ADMIN_EMAIL } from "./auth";

/**
 * Idempotent seed: creates the admin account + a default batch.
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
 *   2. Admin approves the student
 *   3. Student adds tasks via the Course Wizard (Project Plan tab)
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

  // Phase fix: Ensure a default batch exists so approved students can
  // be assigned to it. Without a batch, students get batchId = null
  // and the course-assignment system doesn't work for them.
  try {
    const existing = await db.batch.findUnique({ where: { name: "Default Batch" } });
    if (!existing) {
      await db.batch.create({
        data: {
          name: "Default Batch",
          description: "Auto-created default batch for students without a specific assignment.",
        },
      });
    }
  } catch {
    // Non-blocking — on read-only DBs this is a no-op.
  }
}
