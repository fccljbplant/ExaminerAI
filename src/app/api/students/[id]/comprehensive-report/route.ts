import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, assertCanAccessStudent } from "@/lib/auth";
import { ADMIN_ROLES, hasRole } from "@/lib/rbac";
import { generateComprehensiveReport } from "@/modules/comprehensive-report";
import { checkUserAILimit, isDemoAIBlocked, categoryForFeature } from "@/lib/ai-rate-limits";
import { logAudit } from "@/lib/audit-log";

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
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Access denied" }, { status: err.status || 403 });
    }
  }

  // Demo AI check (the report uses AI to generate the narrative + recommendations)
  const isDemoUser = payload.email === "demo@examiner.ai";
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
    }).catch(() => {});
  }

  return NextResponse.json({ report });
}
