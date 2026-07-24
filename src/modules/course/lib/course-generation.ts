/**
 * Course Generation — AI-powered course outline generation.
 *
 * Extracted from src/app/api/courses/generate/route.ts so the
 * generation logic is reusable and testable independent of the
 * HTTP route.
 *
 * The route handler (src/app/api/courses/generate/route.ts) is now
 * a thin HTTP wrapper that calls these functions.
 */

import { createHash } from "crypto";
import { callAI, TOKEN_BUDGET } from "@/lib/ai-provider";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { CourseWeek, CourseDay } from "../types";

/** Compute a stable hash of the form parameters for cache lookup. */
export function computeFormHash(params: {
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

/** Cache window: 30 days. */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Check if a cached generation exists and is still fresh. */
export async function getCachedGeneration(cacheKey: string): Promise<{ course: unknown; cachedAt: string } | null> {
  const cached = await db.aICache.findUnique({ where: { cacheKey } });
  if (!cached) return null;
  const age = Date.now() - new Date(cached.createdAt).getTime();
  if (age > CACHE_TTL_MS) return null;
  try {
    const parsed = JSON.parse(cached.response);
    return { course: parsed, cachedAt: cached.createdAt.toISOString() };
  } catch {
    return null;
  }
}

/** Save a generation to the cache. */
export async function saveCachedGeneration(cacheKey: string, course: unknown, promptTokens: number, completionTokens: number): Promise<void> {
  await db.aICache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      response: JSON.stringify(course),
      provider: "zai",
      promptTokens,
      completionTokens,
    },
    update: {
      response: JSON.stringify(course),
      createdAt: new Date(),
    },
  }).catch(() => {});
}

/** Normalize AI-generated course data into the expected shape.
 *  Strips invalid fields, clamps values, fills defaults. */
export function normalizeAiCourseData(raw: any, weeks: number, days: number): {
  domain: string;
  level: string;
  toolsUsed: string[];
  deliverableTypes: string[];
  assessmentType: string;
  weeks: Array<{
    week: number;
    phase: string;
    days: Array<{
      day: number;
      title: string;
      objective: string;
      whyItMatters: string;
      topicsCovered: string[];
      activity: string;
      deliverable: string;
      resources: { label: string; url: string }[];
    }>;
  }>;
} {
  const domain = String(raw.domain || "technology").trim();
  const level = String(raw.level || "beginner").trim();
  const toolsUsed = Array.isArray(raw.toolsUsed) ? raw.toolsUsed.map((t: any) => String(t)).slice(0, 20) : [];
  const deliverableTypes = Array.isArray(raw.deliverableTypes) ? raw.deliverableTypes.map((t: any) => String(t)).slice(0, 20) : [];
  const assessmentType = String(raw.assessmentType || "socratic").trim();

  const normalizedWeeks = (Array.isArray(raw.weeks) ? raw.weeks : []).slice(0, weeks).map((w: any, wi: number) => ({
    week: Number(w.week) || wi + 1,
    phase: String(w.phase || `Week ${wi + 1}`).trim(),
    days: (Array.isArray(w.days) ? w.days : []).slice(0, days).map((d: any, di: number) => ({
      day: Number(d.day) || di + 1,
      title: String(d.title || `Day ${di + 1}`).trim(),
      objective: String(d.objective || "").trim(),
      whyItMatters: String(d.whyItMatters || "").trim(),
      topicsCovered: Array.isArray(d.topicsCovered) ? d.topicsCovered.map((t: any) => String(t)) : [],
      activity: String(d.activity || "").trim(),
      deliverable: String(d.deliverable || "").trim(),
      resources: Array.isArray(d.resources) ? d.resources.filter((r: any) => r && r.label && r.url).slice(0, 10) : [],
    })),
  }));

  return { domain, level, toolsUsed, deliverableTypes, assessmentType, weeks: normalizedWeeks };
}

/** Build the AI prompt for course generation. */
export function buildCourseGenPrompt(params: {
  courseName: string;
  description: string;
  domain: string;
  level: string;
  weeks: number;
  days: number;
  audience: string;
  tools: string;
  deliverables: string;
  assessment: string;
}): string {
  return `Generate a complete course outline as JSON. Course: "${params.courseName}"
Domain: ${params.domain}
Level: ${params.level}
Duration: ${params.weeks} weeks × ${params.days} days per week
Target audience: ${params.audience}
Tools: ${params.tools}
Deliverable types: ${params.deliverables}
Assessment style: ${params.assessment}
Description: ${params.description}

Return ONLY a JSON object with this shape:
{
  "domain": "string",
  "level": "string",
  "toolsUsed": ["string"],
  "deliverableTypes": ["string"],
  "assessmentType": "string",
  "weeks": [
    {
      "week": number,
      "phase": "string",
      "days": [
        {
          "day": number,
          "title": "string",
          "objective": "string",
          "whyItMatters": "string",
          "topicsCovered": ["string"],
          "activity": "string",
          "deliverable": "string",
          "resources": [{"label": "string", "url": "string"}]
        }
      ]
    }
  ]
}`;
}

/** Generate a course outline using AI. Handles batching for long courses. */
export async function generateCourse(params: {
  courseName: string;
  description: string;
  domain: string;
  level: string;
  weeks: number;
  days: number;
  audience: string;
  tools: string;
  deliverables: string;
  assessment: string;
}): Promise<{ course: ReturnType<typeof normalizeAiCourseData>; promptTokens: number; completionTokens: number }> {
  const batchSize = 4; // generate 4 weeks at a time
  const allWeeks: any[] = [];
  let courseMeta: { domain: string; level: string; toolsUsed: string[]; deliverableTypes: string[]; assessmentType: string } = {
    domain: params.domain, level: params.level, toolsUsed: [], deliverableTypes: [], assessmentType: params.assessment,
  };
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (let batchStart = 0; batchStart < params.weeks; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, params.weeks);
    const prompt = buildCourseGenPrompt(params) + `\n\nGenerate weeks ${batchStart + 1} through ${batchEnd} only.`;

    const result = await callAI([
      { role: "system", content: "You are an expert curriculum designer. Generate detailed, practical course outlines as JSON only." },
      { role: "user", content: prompt },
    ], { feature: "course-gen", temperature: 0.4, maxTokens: TOKEN_BUDGET.FINAL_ANALYSIS });

    totalPromptTokens += result.promptTokens;
    totalCompletionTokens += result.completionTokens;

    const match = result.text?.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.weeks && Array.isArray(parsed.weeks)) {
          allWeeks.push(...parsed.weeks);
        }
        if (batchStart === 0) {
          courseMeta = {
            domain: String(parsed.domain || params.domain),
            level: String(parsed.level || params.level),
            toolsUsed: Array.isArray(parsed.toolsUsed) ? parsed.toolsUsed : [],
            deliverableTypes: Array.isArray(parsed.deliverableTypes) ? parsed.deliverableTypes : [],
            assessmentType: String(parsed.assessmentType || params.assessment),
          };
        }
      } catch (e) {
        logger.error("Course generation batch: JSON parse failed", { batch: batchStart, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const course = normalizeAiCourseData({ ...courseMeta, weeks: allWeeks }, params.weeks, params.days);
  return { course, promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens };
}
