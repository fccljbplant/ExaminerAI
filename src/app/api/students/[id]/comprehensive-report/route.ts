import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { ADMIN_ROLES, hasRole, isStaffRole } from "@/lib/rbac";
import { generateComprehensiveReport } from "@/modules/comprehensive-report";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import { logAudit } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { demoWriteBlock } from "@/lib/demo-guard";
import { logger } from "@/lib/logger";

/**
 * GET /api/students/[id]/comprehensive-report — generates (or returns cached)
 * comprehensive private report for a student.
 *
 * Query params:
 *   - forceRegenerate: if "true", bypasses the cache and regenerates
 *
 * Access control:
 *   - Students: own report only
 *   - Teachers: students in their batch
 *   - Counsellors: students in their caseload
 *   - Principal + Administrator: ANY student
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Access control
  const isPrivileged = hasRole(payload.role, ADMIN_ROLES);
  if (!isPrivileged && payload.sub !== id) {
    try {
      await assertCanAccessStudent(payload, id);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
    }
  }

  // Demo AI check (the report uses AI to generate the narrative + recommendations)
  const isDemoUser = payload.email.includes("@demo.ai") || payload.email === "demo@examiner.ai";
  if (await isDemoAIBlocked(isDemoUser)) {
    return NextResponse.json({ error: "AI access for demo accounts is currently disabled." }, { status: 403 });
  }

  // Rate limit check (assistant category — student-detail AI tools)
  const category = categoryForFeature("comprehensive-report");
  const limit = await checkUserAILimit(payload.sub, category);
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Daily AI limit reached (${limit.used}/${limit.limit}). Resets at ${limit.resetAt.toISOString()}.`,
      rateLimited: true,
    }, { status: 429 });
  }

  // Parse query params
  const url = new URL(req.url);
  const forceRegenerate = url.searchParams.get("forceRegenerate") === "true";

  // Generate (or fetch cached) report
  const report = await generateComprehensiveReport(id, { forceRegenerate });
  if (!report) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Audit log (privileged users viewing a student's report)
  if (isPrivileged && payload.sub !== id) {
    logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: "comprehensive_report_viewed",
      target: { type: "user", id },
      metadata: { forceRegenerate, cached: report.cached },
      req,
    }).catch((err) => { logger.warn("Operation failed", { err }); });
  }

  return NextResponse.json({ report });
}

/** PATCH /api/students/[id]/comprehensive-report — mark report as reviewed.
 *  ME-5 fix: allows staff to mark an AI-generated comprehensive report as
 *  reviewed, so the UI can show whether a human has verified the AI's
 *  judgments (managerReadiness, leadershipPotential, etc.). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _demoBlock = await demoWriteBlock("reviewing reports"); if (_demoBlock) return _demoBlock;
  const payload = await getAuthUser();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaffRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden — staff only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { reviewed } = body as { reviewed?: boolean };

  if (reviewed === undefined) {
    return NextResponse.json({ error: "reviewed (boolean) required" }, { status: 400 });
  }

  // IDOR check
  try { await assertCanAccessStudent(payload, id); } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || "Access denied" }, { status: 403 });
  }

  // Update the cache entry's 'reviewed' field
  const cacheKey = `comprehensive_report:${id}`;
  const existing = await db.aICache.findUnique({ where: { cacheKey } });
  if (!existing) {
    return NextResponse.json({ error: "No cached report found" }, { status: 404 });
  }

  try {
    const parsed = JSON.parse(existing.response);
    parsed.reviewed = reviewed;
    await db.aICache.update({
      where: { cacheKey },
      data: { response: JSON.stringify(parsed) },
    });

    await logAudit({
      actor: { id: payload.sub, name: payload.name, role: payload.role },
      action: "comprehensive_report_reviewed",
      target: { type: "user", id },
      metadata: { reviewed },
      req,
    }).catch((err) => { logger.warn("Operation failed", { err }); });

    return NextResponse.json({ ok: true, reviewed });
  } catch {
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
