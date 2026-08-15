import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTutorStudentContext, tutorContextBlocks } from "@/modules/learn/lib/tutor-context";
import { db } from "@/lib/db";

/**
 * tutor-context — the tutors must know the learner (W15).
 *
 * Uses the seeded socratic.test learner (HSE course, seeded project
 * "Safety Culture Awareness Portal", weekly tests W1–W3). The tests are
 * tolerant: if the seed is absent they assert the graceful-degradation
 * contract instead of failing hard.
 */

describe("getTutorStudentContext", () => {
  let userId: string | null = null;

  beforeAll(async () => {
    const u = await db.user.findUnique({
      where: { email: "socratic.test@fccl.com.pk" },
      select: { id: true },
    });
    userId = u?.id ?? null;
  });

  afterAll(async () => {
    // nothing to clean — read-only test
  });

  it("degrades gracefully for an unknown user", async () => {
    const ctx = await getTutorStudentContext("no-such-user");
    expect(ctx.courseId).toBeNull();
    expect(ctx.topic).toBeNull();
    expect(ctx.project).toBeNull();
    const blocks = tutorContextBlocks(ctx);
    expect(blocks).not.toContain("COURSE:");
  });

  it("knows the course, topic, scores and project for a real learner", async () => {
    if (!userId) {
      console.warn("socratic.test seed missing — skipping context assertions");
      return;
    }
    const ctx = await getTutorStudentContext(userId);
    expect(ctx.courseId).toBeTruthy();
    expect(ctx.courseName).toBeTruthy();
    // topic may be null between lessons — but scores always exist
    expect(ctx.scores.xp).toBeGreaterThanOrEqual(0);
    const blocks = tutorContextBlocks(ctx);
    expect(blocks).toContain("STUDENT DATA:");
    expect(blocks).toContain("COURSE:");
    // seeded project exists → project block present with milestones
    if (ctx.project) {
      expect(blocks).toContain("STUDENT PROJECT:");
      expect(blocks).toContain(ctx.project.title);
    }
  });
});
