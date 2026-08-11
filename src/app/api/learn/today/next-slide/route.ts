/**
 * POST /api/learn/today/next-slide?courseId=...
 *
 * Generates the next slide for the current topic via callAI. If all 4
 * slides for the topic have been generated, returns { topicComplete: true,
 * resources: [...] } so the UI can show the topic-complete CTA.
 *
 * Slide generation:
 *  - System prompt sets the teaching-level directive + JSON output schema.
 *  - User prompt passes the topic context, the slide number (1-4),
 *    and an angle hint so each slide in the topic covers something
 *    different (intro / deep-dive / analogy / check-question).
 *  - We persist the slide as LearnSlide + 4 LearnNarration rows
 *    (one per teaching level) — though we only generate narration text
 *    for the user's current level (the others are placeholders to satisfy
 *    the @@unique constraint).
 *
 * Awards 5 XP (slide_taught) per new slide.
 *
 * Returns:
 *   {
 *     slide: SlideData,
 *     message: string,           // a short tutor-style caption
 *     slideNumber: number,       // 1..4
 *     totalSlides: number,       // always 4
 *     isLastSlide: boolean
 *   }
 *  OR { topicComplete: true, resources: [...] }
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { callAI } from "@/modules/assessment/lib/ai-provider";
import { callAIJson } from "@/modules/assessment/lib/ai-json";
import {
  getTodayTopic,
  incrementSlideViewed,
  buildTopicContextForAI,
  SLIDES_PER_TOPIC,
} from "@/modules/learn/lib/today-topic";
import { getOrCreateProfile } from "@/modules/learn/lib/learner-profile";
import { awardTypedXP } from "@/modules/learn/lib/xp-ledger";
import { LEVEL_DIRECTIVES, type SlideData, type TeachingLevel } from "@/modules/learn/types";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60; // AI calls can take 10-30s

const SLIDE_SCHEMA = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(2).max(6),
  visualSpec: z.string().optional(),
  keyTerms: z.array(z.string()).default([]),
  checkQuestion: z.string().optional(),
  realWorldExample: z.string().optional(),
  analogy: z.string().optional(),
  narration: z.string().min(1),
});

const SLIDE_ANGLES = [
  "Slide 1 — the introduction. Hook the learner, define the core concept, and explain WHY it matters in plain language.",
  "Slide 2 — the deep dive. Break down the concept into 3-5 concrete sub-ideas or steps. Be specific and technical enough for the chosen level.",
  "Slide 3 — analogy + real-world example. Use a vivid, surprising analogy to make the concept stick, then show how it works in a real-world project.",
  "Slide 4 — the check question. Pose a single sharp question that tests whether the learner understood the slide-2 deep dive. The question must be answerable in one sentence.",
];

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return apiError("courseId is required", "MISSING_FIELD", 400);

  await getOrCreateProfile(user.sub, courseId);
  const today = await getTodayTopic(user.sub, courseId);
  if (!today) return apiError("Course is complete", "NOT_FOUND", 404);

  // Determine slide number for this topic.
  const topicKey = `${today.topic.week}-${today.topic.day}`;
  const existingSlides = await db.learnSlide.findMany({
    where: { courseId, moduleId: topicKey },
    orderBy: { slideOrder: "asc" },
  });

  // If all 4 slides exist, the topic is complete — return resources.
  if (existingSlides.length >= SLIDES_PER_TOPIC) {
    return apiSuccess({
      topicComplete: true,
      resources: today.topic.resources,
      message: "You've completed all 4 slides for this topic. Review the resources, then complete the topic to advance.",
    });
  }

  const slideNumber = existingSlides.length + 1; // 1..4
  const profile = await db.learnProfile.findUnique({
    where: { userId_courseId: { userId: user.sub, courseId } },
  });
  const level = (profile?.teachingLevel ?? 4) as TeachingLevel;
  const language = profile?.preferredLanguage ?? "en";

  // Build AI prompt.
  const topicContext = buildTopicContextForAI(user.sub, courseId, today.topic);
  const systemPrompt = [
    "You are an AI tutor on the TraineesAI Learn platform. Your job is to teach a single daily topic across 4 slides — one slide per call.",
    `Teaching level: ${LEVEL_DIRECTIVES[level]}`,
    `Language: ${language}.`,
    "Respond with ONLY a JSON object matching the schema. No prose, no markdown fences.",
    "Schema: { title: string, bullets: string[2..6], visualSpec?: string, keyTerms: string[], checkQuestion?: string, realWorldExample?: string, analogy?: string, narration: string }",
    "The `narration` field is what the avatar will SAY out loud — make it 2-4 sentences, conversational, no markdown, no URLs, no code blocks. It should expand on the bullets naturally.",
  ].join("\n");

  const userPrompt = [
    topicContext,
    "",
    SLIDE_ANGLES[slideNumber - 1] ?? SLIDE_ANGLES[0],
    "",
    `This is slide ${slideNumber} of ${SLIDES_PER_TOPIC} for this topic. Generate only this slide.`,
  ].join("\n");

  // Call AI (with one JSON-repair retry built into callAIJson).
  const result = await callAIJson<z.infer<typeof SLIDE_SCHEMA>>(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      schema: SLIDE_SCHEMA,
      feature: "learn-slide-gen",
      userId: user.sub,
      temperature: 0.6,
      maxTokens: 800,
    },
  );

  let slide: SlideData;
  let narration: string;
  if (result.ok) {
    const d = result.data;
    slide = {
      title: d.title,
      bullets: d.bullets,
      visualSpec: d.visualSpec,
      keyTerms: d.keyTerms,
      checkQuestion: d.checkQuestion,
      realWorldExample: d.realWorldExample,
      analogy: d.analogy,
    };
    narration = d.narration;
  } else {
    // Fallback — generate a minimal slide so the user is never stuck.
    logger.warn("learn slide-gen AI failed, using fallback", { error: result.error });
    const topic = today.topic;
    slide = {
      title: `${topic.title} — Slide ${slideNumber}`,
      bullets: [
        `Objective: ${topic.objective}`,
        `This is slide ${slideNumber} of ${SLIDES_PER_TOPIC} for the topic "${topic.title}".`,
        "The AI slide generator is temporarily unavailable — this is a minimal fallback slide so you can keep your streak.",
        "Try again in a moment to get the full AI-generated content.",
      ],
      keyTerms: [],
      checkQuestion: slideNumber === 4 ? `In one sentence: what is ${topic.title}?` : undefined,
      realWorldExample: undefined,
      analogy: undefined,
    };
    narration = `Let's look at slide ${slideNumber} of ${SLIDES_PER_TOPIC} for ${topic.title}. ${topic.objective} The AI tutor is briefly offline — please bear with me.`;

    // Try a non-JSON callAI as a last-ditch recovery.
    try {
      const fallback = await callAI(
        [
          { role: "system", content: `You are a tutor. ${LEVEL_DIRECTIVES[level]}` },
          { role: "user", content: `In 2-3 conversational sentences, introduce slide ${slideNumber} of ${SLIDES_PER_TOPIC} on: ${topic.title}. Objective: ${topic.objective}. No markdown, no code.` },
        ],
        { feature: "learn-slide-fallback", userId: user.sub, maxTokens: 200, temperature: 0.7 },
      );
      if (fallback.text) narration = fallback.text;
    } catch { /* keep default */ }
  }

  // Persist slide + narration.
  const slideRow = await db.learnSlide.create({
    data: {
      courseId,
      moduleId: topicKey,
      lessonId: null,
      slideOrder: slideNumber,
      title: slide.title,
      bullets: slide.bullets as any,
      visualSpec: slide.visualSpec ?? null,
      keyTerms: slide.keyTerms as any,
      checkQuestion: slide.checkQuestion ?? null,
      realWorldExample: slide.realWorldExample ?? null,
      analogy: slide.analogy ?? null,
    },
  });
  await db.learnNarration.create({
    data: { slideId: slideRow.id, level, language, text: narration },
  });

  // Bump slidesViewed counter on masteryMap.
  const newSlidesViewed = await incrementSlideViewed(user.sub, courseId);

  // Award slide_taught XP (5).
  await awardTypedXP(user.sub, "slide_taught", courseId, `slide:${slideRow.id}`);

  // Update journey step status if this is slide 1 (mark the topic step as active).
  if (slideNumber === 1) {
    await db.journeyStep.updateMany({
      where: {
        journey: { userId: user.sub, courseId },
        metadata: { equals: { week: today.topic.week, day: today.topic.day } as any },
      },
      data: { status: "active" },
    }).catch(() => { /* metadata JSON filter may not work on SQLite — best-effort */ });
  }

  const message =
    slideNumber === 1
      ? `Welcome to ${today.topic.title}. Let's start with the basics.`
      : slideNumber === SLIDES_PER_TOPIC
        ? "Final slide — let's check your understanding."
        : "Here's the next idea.";

  return apiSuccess({
    slide,
    narration,
    message,
    slideNumber,
    totalSlides: SLIDES_PER_TOPIC,
    isLastSlide: slideNumber >= SLIDES_PER_TOPIC,
    slidesViewed: newSlidesViewed,
  });
}
