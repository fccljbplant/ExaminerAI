/**
 * POST /api/v2/uploads — W4 text-extraction endpoint (REDESIGN-P4 §6)
 *
 * Accepts a document as base64 JSON ({ fileName, mimeType, dataBase64 }),
 * runs the in-house extraction pipeline (mammoth for docx, pdfjs for pdf,
 * TextDecoder for text/*) and returns the extracted text + status. Never
 * throws for parser failures — degradation is reported so the client can
 * continue with human-only review (P2 §3.4).
 *
 * Photos/videos do not use this endpoint; they are stored inline in the
 * part payload and are never AI-processed.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api-response";
import { demoWriteBlock } from "@/lib/demo-guard";
import { extractText } from "@/modules/submission/lib/text-extract";

export const runtime = "nodejs";

const LEARNER_ROLES = new Set(["learner", "student"]);

const UploadBody = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  /** Raw bytes as base64 (data URL prefix tolerated). */
  dataBase64: z.string().max(15_000_000),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!LEARNER_ROLES.has(user.role)) {
    return apiError("Learner access only", "FORBIDDEN", 403);
  }

  const demoBlock = await demoWriteBlock("uploading a file");
  if (demoBlock) return demoBlock;

  const body = await req.json().catch(() => null);
  if (!body) return apiError("Invalid JSON body", "VALIDATION_ERROR", 400);

  const parsed = UploadBody.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid upload body", "VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const { fileName, mimeType, dataBase64 } = parsed.data;

  // Strip an optional "data:<mime>;base64," prefix from the client.
  const raw = dataBase64.includes(",") ? dataBase64.slice(dataBase64.indexOf(",") + 1) : dataBase64;
  const bytes = new Uint8Array(Buffer.from(raw, "base64"));

  const result = await extractText(bytes, mimeType);

  return apiSuccess({
    fileName,
    mimeType,
    sizeBytes: bytes.byteLength,
    extractionStatus: result.status,
    extractedText: result.text,
    truncated: result.truncated,
    ...(result.reason ? { reason: result.reason } : {}),
  });
}
