import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  GraduationCap, ShieldCheck, Award, Calendar, User, BookOpen,
  ExternalLink, Download, Sparkles, CheckCircle2, Star, Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchCertificateForVerification } from "@/lib/marketplace";
import { scoreToGrade, gradeColor } from "@/lib/constants";

type Params = { params: Promise<{ credentialId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { credentialId } = await params;
  const cert = await fetchCertificateForVerification(credentialId);
  if (!cert) return { title: "Credential not found — TraineesAI" };
  return {
    title: `${cert.studentName} — ${cert.courseName} Credential`,
    description: `Verified TraineesAI credential for ${cert.studentName} in ${cert.courseName}. Score: ${cert.score}%.`,
  };
}

/** /verify/[credentialId] — public credential verification page.
 *
 *  Phase 6. No login required. Anyone with the credential URL (employer,
 *  admissions officer, parent) can verify a TraineesAI credential is genuine.
 *
 *  The lookup accepts either:
 *    - The Phase-6 `credentialId` (e.g. "TRN-AI-2026-08-NA-87"), OR
 *    - The legacy `verifyToken` (64-char hex) — for certs issued before Phase 6.
 */
export default async function VerifyCredentialPage({ params }: Params) {
  const { credentialId } = await params;

  if (!credentialId || credentialId.length < 4) {
    notFound();
  }

  const certificate = await fetchCertificateForVerification(credentialId);

  if (!certificate) {
    return <InvalidCredential credentialId={credentialId} />;
  }

  // Parse skills verified JSON (Phase 6) — fallback to empty array
  let skillsVerified: string[] = [];
  try {
    const parsed = JSON.parse(certificate.skillsVerified || "[]");
    if (Array.isArray(parsed)) skillsVerified = parsed.filter((s): s is string => typeof s === "string");
  } catch {
    skillsVerified = [];
  }

  // LinkedIn "Add certification" deep link
  const certIdForLinkedIn = certificate.credentialId ?? certificate.id;
  const certUrl = `https://examiner-ai-tau.vercel.app/verify/${encodeURIComponent(certIdForLinkedIn)}`;
  const linkedInUrl =
    `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME` +
    `&name=${encodeURIComponent(certificate.courseName)}` +
    `&organizationName=TraineesAI` +
    `&issueYear=${new Date(certificate.issuedAt).getFullYear()}` +
    `&issueMonth=${new Date(certificate.issuedAt).getMonth() + 1}` +
    `&certUrl=${encodeURIComponent(certUrl)}` +
    `&certId=${encodeURIComponent(certIdForLinkedIn)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Verification banner */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Verified TraineesAI Credential
          </span>
        </div>

        {/* Certificate card */}
        <div className="bg-card border-2 border-primary/30 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 p-6 sm:p-8 text-center border-b border-border">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-3">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {certificate.distinction ? "Certificate of Completion with Distinction" : "Certificate of Completion"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">This certifies that</p>
            {certificate.distinction && (
              <Badge className="mt-3 bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30">
                <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" /> With Distinction
              </Badge>
            )}
          </div>

          {/* Student name */}
          <div className="p-6 sm:p-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-1">
              {certificate.studentName}
            </h2>
            <p className="text-sm text-muted-foreground">has successfully completed</p>
          </div>

          {/* Course + grade */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
              <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Course</p>
                <p className="text-sm font-medium text-foreground">{certificate.courseName}</p>
                {certificate.course && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {certificate.course.category.replace("-", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {certificate.course.level}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {certificate.course.durationWeeks}-week program
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Score + grade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Award className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Grade</p>
                  <p className={`text-2xl font-bold ${gradeColor(certificate.grade)}`}>
                    {certificate.grade}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Award className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Final score</p>
                  <p className="text-2xl font-bold text-foreground">{certificate.score}%</p>
                </div>
              </div>
            </div>

            {/* Capstone */}
            {certificate.capstonePassed && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <Code2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Capstone project</p>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Defended and approved
                  </p>
                </div>
              </div>
            )}

            {/* Skills verified */}
            {skillsVerified.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground mb-2">Skills verified</p>
                <div className="flex flex-wrap gap-1.5">
                  {skillsVerified.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      <ShieldCheck className="h-3 w-3 mr-1 text-emerald-500" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Issue date + signed by */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Issued</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(certificate.issuedAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Signed by</p>
                  <p className="text-sm font-medium text-foreground">{certificate.signedBy}</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" className="flex-1">
                <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Add to LinkedIn
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href="#" onClick={(e) => { e.preventDefault(); window.print(); }}>
                  <Download className="h-4 w-4" /> Download PDF
                </a>
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-muted/30 border-t border-border p-4 text-center">
            <p className="text-[10px] text-muted-foreground">
              Credential ID: <span className="font-mono">{certificate.credentialId ?? certificate.id}</span>
              {" · "}
              Issued by <span className="font-medium">TraineesAI</span>
            </p>
          </div>
        </div>

        {/* Verification timestamp */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Verified on {new Date().toLocaleString()} · This credential was issued by TraineesAI
        </p>

        <div className="text-center mt-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/courses">
              <Sparkles className="h-3.5 w-3.5" /> Browse courses
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function InvalidCredential({ credentialId }: { credentialId: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center border-destructive/30 bg-destructive/5">
        <CardContent className="p-8 space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldCheck className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Invalid credential</h1>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find a TraineesAI credential with the ID
            <span className="font-mono block mt-1 px-2 py-1 rounded bg-muted text-xs break-all">
              {credentialId}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Double-check the URL or contact the credential holder.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/courses">
              <Sparkles className="h-3.5 w-3.5" /> Browse courses
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
