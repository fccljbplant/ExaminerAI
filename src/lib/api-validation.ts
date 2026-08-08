/**
 * src/lib/api-validation.ts — Request validation helper using zod.
 *
 * Provides a simple helper to validate request bodies against a zod schema.
 * Returns either the validated data or throws a structured validation error.
 *
 * Usage in API routes:
 *   import { validateBody } from "@/lib/api-validation";
 *   import { z } from "zod";
 *
 *   const schema = z.object({
 *     name: z.string().min(2),
 *     email: z.string().email(),
 *   });
 *
 *   const [data, error] = await validateBody(req, schema);
 *   if (error) return error; // 400 validation error response
 *   // use data.name, data.email — fully typed
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiValidationError } from "./api-response";

/**
 * Validate a request body against a zod schema.
 *
 * @returns A tuple: [data, null] on success, or [null, errorResponse] on failure.
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>,
): Promise<[T, null] | [null, ReturnType<typeof apiValidationError>]> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return [null, apiValidationError({ _: "Invalid JSON body" }, "Invalid JSON")];
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    // Convert zod errors to a flat field→message map
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "_";
      fieldErrors[field] = issue.message;
    }
    return [null, apiValidationError(fieldErrors)];
  }

  return [result.data, null];
}

/**
 * Validate query parameters against a zod schema.
 *
 * @returns A tuple: [data, null] on success, or [null, errorResponse] on failure.
 */
export function validateQuery<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>,
): [T, null] | [null, ReturnType<typeof apiValidationError>] {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());

  const result = schema.safeParse(params);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "_";
      fieldErrors[field] = issue.message;
    }
    return [null, apiValidationError(fieldErrors)];
  }

  return [result.data, null];
}
