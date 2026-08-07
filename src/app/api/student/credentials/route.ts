import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

/** GET /api/student/credentials — Phase 6.
 *
 *  Returns the authenticated student's:
 *    - certificates (with shareable verify URLs)
 *    - milestones (skill-verified professional achievements)
 *    - capstone project info (GitHub + live demo links)
 *    - per-topic skill mastery (computed from interactions when no persisted
 *      SkillMastery rows exist)
 *
 *  Auth required. Students see only their own data.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json(
      { error: "Only students can access their credentials" },
      { status: 403 }
    );
  }

  try {
    // Parallel: certificates, milestones, skill mastery + interactions
    const [certificates, milestones, persistedMastery, interactions] = await Promise.all([
      db.certificate.findMany({
        where: { userId: user.id },
        orderBy: { issuedAt: "desc" },
        include: {
          course: {
            select: {
              id: true,
              name: true,
              category: true,
              level: true,
              durationWeeks: true,
              instructorName: true,
            },
          },
        },
      }),
      db.milestone.findMany({
        where: { userId: user.id },
        orderBy: { earnedAt: "desc" },
      }),
      db.skillMastery.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          topic: true,
          pillar: true,
          masteryLevel: true,
          evidenceCount: true,
          lastAssessedWeek: true,
          trend: true,
        },
      }),
      db.interaction.findMany({
        where: { userId: user.id },
        select: { topic: true, pillar: true, correctness: true, week: true, date: true },
        orderBy: { date: "asc" },
      }),
    ]);

    // Shape certificates for the client (parse skillsVerified JSON, build verify URL)
    const shapedCerts = certificates.map((c) => {
      let skillsVerified: string[] = [];
      try {
        const parsed = JSON.parse(c.skillsVerified || "[]");
        if (Array.isArray(parsed)) skillsVerified = parsed.filter((s): s is string => typeof s === "string");
      } catch {
        skillsVerified = [];
      }
      const publicId = c.credentialId ?? c.verifyToken;
      return {
        id: c.id,
        credentialId: c.credentialId,
        courseName: c.courseName,
        studentName: c.studentName,
        grade: c.grade,
        score: c.score,
        issuedAt: c.issuedAt.toISOString(),
        signedBy: c.signedBy,
        distinction: c.distinction,
        capstonePassed: c.capstonePassed,
        skillsVerified,
        verifyUrl: `/verify/${publicId}`,
        course: c.course,
      };
    });

    // Shape milestones (parse evidence JSON)
    const shapedMilestones = milestones.map((m) => {
      let evidence: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(m.evidence || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          evidence = parsed as Record<string, unknown>;
        }
      } catch {
        evidence = {};
      }
      return {
        id: m.id,
        type: m.type,
        courseId: m.courseId,
        title: m.title,
        description: m.description,
        evidence,
        earnedAt: m.earnedAt.toISOString(),
      };
    });

    // Compute skill mastery if no persisted rows
    let skillMastery = persistedMastery;
    if (skillMastery.length === 0 && interactions.length > 0) {
      const byTopic = new Map<string, typeof interactions>();
      for (const i of interactions) {
        const arr = byTopic.get(i.topic) || [];
        arr.push(i);
        byTopic.set(i.topic, arr);
      }
      skillMastery = Array.from(byTopic.entries()).map(([topic, items]) => {
        const avg = items.reduce((a, i) => a + i.correctness, 0) / items.length;
        const masteryLevel = avg >= 90 ? "mastered" : avg >= 75 ? "proficient" : avg >= 50 ? "developing" : "not-started";
        const first = items[0]?.correctness ?? 0;
        const last = items[items.length - 1]?.correctness ?? 0;
        const trend = last - first > 10 ? "improving" : last - first < -10 ? "declining" : "stable";
        return {
          id: `computed-${topic}`,
          topic,
          pillar: items[0]?.pillar || "Uncategorized",
          masteryLevel,
          evidenceCount: items.length,
          lastAssessedWeek: items[items.length - 1]?.week ?? null,
          trend,
        };
      });
    }

    return NextResponse.json({
      certificates: shapedCerts,
      milestones: shapedMilestones,
      skillMastery,
      capstone: {
        projectName: user.projectName,
        projectDescription: user.projectDescription,
        githubUrl: user.projectGithubUrl,
        liveDemoUrl: user.projectDeployUrl,
      },
    });
  } catch (err) {
    logger.error("Failed to fetch student credentials", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to load credentials" },
      { status: 500 }
    );
  }
}
