import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  GraduationCap, ShieldCheck, Award, Calendar, User, BookOpen,
  ExternalLink, Download, Sparkles, CheckCircle2, Star, Code2, LinkIcon,
} from "lucide-react";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Card, CardContent } from "@/modules/ui/card";
import { fetchCertificateForVerification, fetchCertificateIssuer } from "@/lib/marketplace";
import { scoreToGrade, gradeColor } from "@/lib/constants";
import { CopyLinkButton } from "./CopyLinkButton";
import { PrintButton } from "./PrintButton";

type Params = { params: Promise<{ credentialId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { credentialId } = await params;
  const cert = await fetchCertificateForVerification(credentialId);
  if (!cert) {
    return {
      title: "Verify Credential — TraineesAI",
      description:
        "Verify the authenticity of a TraineesAI digital credential. Employers, admissions officers, and verifiers can confirm a candidate's verified skills and grade.",
      alternates: { canonical: `/verify/${credentialId}` },
    };
  }
  const title = `Verify Credential — ${cert.studentName} · ${cert.courseName} — TraineesAI`;
  const description = `Verified TraineesAI credential for ${cert.studentName} in ${cert.courseName}. Score: ${cert.score}%. Authenticity confirmed on the public TraineesAI registry.`;
  return {
    title,
    description,
    alternates: { canonical: `/verify/${credentialId}` },
    openGraph: {
      title,
      description,
      url: `/verify/${credentialId}`,
      type: "website",
      siteName: "TraineesAI",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
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

  // Unique public verification address (printed on the certificate).
  const siteBase = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://trainees.ai";
  const certIdForLinkedIn = certificate.credentialId ?? certificate.verifyToken ?? certificate.id;
  const certUrl = `${siteBase.replace(/\/$/, "")}/verify/${encodeURIComponent(certIdForLinkedIn)}`;

  // Issuing organization — logo + name shown on the certificate.
  const issuer = await fetchCertificateIssuer({
    institutionId: certificate.institutionId,
    userId: certificate.userId,
  });
  const linkedInUrl =
    `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME` +
    `&name=${encodeURIComponent(certificate.courseName)}` +
    `&organizationName=TraineesAI` +
    `&issueYear=${new Date(certificate.issuedAt).getFullYear()}` +
    `&issueMonth=${new Date(certificate.issuedAt).getMonth() + 1}` +
    `&certUrl=${encodeURIComponent(certUrl)}` +
    `&certId=${encodeURIComponent(certIdForLinkedIn)}`;

  // Twitter/X share intent
  const tweetText = `I just completed "${certificate.courseName}" on TraineesAI with a score of ${certificate.score}% (${scoreToGrade(certificate.score)}). Verified credential: ${certUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  // Facebook share
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(certUrl)}`;

  // WhatsApp share
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(tweetText)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Verification banner */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <ShieldCheck className="h-5 w-5 text-growth-sage" />
          <span className="text-sm font-medium text-growth-sage dark:text-growth-sage">
            Verified TraineesAI Credential
          </span>
        </div>

        {/* Certificate card */}
        <div className="bg-surface border-2 border-brand/30 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 p-6 sm:p-8 text-center border-b border-line">
            {issuer ? (
              <div className="mb-3 flex flex-col items-center gap-2">
                {issuer.logoUrl ? (
                   
                  <img
                    src={issuer.logoUrl}
                    alt={`${issuer.name} logo`}
                    className="h-16 w-16 rounded-2xl border border-line object-cover"
                  />
                ) : (
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-on-brand">
                    <GraduationCap className="h-8 w-8" aria-hidden />
                  </div>
                )}
                <Link
                  href={`/${issuer.slug}`}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Issued by {issuer.name}
                </Link>
              </div>
            ) : (
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-on-brand mb-3">
                <GraduationCap className="h-8 w-8" aria-hidden />
              </div>
            )}
            <h2 className="text-2xl sm:text-3xl font-bold text-fg">
              {certificate.distinction ? "Certificate of Completion with Distinction" : "Certificate of Completion"}
            </h2>
            <p className="text-sm text-fg-muted mt-1">This certifies that</p>
            {certificate.distinction && (
              <Badge className="mt-3 bg-growth-amber/20 text-growth-amber dark:text-growth-amber border-growth-amber">
                <Star className="h-3 w-3 mr-1 fill-amber-500 text-growth-amber" /> With Distinction
              </Badge>
            )}
          </div>

          {/* Student name */}
          <div className="p-6 sm:p-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-fg mb-1">
              {certificate.studentName}
            </h2>
            <p className="text-sm text-fg-muted">has successfully completed</p>
          </div>

          {/* Course + grade */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-subtle/50 p-4">
              <BookOpen className="h-5 w-5 text-brand flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-fg-muted">Course</p>
                <p className="text-sm font-medium text-fg">{certificate.courseName}</p>
                {certificate.course && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {certificate.course.category.replace("-", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {certificate.course.level}
                    </Badge>
                    <span className="text-[10px] text-fg-muted">
                      {certificate.course.durationWeeks}-week program
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Score + grade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-subtle/50 p-4">
                <Award className="h-5 w-5 text-brand flex-shrink-0" />
                <div>
                  <p className="text-xs text-fg-muted">Grade</p>
                  <p className={`text-2xl font-bold ${gradeColor(certificate.grade)}`}>
                    {certificate.grade}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-subtle/50 p-4">
                <Award className="h-5 w-5 text-brand flex-shrink-0" />
                <div>
                  <p className="text-xs text-fg-muted">Final score</p>
                  <p className="text-2xl font-bold text-fg">{certificate.score}%</p>
                </div>
              </div>
            </div>

            {/* Capstone */}
            {certificate.capstonePassed && (
              <div className="flex items-center gap-3 rounded-lg border border-growth-sage bg-growth-sage-soft p-4">
                <Code2 className="h-5 w-5 text-growth-sage flex-shrink-0" />
                <div>
                  <p className="text-xs text-fg-muted">Capstone project</p>
                  <p className="text-sm font-medium text-fg flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-growth-sage" /> Defended and approved
                  </p>
                </div>
              </div>
            )}

            {/* Skills verified */}
            {skillsVerified.length > 0 && (
              <div className="rounded-lg border border-line bg-bg-subtle/50 p-4">
                <p className="text-xs text-fg-muted mb-2">Skills verified</p>
                <div className="flex flex-wrap gap-1.5">
                  {skillsVerified.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      <ShieldCheck className="h-3 w-3 mr-1 text-growth-sage" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Issue date + signed by */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-subtle/50 p-4">
                <Calendar className="h-4 w-4 text-fg-muted flex-shrink-0" />
                <div>
                  <p className="text-xs text-fg-muted">Issued</p>
                  <p className="text-sm font-medium text-fg">
                    {new Date(certificate.issuedAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-subtle/50 p-4">
                <User className="h-4 w-4 text-fg-muted flex-shrink-0" />
                <div>
                  <p className="text-xs text-fg-muted">Signed by</p>
                  <p className="text-sm font-medium text-fg">{certificate.signedBy}</p>
                </div>
              </div>
            </div>

            {/* Unique verification address (2026-08-15) */}
            <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-subtle/50 p-4">
              <LinkIcon className="h-4 w-4 text-brand flex-shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-fg-muted">Verification address</p>
                <p className="truncate font-mono text-xs text-fg">{certUrl}</p>
              </div>
              <CopyLinkButton url={certUrl} />
            </div>

            {/* CTAs — primary actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" className="flex-1">
                <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Add to LinkedIn
                </a>
              </Button>
              <PrintButton className="flex-1" />
            </div>

            {/* Share section — secondary social actions */}
            <div className="mt-3 pt-3 border-t border-line">
              <p className="text-[10px] font-bold uppercase tracking-widest text-fg-muted mb-2">
                Share your achievement
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
                    <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Post on X
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                    <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>
                    Facebook
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.821 11.821 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.866 9.866 0 0 0 1.512 5.26l-.999 3.648 3.976-1.042zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
                    WhatsApp
                  </a>
                </Button>
                {/* Copy link button (client-side) */}
                <CopyLinkButton url={certUrl} />
              </div>
            </div>
          </div>

          {/* Footer — credential ID + powered-by corner (2026-08-15) */}
          <div className="relative bg-bg-subtle/30 border-t border-line p-4 text-center">
            <p className="text-[10px] text-fg-muted">
              Credential ID:{" "}
              <span className="font-mono">{certificate.credentialId ?? certificate.id}</span>
              {issuer && (
                <>
                  {" · "}
                  Issued by <span className="font-medium">{issuer.name}</span>
                </>
              )}
            </p>
            <Link
              href="/"
              className="absolute bottom-2 right-3 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted transition-colors hover:text-brand"
            >
              <GraduationCap className="h-3 w-3" aria-hidden />
              Powered by TraineesAI
            </Link>
          </div>
        </div>

        {/* Verification timestamp */}
        <p className="text-center text-xs text-fg-muted mt-4">
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
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center border-destructive/30 bg-destructive/5">
        <CardContent className="p-8 space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldCheck className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-fg">Invalid credential</h2>
          <p className="text-sm text-fg-muted">
            We couldn&apos;t find a TraineesAI credential with the ID
            <span className="font-mono block mt-1 px-2 py-1 rounded bg-bg-subtle text-xs break-all">
              {credentialId}
            </span>
          </p>
          <p className="text-xs text-fg-muted">
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
