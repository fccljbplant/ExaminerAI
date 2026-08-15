import { hasRole, ADMIN_ROLES, isStaffRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/courses/generate — AI generates a full course outline for ANY subject.
 *
 *  Domain-agnostic: works for technology, engineering, business, humanities,
 *  science, arts, healthcare, law — anything.
 *
 *  Phase D.2: Caching. The same form submitted twice returns the cached
 *  generation instead of hitting the AI again. Cache key is a SHA256 of
 *  all form inputs. Cache is stored in the AICache table with a
 *  `course-gen:` prefix on the cacheKey.
 *
 *  Body: {
 *    courseName: string,           // e.g. "Mechanical Engineering Fundamentals"
 *    description?: string,
 *    domain?: string,              // technology | engineering | business | humanities | science | arts | healthcare | law | other
 *    level?: string,               // beginner | intermediate | advanced | mixed
 *    durationWeeks?: number,       // default 6
 *    daysPerWeek?: number,         // default 5
 *    targetAudience?: string,     // e.g. "first-year engineering students"
 *    tools?: string,               // e.g. "AutoCAD, MATLAB, 3D printer" or "Excel, PowerPoint, case studies"
 *    deliverableTypes?: string,    // e.g. "lab reports, CAD drawings, problem sets" or "presentations, essays, case studies"
 *    assessmentType?: string,      // socratic | quiz | case-study | practical | oral | written | portfolio | mixed
 *  }
 */

/** Compute a stable hash of the form parameters for cache lookup. */
function computeFormHash(params: {
  courseName: string;
  description: string;
  domain: string;
  level: string;
  weeks: number;
  days: number;
  audience: string;
  toolList: string;
  deliverables: string;
  assessment: string;
}): string {
  // Sort keys for stability, normalize whitespace, lowercase where appropriate.
  // The goal is: identical form inputs → identical hash → cache hit.
  const normalized = JSON.stringify({
    courseName: params.courseName.trim().toLowerCase(),
    description: params.description.trim().toLowerCase(),
    domain: params.domain.trim().toLowerCase(),
    level: params.level.trim().toLowerCase(),
    weeks: params.weeks,
    days: params.days,
    audience: params.audience.trim().toLowerCase(),
    toolList: params.toolList.trim().toLowerCase(),
    deliverables: params.deliverables.trim().toLowerCase(),
    assessment: params.assessment.trim().toLowerCase(),
  });
  return createHash("sha256").update(normalized).digest("hex");
}

/** Cache window: 30 days. After that we re-generate (model may have improved). */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("generating courses"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload || (!isStaffRole(payload.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    courseName, description, domain, level,
    durationWeeks, daysPerWeek, targetAudience,
    tools, deliverableTypes, assessmentType,
  } = body as {
    courseName?: string;
    description?: string;
    domain?: string;
    level?: string;
    durationWeeks?: number;
    daysPerWeek?: number;
    targetAudience?: string;
    tools?: string;
    deliverableTypes?: string;
    assessmentType?: string;
  };

  if (!courseName?.trim()) {
    return NextResponse.json({ error: "courseName is required" }, { status: 400 });
  }

  const weeks = Math.min(Math.max(durationWeeks || 6, 1), 20);
  const days = Math.min(Math.max(daysPerWeek || 5, 1), 7);
  const audience = targetAudience?.trim() || "beginners";
  const toolList = tools?.trim() || "appropriate tools for the subject";
  const deliverables = deliverableTypes?.trim() || "appropriate deliverables (reports, presentations, projects)";
  const courseDomain = domain?.trim() || "technology";
  const courseLevel = level?.trim() || "beginner";
  const assessment = assessmentType?.trim() || "socratic";

  // ============================================================
  // Phase D.2: Cache lookup — if the same form was submitted in
  // the last 30 days, return the cached generation. Saves ~8192
  // output tokens + ~1500 input tokens per hit.
  // ============================================================
  const formHash = computeFormHash({
    courseName, description: description || "", domain: courseDomain, level: courseLevel,
    weeks, days, audience, toolList, deliverables, assessment,
  });
  const cacheKey = `course-gen:${formHash}`;

  try {
    const cached = await db.aICache.findUnique({ where: { cacheKey } });
    if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
      // Bump hit count for observability
      await db.aICache.update({
        where: { id: cached.id },
        data: { hitCount: { increment: 1 } },
      }).catch((err) => { logger.warn("Operation failed", { err }); });
      logger.info("Course generation: cache hit", { cacheKey, hitCount: cached.hitCount + 1 });
      return NextResponse.json({
        course: JSON.parse(cached.response),
        cached: true,
        cachedAt: cached.createdAt.toISOString(),
      });
    }
  } catch (cacheLookupErr) {
    // Cache lookup failure should NOT block generation — log + continue.
    logger.warn("Course generation: cache lookup failed, generating fresh", {
      error: cacheLookupErr instanceof Error ? cacheLookupErr.message : String(cacheLookupErr),
    });
  }

  const prompt = `You are a senior curriculum designer creating a professional course outline. This course can be in ANY domain — technology, engineering, business, humanities, science, arts, healthcare, law, or anything else. Design it appropriately for the subject matter.

COURSE: ${courseName.trim()}
DESCRIPTION: ${description?.trim() || "A practical, applied course"}
DOMAIN: ${courseDomain}
LEVEL: ${courseLevel}
DURATION: ${weeks} weeks, ${days} days per week
TARGET AUDIENCE: ${audience}
TOOLS: ${toolList}
DELIVERABLES: ${deliverables}
ASSESSMENT STYLE: ${assessment}

For EACH week, provide:
- weekNumber: 1 to ${weeks}
- phase: a short name for the week's focus (domain-appropriate — e.g. "Thermodynamics Basics" for engineering, "Market Analysis" for business, "Renaissance Art" for arts)
- milestone: what the student should have accomplished by end of week

For EACH day in each week (${days} days), provide:
- day: 1 to ${days}
- title: the day's topic (specific to this subject)
- objective: one sentence — what the student will be able to DO after this day (use action verbs: analyze, design, build, write, calculate, demonstrate, evaluate)
- whyItMatters: one sentence — why this skill matters in real-world work for this domain
- topicsCovered: array of 3-5 subtopics covered (short phrases)
- activity: one sentence — what the student does today (hands-on: lab experiment, case study, build feature, write report, analyze data, role-play, design, etc.)
- deliverable: one sentence — what the student produces/submits (code commit, lab report, presentation, CAD drawing, financial model, essay, design file, etc.)
- resources: array of 1-2 objects with {label, url} — REAL documentation/tutorial links relevant to this domain

DESIGN PRINCIPLES:
- Progress from fundamentals to advanced — each week builds on the previous
- Include hands-on/applied work every day (not just theory)
- Week 1: foundations + setup. Last week: capstone/portfolio/presentation
- Use the tools listed: ${toolList}
- Deliverables should match: ${deliverables}
- Assessment style: ${assessment} — design daily activities that prepare students for this assessment type
- Make it practical and applied — students learn by DOING, not just reading
- Resources must be REAL URLs (official docs, textbook publishers, well-known tutorials, professional organizations)
- Adapt the tone and terminology to the domain — don't use software jargon for an HR course, don't use business jargon for an engineering course

Return ONLY a JSON object:
{
  "domain": "${courseDomain}",
  "level": "${courseLevel}",
  "toolsUsed": ["tool1", "tool2"],
  "deliverableTypes": ["type1", "type2"],
  "assessmentType": "${assessment}",
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "...",
      "milestone": "...",
      "days": [
        {
          "day": 1,
          "title": "...",
          "objective": "...",
          "whyItMatters": "...",
          "topicsCovered": ["...", "..."],
          "activity": "...",
          "deliverable": "...",
          "resources": [{"label": "...", "url": "https://..."}]
        }
      ]
    }
  ]
}

No markdown. No explanation. Just the JSON.`;

  try {
    // Phase fix: For courses > 8 weeks, generate in batches to avoid
    // token limits + timeout. DeepSeek max output is 8192 tokens — a
    // 6-week × 5-day course needs ~6000 tokens. Anything > 8 weeks
    // risks truncation. We batch: generate 6 weeks at a time, then
    // merge the results.
    const BATCH_SIZE = 8; // weeks per batch
    const needsBatching = weeks > BATCH_SIZE;

    // H1 fix: enforce per-user daily AI rate limit + demo block (course-gen is expensive)
    const isDemo = payload.email.includes("@demo.ai") || payload.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(payload.sub, "course-gen", isDemo);
    if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

    if (!needsBatching) {
      // Single-call generation (original path, works for ≤ 8 weeks)
      const result = await callAI([
        { role: "user", content: prompt },
      ], {
        temperature: 0.7,
        maxTokens: 8192, // DeepSeek max — was 8000, now full capacity
        feature: "course-gen",
        userId: payload.sub, // H12 fix: attribute to the staff member generating the course
      });

      const raw = result.text || "{}";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json({ error: "AI failed to generate valid JSON" }, { status: 500 });
      }

      const parsed = JSON.parse(match[0]);
      if (!parsed.weeks || !Array.isArray(parsed.weeks) || parsed.weeks.length === 0) {
        return NextResponse.json({ error: "AI response missing weeks array" }, { status: 500 });
      }

      // Phase D.2: persist to cache for future hits (fire-and-forget — don't block the response).
      db.aICache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          response: JSON.stringify(parsed),
          provider: result.provider || "deepseek",
          promptTokens: result.promptTokens || 0,
          completionTokens: result.completionTokens || 0,
        },
        update: {
          response: JSON.stringify(parsed),
          provider: result.provider || "deepseek",
          promptTokens: result.promptTokens || 0,
          completionTokens: result.completionTokens || 0,
          createdAt: new Date(), // refresh TTL
        },
      }).catch((err) => {
        logger.warn("Course generation: cache write failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return NextResponse.json({ course: parsed, cached: false });
    }

    // Batched generation for long courses (> 8 weeks)
    // Generate BATCH_SIZE weeks at a time, then merge
    logger.info("Course generation: batched mode", { totalWeeks: weeks, batchSize: BATCH_SIZE });
    let courseMeta: { domain?: string; level?: string; toolsUsed?: string[]; deliverableTypes?: string[]; assessmentType?: string } = {};

    // Batches are independent — generate them in PARALLEL (2026-08-15):
    // N serial AI round-trips collapse into one.
    const batchStarts: number[] = [];
    for (let batchStart = 0; batchStart < weeks; batchStart += BATCH_SIZE) batchStarts.push(batchStart);

    const batchResults = await Promise.all(
      batchStarts.map(async (batchStart) => {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, weeks);
      const batchWeeks = batchEnd - batchStart;

      const batchPrompt = `You are a senior curriculum designer creating a professional course outline. This is BATCH ${Math.floor(batchStart / BATCH_SIZE) + 1} of a ${Math.ceil(weeks / BATCH_SIZE)}-batch generation for a ${weeks}-week course.

COURSE: ${courseName.trim()}
DESCRIPTION: ${description?.trim() || "A practical, applied course"}
DOMAIN: ${courseDomain}
LEVEL: ${courseLevel}
THIS BATCH: Weeks ${batchStart + 1} to ${batchEnd} (out of ${weeks} total weeks)
DAYS PER WEEK: ${days}
TARGET AUDIENCE: ${audience}
TOOLS: ${toolList}
DELIVERABLES: ${deliverables}
ASSESSMENT STYLE: ${assessment}

${batchStart === 0 ? `For the FIRST batch, also include the course-level metadata (domain, level, toolsUsed, deliverableTypes, assessmentType).` : `This is a continuation — previous batches covered weeks 1-${batchStart}. Maintain consistency in tone, progression, and tool usage.`}

For EACH week in this batch (${batchWeeks} weeks, numbered ${batchStart + 1} to ${batchEnd}):
- weekNumber: ${batchStart + 1} to ${batchEnd}
- phase: a short name for the week's focus
- milestone: what the student should have accomplished by end of week
- days: ${days} days, each with: day (1-${days}), title, objective, whyItMatters, topicsCovered (3-5 subtopics), activity, deliverable, resources (1-2 links)

Return ONLY a JSON object:
{
  ${batchStart === 0 ? `"domain": "${courseDomain}", "level": "${courseLevel}", "toolsUsed": [...], "deliverableTypes": [...], "assessmentType": "${assessment}",` : ""}
  "weeks": [ { "weekNumber": ${batchStart + 1}, "phase": "...", "milestone": "...", "days": [...] } ]
}

No markdown. Just the JSON.`;

      const batchResult = await callAI([
        { role: "user", content: batchPrompt },
      ], {
        temperature: 0.7,
        maxTokens: 8192,
        feature: "course-gen-batch",
        userId: payload.sub, // H12 fix: attribute to the staff member generating the course
      });

      const batchRaw = batchResult.text || "{}";
      const batchMatch = batchRaw.match(/\{[\s\S]*\}/);
      if (!batchMatch) {
        logger.error("Course generation batch failed: no JSON", { batch: batchStart });
        return { batchStart, weeks: [] as unknown[], meta: null as { domain?: string; level?: string; toolsUsed?: string[]; deliverableTypes?: string[]; assessmentType?: string } | null };
      }

      try {
        const batchParsed = JSON.parse(batchMatch[0]);
        return {
          batchStart,
          weeks: (batchParsed.weeks && Array.isArray(batchParsed.weeks) ? batchParsed.weeks : []) as unknown[],
          meta: {
            domain: batchParsed.domain || courseDomain,
            level: batchParsed.level || courseLevel,
            toolsUsed: batchParsed.toolsUsed || [],
            deliverableTypes: batchParsed.deliverableTypes || [],
            assessmentType: batchParsed.assessmentType || assessment,
          } as { domain?: string; level?: string; toolsUsed?: string[]; deliverableTypes?: string[]; assessmentType?: string },
        };
      } catch {
        logger.error("Course generation batch: JSON parse failed", { batch: batchStart });
        return { batchStart, weeks: [] as unknown[], meta: null as { domain?: string; level?: string; toolsUsed?: string[]; deliverableTypes?: string[]; assessmentType?: string } | null };
      }
      }),
    );

    // Merge batches in order; metadata comes from the FIRST batch.
    const allWeeks: unknown[] = [];
    for (const r of batchResults.sort((a, b) => a.batchStart - b.batchStart)) {
      allWeeks.push(...r.weeks);
      if (r.batchStart === 0 && r.meta) courseMeta = r.meta;
    }

    if (allWeeks.length === 0) {
      return NextResponse.json({ error: "AI failed to generate any valid weeks. Please try again or create the course manually." }, { status: 500 });
    }

    logger.info("Course generation: batched complete", { totalWeeks: allWeeks.length });
    const batchedCourse = {
      ...courseMeta,
      weeks: allWeeks,
    };

    // Phase D.2: persist batched result to cache too (fire-and-forget).
    db.aICache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        response: JSON.stringify(batchedCourse),
        provider: "deepseek",
        promptTokens: 0,
        completionTokens: 0,
      },
      update: {
        response: JSON.stringify(batchedCourse),
        createdAt: new Date(),
      },
    }).catch((err) => {
      logger.warn("Course generation (batched): cache write failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return NextResponse.json({ course: batchedCourse, cached: false });
  } catch (err) {
    logger.error("Course generation AI failed", { feature: "course-gen", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      error: "AI generation failed. Please try again or create the course manually.",
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
