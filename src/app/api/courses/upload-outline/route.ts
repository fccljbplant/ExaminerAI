import { hasRole, ADMIN_ROLES } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { logger } from "@/lib/logger";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * POST /api/courses/upload-outline — upload a course outline (text/PDF-extracted)
 * and have the AI generate a professional weekly/daily structure from it.
 *
 * The uploaded outline can be:
 *   - Raw text pasted by the user
 *   - Extracted from a PDF (extraction happens client-side or via a separate
 *     PDF-parse step before this endpoint is called)
 *   - A syllabus from another institution
 *   - A list of topics the teacher wants covered
 *
 * The AI reads the outline and generates:
 *   - Week titles + phases
 *   - Daily topics for each week (days 1-5)
 *   - Learning objectives per week
 *   - Suggested deliverables/assessments per week
 *
 * Body: {
 *   outlineText: string,         // the raw outline text
 *   courseName: string,          // course name
 *   durationWeeks?: number,      // default 6
 *   daysPerWeek?: number,        // default 5
 *   domain?: string,             // technology | business | science | etc.
 *   level?: string,              // beginner | intermediate | advanced
 * }
 *
 * Returns: {
 *   weeks: Array<{ week: number, phase: string, title: string, summary: string,
 *     topics: Array<{ day: number, title: string, objective: string }>,
 *     objectives: string[], deliverables: string[] }>
 * }
 */

interface GeneratedWeek {
  week: number;
  phase: string;
  title: string;
  summary: string;
  topics: Array<{ day: number; title: string; objective: string }>;
  objectives: string[];
  deliverables: string[];
}

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("generating course outline"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(payload.role, ADMIN_ROLES)) {
    return NextResponse.json({ error: "Only admins can generate course outlines" }, { status: 403 });
  }

  // Demo AI check
  const isDemoUser = payload.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled." }, { status: 403 });
  }

  // Rate limit check (test category — course generation)
  const category = categoryForFeature("course-gen");
  const limit = await checkUserAILimit(payload.sub, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
    }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    outlineText, courseName,
    durationWeeks = 6, daysPerWeek = 5,
    domain = "technology", level = "beginner",
  } = body as {
    outlineText?: string;
    courseName?: string;
    durationWeeks?: number;
    daysPerWeek?: number;
    domain?: string;
    level?: string;
  };

  if (!outlineText?.trim()) {
    return NextResponse.json({ error: "outlineText is required" }, { status: 400 });
  }
  if (!courseName?.trim()) {
    return NextResponse.json({ error: "courseName is required" }, { status: 400 });
  }
  if (outlineText.length > 50000) {
    return NextResponse.json({ error: "Outline text too long (max 50,000 characters)" }, { status: 400 });
  }

  const weeks = Math.min(52, Math.max(1, Number(durationWeeks) || 6));
  const days = Math.min(7, Math.max(1, Number(daysPerWeek) || 5));

  // Build the AI prompt — ask for a professional weekly/daily structure
  const systemPrompt = `You are a senior curriculum designer at a vocational training institute. You receive a raw course outline (which may be a syllabus, a list of topics, or notes) and transform it into a professional weekly/daily course structure.

Output JSON ONLY — no markdown, no explanations, no code fences. The JSON must match this exact shape:
{
  "weeks": [
    {
      "week": 1,
      "phase": "Foundation",
      "title": "Week 1: Introduction to ...",
      "summary": "One paragraph summary of what this week covers and why.",
      "topics": [
        { "day": 1, "title": "Topic title", "objective": "What the student will learn" },
        { "day": 2, "title": "Topic title", "objective": "What the student will learn" }
      ],
      "objectives": ["Learning objective 1", "Learning objective 2"],
      "deliverables": ["Deliverable 1", "Deliverable 2"]
    }
  ]
}

Rules:
1. Generate exactly ${weeks} weeks, each with exactly ${days} daily topics.
2. Phase names should reflect the learning journey (e.g., Foundation → Building → Integration → Capstone).
3. Daily topics should be specific and actionable (not generic like "Introduction").
4. Each topic's objective should be one sentence starting with a verb.
5. Distribute the uploaded outline's content across the weeks logically.
6. If the outline is sparse, expand it professionally. If it's dense, condense it.
7. Week titles should include the week number + a descriptive title.
8. Deliverables should be practical (e.g., "Build a REST API", "Write a 2-page analysis").
9. Match the domain (${domain}) and level (${level}) appropriately.
10. Output in Roman (Latin) script only.`;

  const userPrompt = `Course name: ${courseName}
Domain: ${domain}
Level: ${level}
Duration: ${weeks} weeks × ${days} days/week

UPLOADED COURSE OUTLINE:
---
${outlineText}
---

Transform this into a professional ${weeks}-week course structure with ${days} daily topics per week. Output JSON only.`;

  try {
    const result = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      feature: "course-gen",
      temperature: 0.4,
      maxTokens: Math.min(8000, weeks * 800), // scale with course length
      userId: payload.sub,
    });

    const raw = result.text?.trim() || "{}";

    // Parse the JSON (handle markdown code fences if the AI added them)
    let parsed: { weeks: GeneratedWeek[] };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      logger.error("Course outline generation: failed to parse AI JSON", { courseName, rawLength: raw.length });
      return NextResponse.json({
        error: "AI returned invalid JSON. Please try again or simplify the outline.",
      }, { status: 502 });
    }

    if (!parsed.weeks || !Array.isArray(parsed.weeks) || parsed.weeks.length === 0) {
      return NextResponse.json({
        error: "AI did not generate any weeks. Please try again.",
      }, { status: 502 });
    }

    // Validate + normalize each week
    const validatedWeeks: GeneratedWeek[] = parsed.weeks.slice(0, weeks).map((w, i) => ({
      week: i + 1,
      phase: w.phase || `Week ${i + 1}`,
      title: w.title || `Week ${i + 1}`,
      summary: w.summary || "",
      topics: (w.topics || []).slice(0, days).map((t, j) => ({
        day: j + 1,
        title: t.title || `Day ${j + 1}`,
        objective: t.objective || "",
      })),
      objectives: w.objectives || [],
      deliverables: w.deliverables || [],
    }));

    // Pad with empty topics if AI returned fewer days than requested
    for (const w of validatedWeeks) {
      while (w.topics.length < days) {
        w.topics.push({ day: w.topics.length + 1, title: `Day ${w.topics.length + 1}`, objective: "" });
      }
    }

    return NextResponse.json({
      weeks: validatedWeeks,
      courseName,
      durationWeeks: weeks,
      daysPerWeek: days,
      provider: result.provider,
    });
  } catch (err) {
    logger.error("Course outline generation failed", {
      courseName, error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({
      error: "Failed to generate course outline. Please try again.",
    }, { status: 500 });
  }
}
