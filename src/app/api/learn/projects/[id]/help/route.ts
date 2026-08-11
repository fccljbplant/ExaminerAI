/**
 * POST /api/learn/projects/[id]/help
 *
 * Body: { blocker }
 *
 * Generates the next hint in a hint ladder (nudge → clue → scaffold →
 * pseudo-code) for a project blocker. Each call advances the hint level
 * by 1, capped at 3. Hints are persisted in a ProjectHelpSession row.
 *
 * Returns: { hint, hintLevel, resolved }
 *
 * The frontend should let the learner mark the blocker resolved at any
 * point — that's a separate PATCH (not implemented here; the learner
 * just asks a new question or moves on).
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { apiError, apiForbidden, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { callAI } from "@/modules/assessment/lib/ai-provider";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const HINT_LEVELS = [
  {
    name: "nudge",
    instruction:
      "Give a small NUDGE — point the learner in the right direction without revealing the solution. 1-2 sentences. No code. No direct answer.",
  },
  {
    name: "clue",
    instruction:
      "Give a CLUE — name the specific concept, tool, or function they should look at. Still no code. 2-3 sentences.",
  },
  {
    name: "scaffold",
    instruction:
      "SCAFFOLD the solution — give them a small code skeleton or step-by-step outline with blanks to fill in. Use a fenced code block for the skeleton only.",
  },
];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  const { id: projectId } = await ctx.params;

  let body: { blocker?: string } = {};
  try { body = await req.json(); } catch (err) { logger.warn("body parse failed", { err }); }
  const blocker = (body.blocker ?? "").trim();
  if (!blocker) return apiValidationError({ blocker: "blocker is required" });
  if (blocker.length > 4000) return apiValidationError({ blocker: "blocker too long (4000 char max)" });

  const project = await db.learnProject.findUnique({
    where: { id: projectId },
    include: {
      milestones: { orderBy: { order: "asc" } },
      helpSessions: { where: { resolved: false }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!project) return apiNotFound("Project not found");
  if (project.userId !== user.sub) return apiForbidden("This project belongs to another user");

  // Reuse the most recent unresolved help session, or create a new one.
  let helpSession = project.helpSessions[0] ?? null;
  if (!helpSession) {
    helpSession = await db.projectHelpSession.create({
      data: { projectId, blocker, hintLevel: 0 },
    });
  }

  const nextLevel = Math.min(HINT_LEVELS.length - 1, helpSession.hintLevel + 0); // current
  // Advance the level for THIS call (so first call = nudge, second = clue, third = scaffold).
  const callLevel = Math.min(HINT_LEVELS.length - 1, helpSession.hintLevel);
  const hintInstruction = HINT_LEVELS[callLevel];

  const milestoneContext = project.milestones
    .filter((m) => m.status !== "completed")
    .slice(0, 1)
    .map((m) => `Current milestone: ${m.title} — ${m.description ?? ""}`)
    .join("\n");

  const systemPrompt = [
    "You are an AI mentor on the TraineesAI Learn platform. Your job is to help a learner unblock themselves on their project — WITHOUT doing the work for them.",
    `Hint level: ${hintInstruction.name.toUpperCase()}.`,
    hintInstruction.instruction,
    "Be warm, specific, and concise. 1-3 short paragraphs max.",
  ].join("\n");

  const userPrompt = [
    `Project: ${project.title}`,
    project.goal ? `Goal: ${project.goal}` : "",
    project.stack ? `Stack: ${project.stack}` : "",
    project.currentState ? `Current state: ${project.currentState}` : "",
    milestoneContext,
    ``,
    `Blocker: ${blocker}`,
    ``,
    `Give me a ${hintInstruction.name} hint.`,
  ].filter(Boolean).join("\n");

  const result = await callAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      feature: "learn-project-help",
      userId: user.sub,
      temperature: 0.5,
      maxTokens: 400,
    },
  );

  const hint = result.text || "I'm briefly offline — try again in a moment for a hint.";
  const newHintLevel = Math.min(HINT_LEVELS.length - 1, callLevel + 1);

  const prevConversation = Array.isArray(helpSession.conversation)
    ? (helpSession.conversation as unknown[])
    : [];
  const nextConversation = [
    ...prevConversation,
    { level: callLevel, hint, blocker, at: new Date().toISOString() },
  ];

  await db.projectHelpSession.update({
    where: { id: helpSession.id },
    data: {
      hint,
      hintLevel: newHintLevel,
      conversation: nextConversation as unknown as Prisma.InputJsonValue,
    },
  });

  if (!result.text) {
    logger.warn("learn project help AI failed, fallback", { projectId });
  }

  return apiSuccess({
    hint,
    hintLevel: callLevel,
    hintLevelName: hintInstruction.name,
    nextHintAvailable: callLevel < HINT_LEVELS.length - 1,
    resolved: false,
  });
  void nextLevel;
}
