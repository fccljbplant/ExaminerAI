import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { isStaffRole, hasRole, ADMIN_ROLES, UserRole } from "@/lib/rbac";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { logger } from "@/lib/logger";
import { demoWriteBlock } from "@/lib/demo-guard";

/**
 * POST /api/courses/convert-outline — paste any raw course outline (from a
 * Word doc, a syllabus, a PDF someone copied, a textbook table of contents,
 * or just a flat list of topics) and the AI converts it into a structured,
 * TraineesAI-compatible course outline (weeks → days with objectives,
 * activities, deliverables, resources, etc.).
 *
 * Domain-agnostic — works for engineering, business, healthcare, finance,
 * HR, soft-skills, manufacturing, compliance, or any other professional
 * training domain. The `category` field tells the AI which vocabulary,
 * tools, and examples to use.
 *
 * Body: {
 *   outline: string,              // raw pasted text — any format
 *   courseName?: string,          // optional course name (defaults to "Untitled Course")
 *   category?: string,            // domain hint: technology | engineering | business | healthcare | etc.
 *   level?: string,               // beginner | intermediate | advanced
 *   durationWeeks?: number,       // target week count (default 6)
 *   daysPerWeek?: number,         // target days per week (default 5)
 * }
 *
 * Returns: { weeks: CourseWeek[] }  — same per-week/per-day shape as
 * /api/courses/generate so the wizard can swap between the two flows
 * without changing the preview UI.
 *
 * Auth: staff-only (instructor / org_admin / platform_admin / demo).
 * Learners and pending-status users get 403.
 */

const ALLOWED_ROLES = [
  UserRole.INSTRUCTOR,
  UserRole.ORG_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.DEMO,
] as const;

/** Staff who can convert outlines — instructors, org_admins, admins. */
function canConvertOutline(role: string): boolean {
  // Admins (org_admin / platform_admin) + demo always pass.
  if (hasRole(role, ADMIN_ROLES)) return true;
  // Instructors can also convert outlines.
  return hasRole(role, [UserRole.INSTRUCTOR]);
}

interface GeneratedDay {
  day: number;
  title: string;
  objective: string;
  whyItMatters: string;
  topicsCovered: string[];
  steps?: string[];
  activity: string;
  deliverable: string;
  githubCommit?: string;
  reflection?: string[];
  resources: { label: string; url: string }[];
}

