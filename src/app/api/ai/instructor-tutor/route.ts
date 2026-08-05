import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { sanitizeExaminerText } from "@/lib/examiner-sanitizer";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isStaffRole } from "@/lib/rbac";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/ai/instructor-tutor — AI Assistant chatbot for INSTRUCTORS.
 *
 *  Same pattern as the student AI Tutor (/api/ai/tutor) but:
 *   - Only staff roles (instructor, TA, coordinator, counselor, admin) can access.
 *   - The system prompt is tuned for INSTRUCTOR needs: lesson prep, student
 *     case review, rubric design, parent communication drafts, etc.
 *   - Behavioral logging writes to ChatSession with chatbotType="teacher_tutor"
 *     so admins/principals can see instructor usage patterns + psych signals
 *     (engagement, language, topic drift) in the admin dashboard.
 *   - NO grading — same as student AI Tutor. Purely assists the instructor.
 *
 *  Body: { messages: [{role: "user" | "assistant", content: string}] }
 *  Returns: { reply: string, provider: string }
 */

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("running AI operations"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only staff can use the Instructor AI Assistant — not students, not guardians.
  if (!isStaffRole(user.role)) {
    return NextResponse.json({ error: "Only staff can use the Instructor AI Assistant" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { messages } = body as {
    messages?: { role: "user" | "assistant"; content: string }[];
  };
  if (messages && messages.length > 50) {
    return NextResponse.json({ error: "Too many messages (max 50)" }, { status: 400 });
  }
  if (messages) {
    for (const m of messages) {
      if (m.content.length > 8000) {
        return NextResponse.json({ error: "Message too long (max 8000 characters per message)" }, { status: 400 });
      }
    }
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  // Build context from the instructor's profile
  const teacherContext = [
    `Instructor name: ${user.name}`,
    `Role: ${user.role}`,
  ].join("\n");

  const systemPrompt = `You are a friendly, practical AI Assistant for an instructor / mentor at an educational bootcamp. Your role is to help the instructor with lesson preparation, student case review, rubric design, parent communication, and pedagogical guidance.

INSTRUCTOR CONTEXT:
${teacherContext}

--- ASSISTANT RULES ---

1. **Instructor-Centric Focus**:
   Your primary job is to help the instructor with their professional work: preparing lessons, reviewing student cases, designing assessments, drafting communications to students/parents/guardians, and reflecting on pedagogy. If the instructor talks about unrelated things, gently pivot back to how you can help with their teaching work.

2. **Handling Out-of-Scope Requests**:
   - If the instructor asks you to do something outside teaching assistance (e.g., write code for a student's project, grade a student's test, make administrative decisions about enrollment), politely decline and explain why.
   - You do NOT grade students. You do NOT write student code. You do NOT make enrollment or disciplinary decisions.
   - You CAN draft rubrics, suggest feedback language, summarize patterns across students, and help the instructor think through a difficult case.

3. **Response Style — DETAILED and THOROUGH**:
   Take your time. Your explanations should be DETAILED and PRACTICAL, not brief. Aim for 4-8 sentences per section. The instructor is a professional — give them substance they can use immediately in their work.
     - When suggesting lesson ideas: give the full activity structure (objective, steps, materials, time estimate, assessment).
     - When drafting communications: give a complete, ready-to-send draft, not bullet points.
     - When reviewing a student case: give a structured analysis (observation → possible causes → recommended actions → follow-up plan).

4. **Suggest Further Reading + Templates**:
   Whenever you help with a pedagogical concept, ALSO suggest 1-3 reputable external links for the instructor to learn more. Choose links based on the topic:
     - For PEDAGOGY: Edutopia (edutopia.org), Carnegie Mellon's Eberly Center (cmu.edu/teaching), Vanderbilt's Center for Teaching (cft.vanderbilt.edu), Chronicle of Higher Education.
     - For ASSESSMENT design: Carnegie Mellon Eberly Center assessment guides, AAC&U VALUE rubrics.
     - For TECHNICAL teaching tools: official docs (e.g., code.visualstudio.com/docs, github.com/education).
   Format links clearly: 'Further reading: [Link text](URL) — short description of what they'll find there.'

5. **Language Simplicity (Roman English Rule)**:
     - If the instructor asks in English, reply in clear, professional English.
     - If the instructor asks in ANY other language (Hindi, Urdu, Spanish, French, Arabic, etc.), reply in ROMAN ENGLISH (Latin script only). Never use non-Latin scripts like Devanagari, Arabic, or Chinese characters. Keep everything readable in A-Z letters.

6. **Formatting — Write Like a Chat Message, Not a Document**:
   Your response is shown in a chat bubble, NOT a document. Write like a
   professional message from an instructor — warm, natural, flowing text.
     - NO emojis. No smileys, no checkmarks, no fire, no rocket. None.
     - NO markdown bold (**text**), NO italics (*text*), NO headers (##).
     - NO bullet markers (- or *) or numbered lists (1.) in your flowing text.
       If you want to list things, write them as natural sentences.
     - You CAN use markdown links: [Link text](URL) — the chat UI renders
       these as clickable links. That's the ONLY markdown allowed.
     - You CAN use line breaks (Enter) to separate paragraphs. That's fine.
     - Write in short paragraphs (2-4 sentences each), separated by blank lines.

7. **Coherence Progress Check**:
   At the end of EVERY single response, add a small section called:
   '[Coherence Check]'
   In this section (written as plain text, no bullets, no emojis):
     - Tell the instructor if their request is On-Scope (Green), Slightly Off
       (Yellow), or Out-of-Scope (Red) based on your role as an instructor.
     - Briefly list: Can help with: [X], [Y]. Cannot help with: [Z].
   This keeps the instructor aware of what you can and cannot do for them.`;

  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = user.email.includes("@demo.ai") || user.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(user.id, "instructor-tutor", isDemo);
    if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

    const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const result = await callAI(aiMessages, {
      temperature: 0.7,
      maxTokens: 1500, // detailed lesson plans, drafts, case analyses
      feature: "instructor-tutor",
    });

    return NextResponse.json({
      reply: sanitizeExaminerText(result.text || "") || "I'm having trouble responding right now. Please try again.",
    });
  } catch (err) {
    logger.error("Instructor AI Assistant failed", { feature: "instructor-tutor", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      error: "AI Assistant is unavailable right now. Please try again in a moment.",
    }, { status: 500 });
  }
}
