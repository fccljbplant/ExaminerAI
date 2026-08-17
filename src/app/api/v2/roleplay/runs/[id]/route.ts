/**
 * GET/POST /api/v2/roleplay/runs/[id] — a single roleplay run.
 *
 * GET: own run only (IDOR-guarded). Returns the run, the scenario, and
 *      the parsed turns.
 *
 * POST: { message } — advance the conversation by one student turn
 *      (own run, status in_progress, turn count < scenario.turnBudget):
 *       1. append the student turn,
 *       2. generate the persona reply (callAI, in-character),
 *       3. grade the student's message (callAIJson { score, feedback }),
 *       4. append the persona turn { role, content, score, feedback },
 *       5. on the final turn: status "completed", score = rounded
 *          average of the student-turn scores, completedAt = now.
 *
 * On AI failure the student turn is still persisted (persona turn gets
 * the "(AI unavailable — try again)" placeholder with score null) and
 * the route returns 503 so the client can retry without losing input.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiError, apiForbidden, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { callAI, type AIMessage } from "@/modules/assessment/lib/ai-provider";
import { callAIJson } from "@/modules/assessment/lib/ai-json";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 2000;

const GradeSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
});

interface RoleplayTurn {
  role: "student" | "persona";
  content: string;
  score?: number | null;
  feedback?: string | null;
}

function parseTurns(turnsJson: string): RoleplayTurn[] {
  try {
    const parsed: unknown = JSON.parse(turnsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => ({
        role: (t.role === "student" || t.role === "persona" ? t.role : "persona") as RoleplayTurn["role"],
        content: typeof t.content === "string" ? t.content : "",
        score: typeof t.score === "number" ? t.score : null,
        feedback: typeof t.feedback === "string" ? t.feedback : null,
      }));
  } catch {
    return [];
  }
}

function serializeRun(run: {
  id: string;
  scenarioId: string;
  status: string;
  turnsJson: string;
  score: number | null;
  completedAt: Date | null;
}) {
  return {
    id: run.id,
    scenarioId: run.scenarioId,
    status: run.status,
    turns: parseTurns(run.turnsJson),
    score: run.score,
    completedAt: run.completedAt,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const { id } = await ctx.params;
  const run = await db.roleplayRun.findUnique({
    where: { id },
    include: { scenario: true },
  });
  if (!run) return apiNotFound("Roleplay run not found");
  if (run.userId !== user.sub) return apiForbidden("This run belongs to another user");

  return apiSuccess({
    run: serializeRun(run),
    scenario: {
      id: run.scenario.id,
      title: run.scenario.title,
      personaName: run.scenario.personaName,
      goal: run.scenario.goal,
      turnBudget: run.scenario.turnBudget,
      difficulty: run.scenario.difficulty,
    },
    turns: parseTurns(run.turnsJson),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();

  const { id } = await ctx.params;
  const run = await db.roleplayRun.findUnique({
    where: { id },
    include: { scenario: true },
  });
  if (!run) return apiNotFound("Roleplay run not found");
  if (run.userId !== user.sub) return apiForbidden("This run belongs to another user");
  if (run.status !== "in_progress") return apiError("This run is already finished", "CONFLICT", 409);

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = (body.message ?? "").trim();
  if (!message) return apiValidationError({ message: "message is required" });
  if (message.length > MAX_MESSAGE_CHARS) {
    return apiValidationError({ message: `message too long (${MAX_MESSAGE_CHARS} chars max)` });
  }

  const turns = parseTurns(run.turnsJson);
  const studentTurns = turns.filter((t) => t.role === "student");
  if (studentTurns.length >= run.scenario.turnBudget) {
    return apiError("Turn budget reached for this scenario", "CONFLICT", 409);
  }

  // 1. Append the student turn (persisted even when the AI fails).
  turns.push({ role: "student", content: message });

  // 2. Persona reply via callAI (system = personaPrompt + brevity rule).
  const history: AIMessage[] = turns
    .filter((t) => t.content.trim().length > 0)
    .map((t) => ({
      role: t.role === "student" ? "user" : "assistant",
      content: t.content,
    }));

  const replyResult = await callAI(
    [
      { role: "system", content: `${run.scenario.personaPrompt}\n\nStay in character. One or two sentences.` },
      ...history,
    ],
    {
      temperature: 0.8,
      maxTokens: 200,
      feature: "roleplay-reply",
      userId: user.sub,
    },
  );

  const aiUnavailable = replyResult.fallback || !replyResult.text.trim();
  let personaContent = replyResult.text.trim();
  let score: number | null = null;
  let feedback: string | null = null;

  if (!aiUnavailable) {
    // 3. Grade the student's message.
    const grade = await callAIJson<z.infer<typeof GradeSchema>>(
      [
        {
          role: "system",
          content: `Grade this response for a roleplay scenario. Goal: ${run.scenario.goal} Score 0-100. Be concrete.`,
        },
        { role: "user", content: `Scenario: ${run.scenario.title}. The student said: "${message}"` },
      ],
      {
        schema: GradeSchema,
        feature: "roleplay-grade",
        userId: user.sub,
        temperature: 0.3,
        maxTokens: 200,
      },
    );
    if (grade.ok) {
      score = grade.data.score;
      feedback = grade.data.feedback;
    }
  } else {
    personaContent = "(AI unavailable — try again)";
    logger.warn("roleplay AI unavailable — persisting placeholder turn", {
      runId: run.id,
      scenarioId: run.scenarioId,
    });
  }

  // 4. Append the persona turn (content + per-turn grade).
  turns.push({ role: "persona", content: personaContent, score, feedback });

  // 5. Completion: final student turn -> aggregate score.
  const completed = studentTurns.length + 1 >= run.scenario.turnBudget;
  const studentScores = turns
    .filter((t) => t.role === "persona" && typeof t.score === "number" && t.score !== null)
    .map((t) => t.score as number);
  const average = studentScores.length
    ? Math.round(studentScores.reduce((sum, s) => sum + s, 0) / studentScores.length)
    : null;

  const updated = await db.roleplayRun.update({
    where: { id: run.id },
    data: {
      turnsJson: JSON.stringify(turns),
      ...(completed
        ? { status: "completed", score: average, completedAt: new Date() }
        : {}),
    },
  });

  const personaTurn = turns[turns.length - 1];

  if (aiUnavailable) {
    return apiError("AI unavailable", "AI_ERROR", 503, { run: serializeRun(updated) });
  }

  return apiSuccess({ run: serializeRun(updated), personaTurn });
}
