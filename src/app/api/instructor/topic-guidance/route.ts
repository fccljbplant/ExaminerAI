import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole } from "@/lib/rbac";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/instructor/topic-guidance — AI drafts guidance for future
 *  question generation on a topic, based on actual wrong answers.
 *
 *  Teacher approves/edits before it's saved to CourseDay.instructorNote.
 *  The note gets injected into future question generation prompts.
 */

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing topic guidance"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { topic, sampleAnswers } = body as { topic?: string; sampleAnswers?: Array<{ answer: string; score: number }> };

  if (!topic?.trim()) return NextResponse.json({ error: "topic required" }, { status: 400 });
  if (!sampleAnswers || sampleAnswers.length === 0) return NextResponse.json({ error: "sampleAnswers required" }, { status: 400 });

  const prompt = `You are helping improve future AI-generated questions on the topic "${topic}".

Students struggled with this topic. Here are their actual answers (scores 0-100):
${sampleAnswers.slice(0, 10).map(a => `- Score ${a.score}: "${a.answer.slice(0, 200)}"`).join("\n")}

Write 1-2 sentences of guidance for future question generation on this topic. Focus on what to clarify or approach differently so students understand better. Do NOT write a new question — just guidance for the AI that generates questions next time.

Example: "Clarify the distinction between GET and POST with a concrete example (like a login form) before testing the concept. Students confuse the data visibility difference."

Guidance:`;

  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = auth.ctx.payload.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(auth.ctx.payload.sub, "topic-guidance", isDemo);
    if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

    const result = await callAI([{ role: "user", content: prompt }], {
      feature: "topic-guidance", temperature: 0.3, maxTokens: 150,
      userId: auth.ctx.payload.sub, // H12 fix: attribute to the teacher
    });
    return NextResponse.json({ guidance: result.text?.trim() || "" });
  } catch {
    return NextResponse.json({ guidance: "" });
  }
}

/** PUT /api/instructor/topic-guidance — save approved guidance to CourseDay */
export async function PUT(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("managing topic guidance"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.PRINCIPAL, UserRole.ADMINISTRATOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { courseDayId, instructorNote } = body as { courseDayId?: string; instructorNote?: string };

  if (!courseDayId?.trim()) return NextResponse.json({ error: "courseDayId required" }, { status: 400 });
  if (instructorNote === undefined) return NextResponse.json({ error: "instructorNote required" }, { status: 400 });
  if (instructorNote.length > 500) return NextResponse.json({ error: "instructorNote too long (max 500 chars)" }, { status: 400 });

  const updated = await db.courseDay.update({
    where: { id: courseDayId },
    data: { instructorNote },
  }).catch(() => null);

  if (!updated) return NextResponse.json({ error: "CourseDay not found" }, { status: 404 });
  return NextResponse.json({ ok: true, courseDay: { id: updated.id, instructorNote: updated.instructorNote } });
}
