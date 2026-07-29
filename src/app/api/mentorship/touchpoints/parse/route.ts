import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/mentorship/touchpoints/parse — parse free text or voice
 *  transcript into structured MentorshipTouchpoint fields.
 *
 *  Always returns the parsed result for confirmation — never writes
 *  silently. Teacher reviews and confirms before it saves.
 */

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("parsing touchpoints"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role === "student") return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { transcript } = body as { transcript?: string };
  if (!transcript?.trim()) return NextResponse.json({ error: "transcript required" }, { status: 400 });
  if (transcript.length > 2000) return NextResponse.json({ error: "Transcript too long (max 2000 chars)" }, { status: 400 });

  // Get teacher's students for name resolution
  const instructorCourses = await db.courseEnrollment.findMany({
    where: { userId: payload.sub, role: "instructor" },
    select: { courseId: true },
  });
  const courseIds = instructorCourses.map(c => c.courseId);
  let studentFilter: Record<string, unknown> = {};
  if (courseIds.length > 0) {
    const enrollments = await db.courseEnrollment.findMany({
      where: { courseId: { in: courseIds }, role: "student" },
      select: { userId: true },
    });
    const studentIds = enrollments.map(e => e.userId);
    if (studentIds.length > 0) {
      studentFilter = { id: { in: studentIds } };
    } else {
      studentFilter = { id: "none" };
    }
  } else {
    studentFilter = { id: "none" };
  }
  const students = await db.user.findMany({
    where: { role: "student", blocked: false, ...studentFilter },
    select: { id: true, name: true },
  });

  const prompt = `Parse this touchpoint log into structured fields. The teacher said:
"${transcript}"

Students in the batch: ${students.map(s => s.name).join(", ")}

Return ONLY this JSON:
{
  "studentName": "<matched student name from the list, or null if not found>",
  "type": "<checkin | alert_response | escalation | praise_note | scheduled_followup>",
  "note": "<2-3 sentence summary of what happened>",
  "outcome": "<resolved | ongoing | escalated | null>",
  "followUpDate": "<ISO date string or null>"
}`;

  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = payload.email.includes("@demo.ai") || payload.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(payload.sub, "touchpoint-parse", isDemo);
    if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

    const result = await callAI([{ role: "user", content: prompt }], {
      feature: "touchpoint-parse", temperature: 0.2, maxTokens: 300,
      userId: payload.sub, // H12 fix: attribute to the teacher who spoke the touchpoint
    });
    const match = result.text?.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      // Resolve studentName → userId (fuzzy match)
      const matched = parsed.studentName
        ? students.find(s => s.name.toLowerCase().includes(parsed.studentName.toLowerCase()) || parsed.studentName.toLowerCase().includes(s.name.toLowerCase()))
        : null;
      return NextResponse.json({
        parsed: { ...parsed, studentId: matched?.id || null, studentName: matched?.name || parsed.studentName },
        requiresConfirmation: true,
      });
    }
  } catch { /* fall through */ }
  return NextResponse.json({ parsed: null, error: "Could not parse transcript" });
}
