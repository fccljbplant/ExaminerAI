import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/certificates/verify?token=XXX — public verification endpoint.
 *
 *  Phase 4.3. No auth required — anyone with the verify token (employer,
 *  parent, admissions officer) can check if a certificate is genuine.
 *
 *  Returns the certificate details if the token is valid, or 404 if not found.
 *  Does NOT return the student's email or other PII — just enough to verify
 *  the certificate is real (name, course, grade, score, issue date, signed by).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const certificate = await db.certificate.findUnique({
    where: { verifyToken: token },
    select: {
      id: true,
      courseName: true,
      studentName: true,
      grade: true,
      score: true,
      issuedAt: true,
      signedBy: true,
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    certificate,
    verifiedAt: new Date().toISOString(),
  });
}
