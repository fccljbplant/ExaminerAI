import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { demoWriteBlock } from "@/lib/demo-guard";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";

/** POST /api/students/[id]/rehearse — practice a hard conversation
 *  against an AI playing a plausible version of the student.
 *
 *  Actions: start | reply | end (same pattern as daily-test/weekly-test)
 *  Session is ephemeral — NOT persisted by default.
 *
 *  IMPORTANT GUARDRAIL: This is a simulation for teacher practice, not
 *  a prediction. The AI's responses are plausible, not prophetic.
 */

interface RehearseMessage {
  role: "instructor" | "student_sim";
  content: string;
  timestamp: string;
}

const MAX_EXCHANGES = 8;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlock = await demoWriteBlock("rehearsing"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role === "student") return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const { id } = await params;
  try { await assertCanAccessStudent(payload, id); } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  // Demo AI enable/disable check (admin-configurable)
  const isDemoUser = payload.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled by the administrator." }, { status: 403 });
  }

  // Per-user daily rate limit (assistant category — student-detail tools)
  const category = categoryForFeature("rehearse-reply");
  const limit = await checkUserAILimit(payload.sub, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI Assistant limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
      category,
      used: limit.used,
      limit: limit.limit,
      resetAt: limit.resetAt.toISOString(),
    }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, conversation, teacherReply, scenario } = body as {
    action?: "start" | "reply" | "end";
    conversation?: RehearseMessage[];
    teacherReply?: string;
    scenario?: string;
  };

  // Fetch student evidence for the AI persona
  const [student, interactions, psychEvidence, wellbeing] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { name: true, currentWeek: true } }),
    db.interaction.findMany({ where: { userId: id }, orderBy: { date: "desc" }, take: 10, select: { studentAnswer: true, topic: true } }),
    db.psychEvidence.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 5, select: { dimension: true, value: true, evidenceText: true } }),
    db.wellbeingState.findUnique({ where: { userId: id }, select: { tier: true, reasonsJson: true } }),
  ]);
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  let reasons: string[] = [];
  try { reasons = JSON.parse(wellbeing?.reasonsJson || "[]"); } catch {}

  // Build student persona prompt
  const personaContext = {
    name: student.name,
    currentWeek: student.currentWeek,
    wellbeingTier: wellbeing?.tier || "green",
    concerns: reasons,
    answerStyle: interactions.slice(0, 5).map(i => i.studentAnswer?.slice(0, 100)).filter(Boolean),
    psychSignals: psychEvidence.map(e => `${e.dimension}: ${e.value}`),
  };

  const systemPrompt = `You are SIMULATING a student named ${student.name} for an instructor's practice conversation. This is a REHEARSAL — not a prediction of how the real student will respond.

Student persona (based on real evidence):
${JSON.stringify(personaContext, null, 2)}

Scenario: ${scenario || "General check-in conversation"}

Rules:
1. Respond as this student would plausibly respond — use their communication style (brief, detailed, formal, casual) from the answer samples.
2. Stay in character — don't break the simulation.
3. If the teacher asks something the student wouldn't know, say so in character.
4. Never provide information the real student hasn't shared.
5. Write in Roman (Latin) script. Match the student's language from their answers.
6. Keep responses short — 1-3 sentences, like a real student in a conversation.

IMPORTANT: This is a SIMULATION for teacher practice. It is NOT a prediction of how the real conversation will go. The teacher should not treat this as fact about the student.`;

  // ---- ACTION: START ----
  if (action === "start") {
    const conv: RehearseMessage[] = [{
      role: "student_sim",
      content: `(${student.name} is available to talk. Start the conversation when you're ready.)`,
      timestamp: new Date().toISOString(),
    }];
    return NextResponse.json({ conversation: conv, exchangeCount: 0, maxExchanges: MAX_EXCHANGES, warning: "This is a rehearsal simulation, not a prediction. The real student may respond differently." });
  }

  // ---- ACTION: REPLY ----
  if (action === "reply" && teacherReply?.trim()) {
    const conv: RehearseMessage[] = [...(conversation || []), {
      role: "instructor", content: teacherReply.trim(),
      timestamp: new Date().toISOString(),
    }];

    const exchangeCount = conv.filter(m => m.role === "instructor").length;
    const isLastExchange = exchangeCount >= MAX_EXCHANGES;

    const aiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...conv.map(m => ({
        role: (m.role === "instructor" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
    ];

    if (isLastExchange) {
      conv.push({ role: "student_sim", content: "(End of rehearsal session. This was a simulation — not a prediction of the real student's responses.)", timestamp: new Date().toISOString() });
      return NextResponse.json({ conversation: conv, exchangeCount, maxExchanges: MAX_EXCHANGES, isComplete: true });
    }

    try {
      const result = await callAI(aiMessages, { feature: "rehearse-reply", temperature: 0.6, maxTokens: TOKEN_BUDGET.WEEKLY_TEST_REPLY, userId: payload.sub });
      conv.push({ role: "student_sim", content: result.text?.trim() || "...", timestamp: new Date().toISOString() });
      return NextResponse.json({ conversation: conv, exchangeCount, maxExchanges: MAX_EXCHANGES, isComplete: false });
    } catch {
      conv.push({ role: "student_sim", content: "(Unable to generate response. Try again.)", timestamp: new Date().toISOString() });
      return NextResponse.json({ conversation: conv, exchangeCount, maxExchanges: MAX_EXCHANGES, isComplete: false });
    }
  }

  // ---- ACTION: END ----
  if (action === "end") {
    return NextResponse.json({
      conversation: conversation || [],
      isComplete: true,
      warning: "Rehearsal ended. This was a simulation — not a prediction. The real student may respond differently.",
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
