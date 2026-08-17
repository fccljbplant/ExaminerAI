/**
 * POST /api/v2/instructor/courses/[id]/material — course material upload
 *
 * Body: { title, kind: "text" | "pdf" | "docx", content?, dataUrl? }
 *   - kind "text":  `content` carries the raw text.
 *   - kind "pdf"/"docx": `dataUrl` carries a base64 data URL; the file
 *     is decoded and run through the shared text-extraction pipeline
 *     (pdfjs / mammoth).
 *
 * The extracted text is stored on a CourseMaterial row and the course's
 * RAG index (CourseEmbedding) is rebuilt so the AI tutor can cite the
 * material. Audited ("course_material_uploaded"). Instructor staff only.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { apiError, apiNotFound, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api-response";
import { isStaffRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit-log";
import { isPortalEnabled } from "@/lib/feature-flags";
import { extractText } from "@/modules/submission/lib/text-extract";
import { indexCourse } from "@/modules/ai/lib/rag-db";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_CONTENT_CHARS = 200_000;
const MAX_TITLE_CHARS = 200;

const BodySchema = z.object({
  title: z.string().min(1).max(MAX_TITLE_CHARS),
  kind: z.enum(["text", "pdf", "docx"]),
  content: z.string().optional(),
  dataUrl: z.string().optional(),
});

const MIME_BY_KIND: Record<"pdf" | "docx", string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Decode a `data:<mime>;base64,<payload>` URL into bytes + mime. */
function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match || match[2] !== ";base64") return null;
  const mime = (match[1] ?? "").split(";")[0];
  const payload = match[3].replace(/\s+/g, "");
  if (!mime || !payload) return null;
  try {
    const buffer = Buffer.from(payload, "base64");
    if (buffer.byteLength === 0) return null;
    return { bytes: new Uint8Array(buffer), mime };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiUnauthorized();
  if (!isStaffRole(user.role)) {
    return apiError("Instructor access only", "FORBIDDEN", 403);
  }
  if (!(await isPortalEnabled("instructor"))) {
    return apiError("Instructor portal is not enabled yet", "FORBIDDEN", 403);
  }

  const { id: courseId } = await ctx.params;
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, ownerUserId: true },
  });
  if (!course) return apiNotFound("Course not found");

  // Instructors must teach the course (or own it); org/platform admins
  // manage their whole catalog.
  if (user.role === "instructor") {
    const teaches = await db.courseEnrollment.findFirst({
      where: { userId: user.sub, role: "instructor", courseId },
      select: { id: true },
    });
    if (!teaches && course.ownerUserId !== user.sub) {
      return apiError("You do not teach this course", "FORBIDDEN", 403);
    }
  }

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiValidationError({ body: parsed.error.issues[0]?.message ?? "Invalid body" });
  }
  const { title, kind } = parsed.data;

  let content = "";
  if (kind === "text") {
    content = (parsed.data.content ?? "").trim();
    if (!content) return apiValidationError({ content: "content is required for text materials" });
  } else {
    const dataUrl = (parsed.data.dataUrl ?? "").trim();
    if (!dataUrl) return apiValidationError({ dataUrl: `dataUrl is required for ${kind} materials` });
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) return apiValidationError({ dataUrl: "dataUrl must be a valid base64 data URL" });
    const extracted = await extractText(decoded.bytes, MIME_BY_KIND[kind]);
    if (extracted.status !== "done" || !extracted.text.trim()) {
      logger.warn("material text extraction failed", {
        courseId, kind, reason: extracted.reason ?? "unknown",
      });
      return apiError(
        `Could not extract text from the uploaded ${kind.toUpperCase()} file.`,
        "VALIDATION_ERROR",
        400,
        { reason: extracted.reason ?? null },
      );
    }
    content = extracted.text.trim();
  }

  if (content.length > MAX_CONTENT_CHARS) {
    return apiValidationError({ content: `content too long (${MAX_CONTENT_CHARS} chars max)` });
  }

  const material = await db.courseMaterial.create({
    data: { courseId, title, kind, content, addedByUserId: user.sub },
  });

  await logAudit({
    actor: { id: user.sub, name: user.name, role: user.role },
    action: "course_material_uploaded",
    target: { type: "course", id: courseId },
    after: { materialId: material.id, title, kind, chars: content.length },
  });

  // Rebuild the course's RAG index so the tutor can cite this material.
  try {
    await indexCourse(courseId);
  } catch (err) {
    logger.error("reindex after material upload failed", {
      courseId,
      materialId: material.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return apiSuccess({
    material: { id: material.id, title: material.title, kind: material.kind },
  });
}
