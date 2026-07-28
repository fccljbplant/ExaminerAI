import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { resolveAssistantScope } from "@/lib/ai-assistant/scope";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/**
 * POST /api/assistant/action-dialog
 *
 * Generates Action Dialog content for a specific flag.
 * Returns: headline, why, suggestedAction, notePresets, guidance
 *
 * AI DRAFTS, HUMANS DECIDE — this endpoint generates content only.
 * It does NOT send messages, flag people, or execute any action.
 */

interface RequestBody {
  flagId?: string;
  flagType: string;       // "psychological" | "educational" | "mentorship" | "safeguarding" | "teacher_load"
  studentId?: string;
  instructorId?: string;
  trigger: string;        // The specific trigger data (e.g. "mood score 25/100")
  context?: string;       // Additional context from the caller
}

export async function POST(req: NextRequest) {
  const block = await demoWriteBlock("generating action dialog content");
  if (block) return block;

  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }

  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as RequestBody;
  const { flagType, studentId, instructorId, trigger, context } = body;

  if (!flagType || !trigger) {
    return NextResponse.json({ error: "flagType and trigger required" }, { status: 400 });
  }

  // Resolve scope — enforce data-layer scoping (Section 0.4)
  const scope = await resolveAssistantScope(payload.sub, payload.role);

  // If studentId provided, verify it's in scope
  if (studentId && !scope.studentIds.includes(studentId) && !scope.isInstitutionWide) {
    return NextResponse.json({ error: "Student not in scope" }, { status: 403 });
  }

  // Build context for the AI
  let entityName = "a student";
  let entityContext = "";

  if (studentId) {
    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { name: true, currentWeek: true },
    });
    entityName = student?.name || "a student";
    entityContext = `Student: ${entityName}, Week ${student?.currentWeek || "?"}. `;
  } else if (instructorId) {
    const instructor = await db.user.findUnique({
      where: { id: instructorId },
      select: { name: true },
    });
    entityName = instructor?.name || "an instructor";
    entityContext = `Teacher: ${entityName}. `;
  }

  const systemPrompt = `You are an AI Assistant helping a ${payload.role} respond to a flag about ${entityName}.
Generate content for an Action Dialog with this structure:
1. headline: plain-language label (10-15 words, specific to the flag — NOT generic)
2. why: 1-2 sentences explaining the specific data/threshold that triggered this
3. suggestedAction: a drafted message or action the human can edit (2-3 sentences)
4. notePresets: 3 short (5-10 word) one-tap note options, contextual to THIS specific flag
5. guidance.whatItMeans: 1-2 sentences explaining what this situation likely means
6. guidance.principles: 1-2 grounded principles for approaching it (ask-don't-tell, validate-before-solving, GROW-stage framing where relevant)

Rules:
- Words first, color second — the headline must state what's needed in plain language
- AI drafts, humans decide — the suggestedAction is a DRAFT, not an order
- Be specific to the flag type — a confidence drop reads differently from disengagement
- Keep it concise — this is for a busy person scanning a dialog
- Respond in JSON format: {"headline":"","why":"","suggestedAction":"","notePresets":[],"guidance":{"whatItMeans":"","principles":[]}}`;

  const userPrompt = `Flag type: ${flagType}
Trigger: ${trigger}
${entityContext}${context ? `Additional context: ${context}` : ""}

Generate the Action Dialog content as JSON.`;

  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = payload.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(payload.sub, "action_dialog", isDemo);
    if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

    const result = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      feature: "action_dialog",
      temperature: 0.4,
      maxTokens: 600,
      userId: payload.sub, // H12 fix: attribute to the staff member using the action dialog
    });

    const text = result.text?.trim() || "{}";

    // Parse the JSON response
    let parsed;
    try {
      // Remove markdown code fences if present
      const clean = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(clean);
    } catch {
      // Fallback if AI doesn't return valid JSON
      parsed = {
        headline: `${flagType} flag — needs attention`,
        why: trigger,
        suggestedAction: `Review the ${flagType} flag and consider reaching out to ${entityName}.`,
        notePresets: ["Reviewed and monitoring", "Will follow up this week", "Need more information"],
        guidance: {
          whatItMeans: `This ${flagType} flag indicates a pattern that may need intervention.`,
          principles: ["Ask don't tell — approach with curiosity, not assumptions"],
        },
      };
    }

    // Determine tier from flag type + trigger
    const tier: "green" | "warning" | "red" = flagType === "safeguarding" || trigger.toLowerCase().includes("crisis")
      ? "red"
      : flagType === "psychological" || trigger.toLowerCase().includes("urgent")
      ? "warning"
      : "warning";

    return NextResponse.json({
      headline: parsed.headline || `${flagType} flag`,
      tier,
      why: parsed.why || trigger,
      suggestedAction: parsed.suggestedAction || `Review the ${flagType} flag.`,
      notePresets: Array.isArray(parsed.notePresets) ? parsed.notePresets.slice(0, 3) : [],
      guidance: parsed.guidance || {
        whatItMeans: `This ${flagType} flag indicates a pattern that may need intervention.`,
        principles: ["Ask don't tell — approach with curiosity, not assumptions"],
      },
    });
  } catch (err) {
    logger.error("Action dialog generation failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      headline: `${flagType} flag — needs attention`,
      tier: "warning" as const,
      why: trigger,
      suggestedAction: `Review the ${flagType} flag and consider reaching out to ${entityName}.`,
      notePresets: ["Reviewed and monitoring", "Will follow up this week", "Need more information"],
      guidance: {
        whatItMeans: `This ${flagType} flag indicates a pattern that may need intervention.`,
        principles: ["Ask don't tell — approach with curiosity, not assumptions"],
      },
    });
  }
}
