/**
 * modules/submission/lib/ai-draft.ts — I4 AI draft for aiAssist criteria
 * (REDESIGN-P4 §5, P2 §3.4 text-only law)
 *
 * Drafts scores + notes for rubric criteria marked aiAssist=true, from
 * the text-only AiContextPacket (extractedText + learnerSummary + link/
 * checklist metadata — never binaries). Output is labeled machine-
 * generated; a human entry always wins over it (rubric engine).
 *
 * Pure prompt assembly is exported for tests; the AI call itself is a
 * thin wrapper that degrades to "no draft" on any failure (the review
 * proceeds human-only — P2 §3.4 degradation).
 */

import { z } from "zod";
import { logger } from "@/lib/logger";
import { callAIJson } from "@/modules/assessment/lib/ai-json";
import { checkUserAILimit } from "@/modules/assessment/lib/ai-rate-limits";
import type { CriterionEntry, PartView } from "../contracts";
import { buildSubmissionPacket } from "./ai-packet";
import type { RubricCriterionDef } from "./rubric-engine";

// ── Pure helpers (unit-tested) ──────────────────────────────────────────

/** Only aiAssist criteria are eligible for AI drafting (P2 §3.4). */
export function aiDraftCriteria(
  criteria: RubricCriterionDef[],
): RubricCriterionDef[] {
  return criteria.filter((c) => c.aiAssist && c.levels.length > 0);
}

/** Build the AI request prompt from the text-only packet. */
export function buildAiDraftPrompt(
  packetText: string,
  criteria: RubricCriterionDef[],
  assignmentTitle: string,
): string {
  const criteriaLines = criteria
    .map((c) => {
      const levels = c.levels
        .map((l) => `    - ${l.score} pts: ${l.label}`)
        .join("\n");
      return `- "${c.label}" (weight ${c.weight}):\n${levels}`;
    })
    .join("\n");

  return [
    `You are a grading assistant on the TraineesAI platform. Draft scores for the AI-eligible criteria of this submission to "${assignmentTitle}".`,
    "The reviewer will verify every draft — be conservative and cite what you actually read.",
    "",
    "SUBMISSION TEXT (the only evidence you may use):",
    "---",
    packetText || "(no readable text — leave every criterion without a score)",
    "---",
    "",
    "CRITERIA TO DRAFT:",
    criteriaLines,
    "",
    'Respond with ONLY a JSON array. Each item: { criterionKey: string, score: number, note: string }.',
    "Rules:",
    " - Only include criteria you can ground in the submission text.",
    " - score must match one of the listed level scores exactly.",
    " - note: 1-2 sentences of evidence-based feedback, plain language.",
    " - If the text is empty or irrelevant, return [].",
  ].join("\n");
}

const DRAFT_SCHEMA = z
  .array(
    z.object({
      criterionKey: z.string().min(1),
      score: z.number().min(0),
      note: z.string().max(2_000),
    }),
  )
  .max(10);

export interface AiDraftResult {
  /** Draft entries, all labeled aiDraft: true — human wins upstream. */
  entries: CriterionEntry[];
  /** True when the AI produced drafts (vs. degraded to empty). */
  generated: boolean;
}

// ── Core ────────────────────────────────────────────────────────────────

/**
 * Draft grades for aiAssist criteria. Never throws: any failure returns
 * { entries: [], generated: false } so the review stays human-only.
 */
export async function draftAiGrades(args: {
  userId: string;
  assignmentTitle: string;
  learnerSummary: string;
  parts: PartView[];
  criteria: RubricCriterionDef[];
}): Promise<AiDraftResult> {
  const eligible = aiDraftCriteria(args.criteria);
  if (eligible.length === 0) return { entries: [], generated: false };

  const limit = await checkUserAILimit(args.userId, "test");
  if (!limit.allowed) {
    logger.warn("ai-draft skipped: rate limit reached", { used: limit.used, limit: limit.limit });
    return { entries: [], generated: false };
  }

  const packet = buildSubmissionPacket(args.parts, args.learnerSummary);
  const prompt = buildAiDraftPrompt(
    packet.asPromptText,
    eligible,
    args.assignmentTitle,
  );

  try {
    const result = await callAIJson<z.infer<typeof DRAFT_SCHEMA>>(
      [{ role: "user", content: prompt }],
      {
        schema: DRAFT_SCHEMA,
        feature: "submission-ai-draft",
        userId: args.userId,
        temperature: 0.2,
        maxTokens: 800,
      },
    );

    if (!result.ok) {
      logger.warn("ai-draft failed, degrading to human-only review", {
        error: result.error,
      });
      return { entries: [], generated: false };
    }

    const allowedKeys = new Set(eligible.map((c) => c.key));
    const maxByKey = new Map(eligible.map((c) => [c.key, Math.max(...c.levels.map((l) => l.score))]));

    const entries: CriterionEntry[] = result.data
      .filter((d) => allowedKeys.has(d.criterionKey))
      .map((d) => ({
        criterionKey: d.criterionKey,
        // Clamp to the criterion's highest level (same rule as the engine).
        score: Math.min(d.score, maxByKey.get(d.criterionKey) ?? d.score),
        note: d.note,
        aiDraft: true,
      }));

    return { entries, generated: entries.length > 0 };
  } catch (err) {
    logger.warn("ai-draft crashed, degrading to human-only review", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { entries: [], generated: false };
  }
}
