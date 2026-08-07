import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { issueCertificate, checkEligibility, type CertificateRow } from "@/lib/certificate";

/**
 * GET /api/student/check-completion?courseId=...
 *
 * Auth: required (student).
 *
 * Checks whether the student is eligible to receive a verified digital
 * credential for the given course. If eligible AND no certificate exists,
 * auto-issues one (idempotent — safe to call multiple times).
 *
 * Returns:
 *   {
 *     eligible: boolean,
 *     hasCertificate: boolean,
 *     certificate: Certificate | null,
 *     avgScore: number,
 *     weeksCompleted: number,
 *     totalWeeks: number,
 *     capstonePassed: boolean,
 *     justIssued: boolean,
 *   }
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json(
      { error: "Only students can check their own course completion" },
      { status: 403 },
    );
  }

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "courseId query parameter is required" }, { status: 400 });
  }

  try {
    const eligibility = await checkEligibility(user.id, courseId);
    if (!eligibility) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    let justIssued = false;
    let certificate: CertificateRow | null = null;

    // If the student is eligible AND doesn't yet have a cert, auto-issue one.
    if (eligibility.eligible && !eligibility.hasCertificate) {
      const result = await issueCertificate(user.id, courseId);
      if (result) {
        certificate = result.certificate;
        justIssued = result.issued;
      }
    } else if (eligibility.hasCertificate) {
      // Already has one — fetch + return it so the client can render the
      // "Claimed" state without another round-trip.
      certificate = await db.certificate.findFirst({
        where: { userId: user.id, courseId, grade: { not: "PENDING" } },
      });
    }

    return NextResponse.json({
      eligible: eligibility.eligible || eligibility.hasCertificate,
      hasCertificate: eligibility.hasCertificate || Boolean(certificate),
      certificate,
      avgScore: eligibility.avgScore,
      weeksCompleted: eligibility.weeksCompleted,
      totalWeeks: eligibility.totalWeeks,
      capstonePassed: eligibility.capstonePassed,
      justIssued,
    });
  } catch (err) {
    logger.error("check-completion failed", {
      userId: user.id,
      courseId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Failed to check completion" }, { status: 500 });
  }
}
