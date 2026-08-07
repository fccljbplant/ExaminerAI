import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchCertificateForVerification } from "@/lib/marketplace";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

/**
 * GET /api/verify/credential?credentialId=TRN-AI-2026-08-NA-87
 *
 * Phase 6. PUBLIC API for employers to verify credentials. No auth required —
 * employers, admissions officers, and background-check services need to
 * verify credentials without creating a TraineesAI account.
 *
 * Returns (valid):
 *   { valid: true, studentName, courseName, score, completedAt, distinction,
 *     skillsVerified, capstonePassed }
 *
 * Returns (not found):
 *   { valid: false, error: "Credential not found" }
 *
 * Rate limited: max 100 requests per IP per hour (in-memory counter).
 */
export async function GET(req: NextRequest) {
  // Rate limit: 100 requests per IP per hour (3,600,000 ms).
  const ip = getClientIp(req);
  const rateLimitKey = `verify-credential:${ip}`;
  const allowed = checkRateLimit(rateLimitKey, 100, 3_600_000);
  if (!allowed) {
    return NextResponse.json(
      { valid: false, error: "Rate limit exceeded. Maximum 100 verifications per hour." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const credentialId = url.searchParams.get("credentialId")?.trim();

  if (!credentialId || credentialId.length < 4) {
    return NextResponse.json(
      { valid: false, error: "Missing or invalid credentialId parameter" },
      { status: 400 },
    );
  }

  // Reuse the shared lookup helper from marketplace.ts — it accepts both the
  // Phase-6 credentialId ("TRN-AI-2026-08-NA-87") and the legacy verifyToken
  // (64-char hex) so this endpoint works for every certificate ever issued.
  const certificate = await fetchCertificateForVerification(credentialId);

  if (!certificate) {
    return NextResponse.json(
      { valid: false, error: "Credential not found" },
      { status: 404 },
    );
  }

  // Parse the skillsVerified JSON array (defensive — never trust stored JSON).
  let skillsVerified: string[] = [];
  try {
    const parsed = JSON.parse(certificate.skillsVerified || "[]");
    if (Array.isArray(parsed)) {
      skillsVerified = parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    skillsVerified = [];
  }

  return NextResponse.json({
    valid: true,
    studentName: certificate.studentName,
    courseName: certificate.courseName,
    score: certificate.score,
    completedAt: certificate.completedAt,
    distinction: certificate.distinction,
    skillsVerified,
    capstonePassed: certificate.capstonePassed,
    verifiedAt: new Date().toISOString(),
  });
}

// Mark this route as dynamic — it reads query params + IP headers, so it must
// never be statically rendered at build time.
export const dynamic = "force-dynamic";
