import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBatchFilter, getTeacherBatchIds, canAccessBatch } from "@/lib/batch-teachers";
import { requireRole, UserRole, hasRole, ADMIN_ROLES } from "@/lib/rbac";

/** GET /api/batch/question-outliers — detect questions that are hard
 *  for everyone, not just one student.
 *
 *  Groups Interaction rows by topic within the teacher's batch, computes
 *  correctness distribution. Flags as outlier where avg(correctness) is
 *  in the bottom 20% AND at least 5 students attempted.
 *
 *  No AI call — this is a straightforward aggregate query.
 */

export async function GET(req: NextRequest) {
  const auth = await requireRole([
    UserRole.TEACHER, UserRole.TEACHING_ASSISTANT,
    UserRole.COURSE_COORDINATOR, UserRole.COUNSELOR,
    UserRole.PRINCIPAL, UserRole.ADMINISTRATOR,
  ]);
  if (!auth.ok) return auth.response;

  const teacherId = auth.ctx.payload.sub;

  // Get teacher's batch
  const teacher = await db.user.findUnique({
    where: { id: teacherId },
    select: { batchId: true },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  // Get student IDs in the teacher's batch
  const students = await db.user.findMany({
    where: {
      role: "student",
      blocked: false,
      ...(await getBatchFilter(auth.ctx.payload.sub, auth.ctx.payload.role)),
    },
    select: { id: true },
  });
  const studentIds = students.map(s => s.id);

  if (studentIds.length === 0) {
    return NextResponse.json({ outliers: [] });
  }

  // Fetch all interactions for these students
  const interactions = await db.interaction.findMany({
    where: { userId: { in: studentIds } },
    select: { userId: true, topic: true, correctness: true, question: true, studentAnswer: true },
    take: 1000,
  });

  // Group by topic (or question if available)
  const byTopic = new Map<string, { scores: number[]; studentIds: Set<string>; questions: string[]; answers: Array<{ userId: string; answer: string; score: number }> }>();

  for (const interaction of interactions) {
    const key = interaction.topic || "Unknown";
    if (!byTopic.has(key)) {
      byTopic.set(key, { scores: [], studentIds: new Set(), questions: [], answers: [] });
    }
    const group = byTopic.get(key)!;
    group.scores.push(interaction.correctness);
    group.studentIds.add(interaction.userId);
    if (interaction.question && !group.questions.includes(interaction.question)) {
      group.questions.push(interaction.question);
    }
    if (interaction.studentAnswer) {
      group.answers.push({ userId: interaction.userId, answer: interaction.studentAnswer, score: interaction.correctness });
    }
  }

  // Compute averages and flag outliers
  const allAverages = Array.from(byTopic.entries()).map(([topic, group]) => ({
    topic,
    avgScore: group.scores.length > 0 ? group.scores.reduce((a, b) => a + b, 0) / group.scores.length : 0,
    studentCount: group.studentIds.size,
    questions: group.questions,
    answers: group.answers.slice(0, 10), // cap for response size
  }));

  // Sort by average score ascending
  allAverages.sort((a, b) => a.avgScore - b.avgScore);

  // Flag bottom 20% with at least 5 students
  const threshold = allAverages.length > 0 ? allAverages[Math.floor(allAverages.length * 0.2)].avgScore : 0;
  const outliers = allAverages.filter(a =>
    a.studentCount >= 5 &&
    a.avgScore <= threshold &&
    a.avgScore < 60 // absolute floor — don't flag things that are just "medium hard"
  );

  return NextResponse.json({
    outliers: outliers.map(o => ({
      topic: o.topic,
      averageScore: Math.round(o.avgScore),
      studentCount: o.studentCount,
      questions: o.questions.slice(0, 3),
      sampleAnswers: o.answers,
    })),
    totalTopics: allAverages.length,
  });
}
