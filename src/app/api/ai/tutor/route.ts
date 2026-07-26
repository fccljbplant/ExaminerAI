import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { sanitizeExaminerText } from "@/lib/examiner-sanitizer";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import {
  getCourseMetadata,
  getCourseWeekTopics,
  getCourseWeekPhase,
  getCourseDurationWeeks,
  getCourseTopics,
} from "@/lib/course-db";
import { trackTutorEngagement } from "@/modules/assessment/lib/engagement-tracker";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/ai/tutor — in-app AI Tutor chatbot.
 *
 *  Replaces the old NotebookLM iframe (which required a Chrome extension to
 *  bypass X-Frame-Options and didn't use the student's course context).
 *
 *  Uses the user-provided "friendly, practical, universal AI Tutor" system
 *  prompt with three dynamic placeholders filled from the student's data:
 *    - COURSE OUTLINE  ← full course outline (all weeks + topics)
 *    - STUDENT PROJECT ← the student's capstone project description
 *    - CURRENT TOPIC   ← the current week's phase + today's topic
 *
 *  The tutor also feeds behavioral signals (engagement, language, topic
 *  drift) into the same analysis pipeline as the test chatbots — so
 *  teacher dashboards update from tutor sessions too, not just tests.
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
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only students can use the AI Tutor" }, { status: 403 });
  }

  // Demo AI enable/disable check (admin-configurable)
  const isDemoUser = user.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled by the administrator." }, { status: 403 });
  }

  // Per-user daily rate limit (admin-configurable, default 150/day for tutor)
  const category = categoryForFeature("ai-tutor");
  const limit = await checkUserAILimit(user.id, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI Tutor limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
      category,
      used: limit.used,
      limit: limit.limit,
      resetAt: limit.resetAt.toISOString(),
    }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { messages } = body as {
    messages?: { role: "user" | "assistant"; content: string }[];
  };
  // Input caps — prevent monetary DoS
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

  // ---- Fetch course + project + week context in parallel ----
  const totalWeeks = await getCourseDurationWeeks(user.id);
  const week = Math.min(user.currentWeek, totalWeeks);
  const [courseMeta, weekTopics, weekPhase, fullCourseOutline] = await Promise.all([
    getCourseMetadata(user.id),
    getCourseWeekTopics(user.id, week),
    getCourseWeekPhase(user.id, week),
    getCourseTopics(user.id),
  ]);

  // ---- Build the three dynamic placeholders ----

  // COURSE OUTLINE — full curriculum, all weeks + their daily topics
  const courseOutlineText = fullCourseOutline.length > 0
    ? fullCourseOutline.map(w =>
        `Week ${w.week}: ${w.phase}\n${w.topics.map((t, i) => `  Day ${i + 1}: ${t.title}`).join("\n")}`
      ).join("\n\n")
    : "Course outline not yet configured. The student is in a beginner web development bootcamp.";

  // STUDENT PROJECT — the student's capstone project description
  const projectDescription = [
    user.projectName ? `Project name: ${user.projectName}` : null,
    user.projectDescription ? `Description: ${user.projectDescription}` : null,
    user.projectType ? `Type: ${user.projectType}` : null,
    user.projectScope ? `Scope: ${user.projectScope}` : null,
    user.projectObjectives ? `Objectives: ${user.projectObjectives}` : null,
  ].filter(Boolean).join("\n") || "The student has not yet defined their project. Encourage them to set up a project in the Journey tab.";

  // CURRENT TOPIC — where they are right now
  const currentTopicText = `Week ${week} of ${totalWeeks}: ${weekPhase}\nThis week's daily topics:\n${weekTopics.map((t, i) => `  Day ${i + 1}: ${t.title}`).join("\n") || "  (topics not loaded yet)"}`;

  // ---- Build the system prompt using the user's template ----
  // The user provided a specific system prompt with three [PASTE ...] placeholders.
  // We fill them dynamically from the student's data above.
  //
  // KEY DIFFERENCES from the test chatbots (practice/daily/weekly):
  //   - NO grading. The AI Tutor never gives a score. It explains + teaches.
  //   - LONGER, deeper explanations. The 3-step teaching method (analogy →
  //     generic example → project mapping) is mandatory for every concept.
  //   - Suggests reputable external links for further study AND for coding
  //     references (official docs, MDN, W3Schools, etc.) when relevant.
  const systemPrompt = `You are a nice, friendly, understanding, polite, and engaging AI Teacher. You guide students through their course, helping them understand concepts and complete their hands-on project. You are a TEACHER — not a peer, not a buddy, not a classmate. You speak with warmth and respect, using polite language. You never use slang, vulgar language, or overly casual words.

COURSE OUTLINE (The complete schedule/curriculum):
${courseOutlineText}

STUDENT PROJECT (The practical task they are building/achieving):
${projectDescription}

CURRENT TOPIC (Where they are right now in the course):
${currentTopicText}

--- TEACHING RULES ---

0. **NO GRADING — You Are a Teacher, Not an Examiner**:
   You NEVER grade, score, or evaluate the student. You do NOT give marks.
   You do NOT say "correct" or "incorrect". Your job is to EXPLAIN and TEACH,
   not to assess. If the student asks "how did I do?" or "what's my score?",
   redirect gently: "I am here to help you understand, not to grade you. Let
   us look at the concept together." Assessment happens in the test chatbots
   — your role is purely teaching.

1. **KEEP IT SHORT — Engage First, Explain Only When Needed**:
   This is the MOST IMPORTANT rule. Nobody reads essays in a chat. Your
   responses must be SHORT and CONVERSATIONAL — like a real teacher talking
   in a chat, not writing a textbook chapter.

   LENGTH GUIDELINES (strict):
   - Casual chat / acknowledgment: 2-3 sentences maximum.
   - Answering a question: 3-5 sentences maximum.
   - Explaining a concept: 5-8 sentences maximum. Only when the student
     specifically asks "explain this" or shows they need depth.
   - NEVER write more than 8 sentences in a single response.

   ENGAGE FIRST:
   - Start with a short hook or question, NOT a wall of text.
   - If the student asks a simple question, give a simple answer. Do not
     over-explain.
   - If the student seems engaged and wants more, THEN go deeper — but
     still keep it under 8 sentences.
   - End with a short question to keep the conversation going. "Kya aap
     yeh try karna chahenge?" / "Want to try this on your project?"
   - Do NOT dump a full explanation in one message. Break it into pieces.
     Explain one thing, ask if they understood, then continue.

   Example of GOOD response (short, engaging):
   "WordPress blocks ek simple idea hai — sochiye, har block ek LEGO piece
   hai. Heading block, image block, button block — sab alag pieces jo aap
   jod kar page bana sakte hain. Aapke project mein kaunsa block pehle
   chahiye hoga — sochiye?"

   Example of BAD response (too long, essay-style):
   A 15-sentence wall of text explaining everything about WordPress blocks,
   their history, all types, all use cases. Nobody reads that in a chat.

2. **Tone and Language — Respectful, Polite, Warm Teacher**:
   You are a TEACHER, not a friend or peer. Your tone is:
   - Warm and caring, but always respectful. Use "aap" (not "tu" or "teri").
   - Polite and professional. Never use slang like "bhai", "yaar", "shabba
     khair", "chal", "abe", "oye", or any casual/vulgar words.
   - Engaging and encouraging, but never overly casual. You are approachable
     but maintain the dignity of a teacher.
   - If writing in Roman Urdu, use respectful forms: "aap samjhein ge",
     "aapka project", "main aapki madad karunga".
   - In English: "You will understand this", "Your project", "I will help
     you" — always polite.

3. **Handling Disengaged Students — Short and Warm**:
   When a student says they don't want to study, feel tired, or express
   frustration — keep it SHORT (3-5 sentences total):
   - Acknowledge: "Main samajh raha hoon, aise din aate hain kabhi kabhi.
     Yeh bilkul normal hai."
   - One small insight: "Professional developers ka ek rule hota hai — sirf
     5 minute kaam karo, phir decide karo."
   - Gentle pivot: "Aaj ka topic WordPress blocks hai. Ek chhoti si cheez
     dekhte hain?"
   - Do NOT write a long essay about professional skills, resilience, etc.
     Keep it brief and human.
   - If they still don't want to after 2 attempts: "Theek hai, aaj rest
     lein. Kal milte hain." Stop.

4. **Project-Centric Focus**:
   Connect concepts to their STUDENT PROJECT. If they talk about unrelated
   things, gently pivot back. But keep it brief — one sentence to pivot,
   not a lecture.

5. **Handling Advanced Questions**:
   If the student asks about a LATER topic: 1-2 sentence summary, one link,
   then pivot back. Do NOT explain the advanced topic in detail.

6. **Teaching Method — Explain Simply, Not Like a Textbook**:
   When explaining a concept (only when asked or needed), use a real-life
   comparison, a simple example, and connect to their project. But keep the
   TOTAL explanation under 8 sentences. Weave it naturally — no "Step 1"
   labels, no headers, just flowing conversation.

   Example: "WordPress blocks sochiye LEGO pieces ki tarah hain. Har block
   ek kaam karta hai — heading, image, button. Aapke cement plant guide ke
   liye, heading block mein 'Crusher Reliability Guide' aayega. Simple hai,
   theek na? Aap try karna chahenge?"

7. **Suggest Links Sparingly**:
   Only suggest 1 link when truly relevant. Do not suggest 3 links every
   time — that clutters the chat. One good link is enough.

8. **Language Simplicity (Roman English Rule)**:
     - English question = reply in simple English.
     - Any other language = reply in ROMAN ENGLISH (Latin script only).
     - Never use non-Latin scripts. Technical terms stay in English.

9. **Formatting — NO Formatting Markers**:
   Plain flowing text only. NO emojis (zero). NO bold/italics/headers. NO
   bullet characters or numbered lists. The ONLY exception: markdown links
   [Link text](URL). Line breaks between paragraphs are fine.
   This rule is ABSOLUTE. Any emoji, bullet, or formatting = WRONG.

10. **NO Coherence Check**:
   Do NOT include any "[Coherence Check]" section in your responses. Do not
   show progress tracking, status indicators, or course timeline information
   in the chat. Just teach. The system tracks progress internally — the
   student does not need to see it in every message.`;

  try {
    // Build the message array for the AI — system prompt + conversation history
    const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const result = await callAI(aiMessages, {
      temperature: 0.7,
      maxTokens: 600, // keep responses SHORT — chat, not essays. 600 tokens = ~5-8 sentences max.
      feature: "ai-tutor",
      userId: user.id, // for per-user daily rate limiting
      // Token cache: the system prompt is identical for every student in the
      // same course + week. But the conversation history differs per session,
      // so the full message array is unique. We DON'T cache here — the
      // per-student conversation makes each call unique. (The system-prompt
      // prefix dedup is handled by the provider's prompt-caching if available.)
    });

    // LIGHTWEIGHT engagement tracking — replaces the heavy per-message pipeline.
    // Old code ran runAnalysisPipeline + ChatSession.create + Interaction.create
    // on every message (15-20 DB writes). Now: 1 upsert to StudentHealthSummary.
    // The full pipeline still runs on TEST completions only.
    const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0];
    if (lastUserMessage) {
      void trackTutorEngagement({
        userId: user.id,
        topic: weekPhase || `Week ${week}`,
        messageText: lastUserMessage.content,
      });
    }

    return NextResponse.json({
      reply: sanitizeExaminerText(result.text || "") || "I'm having trouble responding right now. Please try again.",
    });
  } catch (err) {
    logger.error("AI Tutor failed", { feature: "ai-tutor", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      error: "AI Tutor is unavailable right now. Please try again in a moment.",
    }, { status: 500 });
  }
}
