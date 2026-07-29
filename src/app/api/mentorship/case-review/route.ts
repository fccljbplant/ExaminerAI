import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, UserRole, STAFF_ROLES } from "@/lib/rbac";
import { callAI } from "@/lib/ai-provider";
import { enforceAIRateLimit } from "@/lib/ai-rate-limits";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { demoWriteBlock } from "@/lib/demo-guard";

/** POST /api/mentorship/case-review — create an anonymized case review.
 *
 *  The AI strips names/dates/anything identifying before posting.
 *  Teacher reviews the anonymized version before it's shared.
 */
export async function POST(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("reviewing cases"); if (_demoBlock) return _demoBlock;
  if (!(await isFeatureEnabled("ai_enabled"))) {
    return NextResponse.json({ error: "AI features are currently disabled." }, { status: 403 });
  }
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.COORDINATOR, UserRole.COUNSELOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { rawDescription } = body as { rawDescription?: string };
  if (!rawDescription?.trim()) return NextResponse.json({ error: "rawDescription required" }, { status: 400 });
  if (rawDescription.length > 2000) return NextResponse.json({ error: "Too long (max 2000 chars)" }, { status: 400 });

  // AI anonymization pass
  const prompt = `Anonymize this teacher's case description for peer review. Strip ALL identifying information: names, emails, specific dates, project names, anything that could identify the student. Keep the behavioral pattern and the mentorship question.

Original: "${rawDescription}"

Return ONLY the anonymized version (2-4 sentences). Do not include any names, dates, or identifying details.`;

  try {
    // H1 fix: enforce per-user daily AI rate limit + demo block
    const isDemo = auth.ctx.payload.email.includes("@demo.ai") || auth.ctx.payload.email === "demo@examiner.ai";
    const blocked = await enforceAIRateLimit(auth.ctx.payload.sub, "case-review-anonymize", isDemo);
    if (blocked) return NextResponse.json(blocked.body, { status: blocked.status });

    const result = await callAI([{ role: "user", content: prompt }], {
      feature: "case-review-anonymize", temperature: 0.2, maxTokens: 200,
      userId: auth.ctx.payload.sub, // H12 fix: attribute to the staff member posting the case review
    });
    const anonymized = result.text?.trim() || rawDescription; // fallback to raw if AI fails

    // Don't auto-publish — return for teacher review
    return NextResponse.json({
      anonymizedSummary: anonymized,
      requiresConfirmation: true,
      note: "Review the anonymized version. No names or identifying details should remain. Confirm to post for peer review.",
    });
  } catch {
    return NextResponse.json({ anonymizedSummary: rawDescription, requiresConfirmation: true, note: "AI anonymization failed — review carefully before posting." });
  }
}

/** PUT /api/mentorship/case-review — confirm + publish */
export async function PUT(req: NextRequest) {
  const _demoBlock = await demoWriteBlock("reviewing cases"); if (_demoBlock) return _demoBlock;
  const auth = await requireRole([UserRole.INSTRUCTOR, UserRole.COORDINATOR, UserRole.COUNSELOR, UserRole.DEMO]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { patternSummary } = body as { patternSummary?: string };
  if (!patternSummary?.trim()) return NextResponse.json({ error: "patternSummary required" }, { status: 400 });

  const review = await db.caseReview.create({
    data: { postedBy: auth.ctx.payload.sub, patternSummary },
  });
  return NextResponse.json({ review });
}

/** GET /api/mentorship/case-review — list open case reviews for peer teachers */
export async function GET() {
  const auth = await requireRole(STAFF_ROLES as any);
  if (!auth.ok) return auth.response;

  const reviews = await db.caseReview.findMany({
    where: { status: "open", postedBy: { not: auth.ctx.payload.sub } }, // don't show own
    include: { _count: { select: { responses: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ reviews });
}
