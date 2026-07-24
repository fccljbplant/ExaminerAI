import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBatchFilter, getTeacherBatchIds, canAccessBatch } from "@/lib/batch-teachers";
import { getAuthUser } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { isFeatureEnabled } from "@/lib/feature-flags";

/** POST /api/mentorship/touchpoints/parse — parse free text or voice
 *  transcript into structured MentorshipTouchpoint fields.
 *
 *  Always returns the parsed result for confirmation — never writes
 *  silently. Teacher reviews and confirms before it saves.
 */

export async function POST(req: NextRequest) {
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
  const teacher = await db.user.findUnique({ where: { id: payload.sub }, select: { batchId: true } });
  const students = await db.user.findMany({
    where: { role: "student", blocked: false, ...(await getBatchFilter(payload.sub, payload.role)) },
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
    const result = await callAI([{ role: "user", content: prompt }], {
      feature: "touchpoint-parse", temperature: 0.2, maxTokens: 300,
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