interface GeneratedWeek {
  weekNumber: number;
  phase: string;
  milestone: string;
  goal?: string;
  outcomes?: string[];
  days: GeneratedDay[];
}

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("converting course outline");
  if (_demoBlock) return _demoBlock;

  const payload = await getAuthUser();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Staff-only — learners + pending-status users cannot convert outlines.
  if (!isStaffRole(payload.role) || !canConvertOutline(payload.role)) {
    return NextResponse.json(
      { error: "Forbidden — instructors and admins only." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const {
    outline,
    courseName,
    category,
    level,
    durationWeeks,
    daysPerWeek,
  } = body as {
    outline?: string;
    courseName?: string;
    category?: string;
    level?: string;
    durationWeeks?: number;
    daysPerWeek?: number;
  };

  // ---- Validate inputs -----------------------------------------------------
  if (!outline || typeof outline !== "string" || !outline.trim()) {
    return NextResponse.json(
      { error: "outline is required — paste your course outline text." },
      { status: 400 },
    );
  }
  if (outline.length > 100_000) {
    return NextResponse.json(
      { error: "Outline text is too long (max 100,000 characters). Please trim it and try again." },
      { status: 400 },
    );
  }

  const targetWeeks = Math.min(Math.max(Number(durationWeeks) || 6, 1), 20);
  const targetDays = Math.min(Math.max(Number(daysPerWeek) || 5, 1), 7);
  const courseLabel = courseName?.trim() || "Untitled Course";
  const courseCategory = category?.trim() || "technology";
  const courseLevel = level?.trim() || "beginner";

  // ---- Per-user daily AI rate limit + demo block ---------------------------
  const isDemo = payload.email.includes("@demo.ai") || payload.email === "demo@examiner.ai";
  const blocked = await enforceAIRateLimit(payload.sub, "course-gen", isDemo);
  if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

  // ---- Build the AI prompt -------------------------------------------------
  // Carefully constructed:
  //   1. Tell the AI it's a curriculum designer
  //   2. Show the course context (name, category, level, duration)
  //   3. Show the raw pasted outline (verbatim, between delimiters)
  //   4. Give explicit instructions for each week + day field
  //   5. Stress ENHANCEMENT (fill in missing details) and domain adaptation
  //   6. Pin down the JSON shape so we can parse it reliably
  const prompt = `You are a senior curriculum designer. The user has pasted a raw course outline below. Your job is to convert it into a structured, TraineesAI-compatible course outline.

COURSE: ${courseLabel}
CATEGORY: ${courseCategory}
LEVEL: ${courseLevel}
DURATION: ${targetWeeks} weeks, ${targetDays} days per week

RAW OUTLINE PASTED BY USER:
---
${outline.trim()}
---

YOUR TASK:
1. Read the raw outline carefully. Identify the structure — it might have weeks, modules, chapters, topics, sessions, or just a flat list of topics.
2. Organize the content into exactly ${targetWeeks} weeks with ${targetDays} days each.
3. If the raw outline has more weeks than requested, consolidate related topics. If fewer, expand by adding practice/review/project days.
4. For EACH week, provide: weekNumber, phase (short name), milestone, goal (paragraph), outcomes (array of 4-8 learning objectives).
5. For EACH day, provide: day, title, objective, whyItMatters (paragraph), topicsCovered (5-8 subtopics), steps (4-7 numbered actionable steps as strings), activity, deliverable, githubCommit (a short suggested commit-message-style slug like "feat: add thermodynamics solver"), reflection (3-5 reflection questions as an array of strings), resources (1-3 real URLs as objects with {label, url}).
6. ENHANCE the outline — if the pasted outline only has topic names, generate full objectives, activities, and reflections. The AI should ADD value, not just reformat.
7. Adapt to the domain — use appropriate terminology, tools, and examples for the category (engineering, business, healthcare, etc.).
8. Resources must be REAL URLs (official docs, well-known tutorials, professional organizations).

Return ONLY a JSON object matching this exact shape — no markdown, no explanation, no code fences:
{
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "...",
      "milestone": "...",
      "goal": "...",
      "outcomes": ["...", "..."],
      "days": [
        {
          "day": 1,
          "title": "...",
          "objective": "...",
          "whyItMatters": "...",
          "topicsCovered": ["...", "..."],
          "steps": ["...", "..."],
          "activity": "...",
          "deliverable": "...",
          "githubCommit": "...",
          "reflection": ["...", "..."],
          "resources": [{"label": "...", "url": "https://..."}]
        }
      ]
    }
  ]
}`;

  try {
    const result = await callAI(
      [
        { role: "user", content: prompt },
      ],
      {
        temperature: 0.6,
        maxTokens: 30_000, // outlines can be large — give the AI room to expand
        feature: "course-gen",
        userId: payload.sub,
      },
    );

    const raw = (result.text || "").trim();
    if (!raw) {
      logger.error("convert-outline: AI returned empty response", {
        userId: payload.sub,
        courseName: courseLabel,
      });
      return NextResponse.json(
        { error: "AI returned an empty response. Please try again or simplify the outline." },
        { status: 502 },
      );
    }

    // Pull the JSON object out of the response (the AI sometimes wraps it
    // in markdown code fences despite the instruction not to).
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      logger.error("convert-outline: AI did not return a JSON object", {
        userId: payload.sub,
        rawLength: raw.length,
        preview: raw.slice(0, 200),
      });
      return NextResponse.json(
        { error: "AI did not return a JSON object. Please try again." },
        { status: 502 },
      );
    }

    let parsed: { weeks?: unknown };
    try {
      parsed = JSON.parse(match[0]);
    } catch (parseErr) {
      logger.error("convert-outline: failed to parse AI JSON", {
        userId: payload.sub,
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        preview: raw.slice(0, 200),
      });
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again or simplify the outline." },
        { status: 502 },
      );
    }

    if (!parsed.weeks || !Array.isArray(parsed.weeks) || parsed.weeks.length === 0) {
      return NextResponse.json(
        { error: "AI response missing the `weeks` array. Please try again." },
        { status: 502 },
      );
    }

    // ---- Normalize + validate each week/day --------------------------------
    // The AI sometimes returns weekNumber/day as strings, omits fields, or
    // pads the days array inconsistently. Coerce types + pad to the target
    // shape so the downstream course-create flow can persist it without
    // further validation surprises.
    const validatedWeeks: GeneratedWeek[] = (parsed.weeks as unknown[])
      .slice(0, targetWeeks)
      .map((wRaw, weekIdx) => {
        const w = (wRaw && typeof wRaw === "object" ? wRaw : {}) as Record<string, unknown>;
        const weekNumber =
          Number.isInteger(Number(w.weekNumber)) && Number(w.weekNumber) > 0
            ? Number(w.weekNumber)
            : weekIdx + 1;
        const phase = typeof w.phase === "string" && w.phase.trim() ? w.phase.trim() : `Week ${weekNumber}`;
        const milestone = typeof w.milestone === "string" ? w.milestone.trim() : "";
        const goal = typeof w.goal === "string" ? w.goal.trim() : "";
        const outcomes = Array.isArray(w.outcomes)
          ? w.outcomes.filter((o): o is string => typeof o === "string").slice(0, 8)
          : [];
        const daysRaw = Array.isArray(w.days) ? w.days : [];

        const days: GeneratedDay[] = Array.from({ length: targetDays }, (_, dayIdx) => {
          const dRaw = daysRaw[dayIdx];
          const d = (dRaw && typeof dRaw === "object" ? dRaw : {}) as Record<string, unknown>;
          const day =
            Number.isInteger(Number(d.day)) && Number(d.day) > 0
              ? Number(d.day)
              : dayIdx + 1;
          const title = typeof d.title === "string" && d.title.trim() ? d.title.trim() : `Day ${day}`;
          const objective = typeof d.objective === "string" ? d.objective.trim() : "";
          const whyItMatters = typeof d.whyItMatters === "string" ? d.whyItMatters.trim() : "";
          const topicsCovered = Array.isArray(d.topicsCovered)
            ? d.topicsCovered
                .filter((t): t is string => typeof t === "string")
                .map((t) => t.trim())
                .filter(Boolean)
            : [];
          const steps = Array.isArray(d.steps)
            ? d.steps.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean)
            : [];
          const activity = typeof d.activity === "string" ? d.activity.trim() : "";
          const deliverable = typeof d.deliverable === "string" ? d.deliverable.trim() : "";
          const githubCommit = typeof d.githubCommit === "string" ? d.githubCommit.trim() : "";
          const reflection = Array.isArray(d.reflection)
            ? d.reflection.filter((r): r is string => typeof r === "string").map((r) => r.trim()).filter(Boolean)
            : [];
          const resources = Array.isArray(d.resources)
            ? d.resources
                .filter((r): r is Record<string, unknown> => r && typeof r === "object")
                .map((r) => ({
                  label: typeof r.label === "string" ? r.label.trim() : "",
                  url: typeof r.url === "string" ? r.url.trim() : "",
                }))
                .filter((r) => r.url)
            : [];

          return {
            day, title, objective, whyItMatters, topicsCovered,
            steps, activity, deliverable, githubCommit, reflection, resources,
          };
        });

        return { weekNumber, phase, milestone, goal, outcomes, days };
      });

    logger.info("convert-outline: success", {
      userId: payload.sub,
      courseName: courseLabel,
      weeks: validatedWeeks.length,
      provider: result.provider,
      durationMs: result.durationMs,
    });

    return NextResponse.json({
      weeks: validatedWeeks,
      provider: result.provider,
    });
  } catch (err) {
    logger.error("convert-outline: AI call failed", {
      userId: payload.sub,
      courseName: courseLabel,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: "Failed to convert outline. Please try again.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

// Export the allowed roles for any caller that wants to mirror the gate.
export { ALLOWED_ROLES };
