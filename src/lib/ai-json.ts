// FILE: src/lib/ai-json.ts
// JSON-mode AI call helper with zod schema validation + one repair retry.
// Replaces the brittle "[-]" marker + anti-narration wall parsing pattern.
//
// Usage:
//   import { z } from "zod";
//   import { callAIJson } from "@/lib/ai-json";
//
//   const Schema = z.object({ text: z.string(), kind: z.enum(["probe","next"]) });
//   const result = await callAIJson(
//     [{ role: "system", content: "..." }, { role: "user", content: "..." }],
//     { schema: Schema, feature: "daily-test-reply", userId: user.id }
//   );
//   if (!result.ok) { /* show degraded mode */ }
//   else { result.data.text; result.data.kind; }

import { z } from "zod";
import { callAI, type AIMessage } from "@/modules/assessment/lib/ai-provider";

export interface CallAIJsonOptions {
  schema: z.ZodType<any, any>;
  feature?: string;
  userId?: string;
  temperature?: number;
  maxTokens?: number;
  /** Extra instruction appended to the system prompt to force JSON output. */
  jsonInstruction?: string;
}

export type AIJsonResult<T> =
  | { ok: true; data: T; raw: string }
  | { ok: false; error: string; raw: string };

/** Call the AI with JSON-mode instructions, validate with zod, retry once on parse failure.
 *  - Appends a "respond ONLY with JSON" instruction to the system prompt
 *  - Calls callAI (DeepSeek primary, Z.ai fallback)
 *  - Extracts the JSON object from the response (handles markdown fences)
 *  - Validates against the zod schema
 *  - On failure, retries ONCE with an explicit "your previous response was not valid JSON" message
 *  - Returns { ok: false } if both attempts fail — caller shows visible degraded mode */
export async function callAIJson<T>(
  messages: AIMessage[],
  options: CallAIJsonOptions
): Promise<AIJsonResult<T>> {
  const jsonInstruction = options.jsonInstruction ??
    "Respond with ONLY a valid JSON object. No prose, no markdown fences, no commentary. " +
    "The JSON must conform to this schema: " + describeSchema(options.schema);

  const attempt = async (msgs: AIMessage[]): Promise<AIJsonResult<T>> => {
    const result = await callAI(msgs, {
      temperature: options.temperature ?? 0.5,
      maxTokens: options.maxTokens ?? 1000,
      feature: options.feature ?? "json-call",
      userId: options.userId,
    });

    const raw = result.text || "";
    const jsonStr = extractJson(raw);
    if (!jsonStr) {
      return { ok: false, error: "No JSON object found in response", raw };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return { ok: false, error: `JSON parse error: ${e instanceof Error ? e.message : "unknown"}`, raw };
    }

    const validation = options.schema.safeParse(parsed);
    if (!validation.success) {
      return {
        ok: false,
        error: `Schema validation failed: ${validation.error.issues[0]?.message ?? "unknown"}`,
        raw,
      };
    }

    return { ok: true, data: validation.data as T, raw };
  };

  // First attempt
  const firstMessages: AIMessage[] = [
    ...messages,
    { role: "system", content: jsonInstruction },
  ];
  const first = await attempt(firstMessages);
  if (first.ok) return first;

  // Retry once with a repair instruction
  const retryMessages: AIMessage[] = [
    ...firstMessages,
    { role: "assistant", content: first.raw },
    { role: "user", content: `Your previous response was not valid JSON or did not match the schema. Error: ${first.error}. Please respond again with ONLY a valid JSON object matching the schema.` },
  ];
  const second = await attempt(retryMessages);
  if (second.ok) return second;

  // Both failed — return the last error
  return second;
}

/** Extract the first JSON object from a text string.
 *  Handles: raw JSON, markdown fences ```json ... ```, leading/trailing prose. */
function extractJson(text: string): string | null {
  const trimmed = text.trim();

  // Try direct parse first (fast path)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch { /* fall through */ }
  }

  // Try markdown fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    const content = fenceMatch[1].trim();
    try {
      JSON.parse(content);
      return content;
    } catch { /* fall through */ }
  }

  // Try extracting the first {...} or [...] block
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      JSON.parse(objectMatch[0]);
      return objectMatch[0];
    } catch { /* fall through */ }
  }
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      JSON.parse(arrayMatch[0]);
      return arrayMatch[0];
    } catch { /* fall through */ }
  }

  return null;
}

/** Best-effort human-readable description of a zod schema for the JSON instruction. */
function describeSchema(schema: z.ZodType<any, any>): string {
  try {
    // zod v4: use _zod.def; v3: use _def
    const def = (schema as any)._zod?.def ?? (schema as any)._def;
    if (!def) return "(see schema)";

    if (def.type === "object") {
      const shape = def.shape ?? def.entries;
      if (!shape) return "(object)";
      const entries = Object.entries(shape).map(([key, val]: [string, any]) => {
        const valDef = val?._zod?.def ?? val?._def;
        const valType = valDef?.type ?? "unknown";
        const isOptional = valDef?.type === "optional";
        return `  "${key}": ${valType}${isOptional ? " (optional)" : ""}`;
      });
      return `{\n${entries.join(",\n")}\n}`;
    }
    return def.type ?? "(unknown schema)";
  } catch {
    return "(see schema)";
  }
}
