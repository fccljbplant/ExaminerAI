import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";

/** POST /api/students/[id]/draft-checkin — AI drafts a check-in message
 *  in the teacher's own voice, referencing the specific concern.
 *
 *  Uses the configured AI model (callAI).
 *
 *  NEVER auto-sends. Returns text into the existing message-compose flow,
 *  teacher edits and hits send themselves.
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }

  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role === "student") {
    return NextResponse.json({ error: "Only staff can draft check-ins" }, { status: 403 });
  }

  const { id } = await params;

  // IDOR protection
  try {
    await assertCanAccessStudent(payload, id);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { reason } = body as { reason?: string };

  // Pull teacher's last 5-10 messages to ANY student (style reference)
  const teacherMessages = await db.message.findMany({
    where: { fromId: payload.sub },
    orderBy: { sentAt: "desc" },
    take: 10,
    select: { body: true, subject: true, sentAt: true },
  });

  // Pull the student's current concern context
  const [student, wellbeing, openFlags, latestTouchpoint] = await Promise.all([
    db.user.findUnique({
      where: { id },
      select: { name: true, currentWeek: true },
    }),
    db.wellbeingState.findUnique({
      where: { userId: id },
      select: { tier: true, reasonsJson: true },
    }),
    db.crisisFlag.findFirst({
      where: { userId: id, status: "open" },
      select: { category: true, severity: true },
    }),
    db.mentorshipTouchpoint.findFirst({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: { note: true, createdAt: true, type: true },
    }),
  ]);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Build concern context
  let wellbeingReasons: string[] = [];
  try { wellbeingReasons = JSON.parse(wellbeing?.reasonsJson || "[]"); } catch { wellbeingReasons = []; }

  const concernContext = {
    studentName: student.name,
    currentWeek: student.currentWeek,
    wellbeingTier: wellbeing?.tier || "green",
    wellbeingReasons,
    openCrisisFlag: openFlags ? { category: openFlags.category, severity: openFlags.severity } : null,
    lastTouchpoint: latestTouchpoint ? {
      type: latestTouchpoint.type,
      note: latestTouchpoint.note,
      daysAgo: Math.floor((Date.now() - new Date(latestTouchpoint.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    } : null,
    teacherReason: reason || null,
  };

  const systemPrompt = `Draft a short, warm check-in message from this teacher to this student. Match the teacher's own tone from the example messages given. Reference the specific concern factually, without diagnosing or over-stating. This is a draft — the teacher will edit before sending.

Rules:
1. Keep it 2-4 sentences — short enough to feel like a real message, not an email.
2. Reference the concern factually (e.g. "I noticed you haven't logged in for a few days" not "I'm worried about your mental health").
3. End with a specific, low-pressure question or offer (not "let me know if you need anything" — too vague).
4. Write in Roman (Latin) script. If the student's answers were in another language, write in that language in Roman script.
5. Never state a clinical or psychological diagnosis.
6. Match the teacher's communication style from the examples — if they use first names and exclamation marks, do that. If they're formal, be formal.`;

  const userPrompt = `Teacher's past messages (style reference):
${teacherMessages.length > 0 ? teacherMessages.map(m => `- ${m.body}`).join("\n") : "(no past messages — use a warm, professional default tone)"}

Student: ${student.name} (Week ${student.currentWeek})

Concern context:
${JSON.stringify(concernContext, null, 2)}

Draft the check-in message:`;

  try {
    const result = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      feature: "draft-checkin",
      temperature: 0.5, // slightly higher — we want it to sound natural
      maxTokens: 200,
    });

    const draft = result.text?.trim() || "Hi {studentName}, I wanted to check in and see how things are going. Let me know if you'd like to talk.";

    return NextResponse.json({
      draft,
      studentName: student.name,
      concernContext,
      note: "This is a draft — edit before sending. AI-drafted, not AI-sent.",
    });
  } catch (err) {
    logger.error("Draft check-in AI call failed", { teacherId: payload.sub, studentId: id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      draft: `Hi ${student.name}, I wanted to check in and see how things are going. Let me know if you'd like to talk.`,
      note: "AI draft unavailable — using template. Edit before sending.",
    });
  }
}
