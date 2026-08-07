import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { GraduationCap, ShieldCheck, Award, Calendar, User, BookOpen } from "lucide-react";
import { scoreToGrade, gradeColor } from "@/lib/constants";

/** /verify/[token] — public certificate verification page.
 *
 *  Phase 4.3. No login required. Anyone with the verify token URL can
 *  check if a certificate is genuine. Renders a professional-looking
 *  certificate card with the student's name, course, grade, score,
 *  issue date, and signed-by.
 *
 *  This is a server component — it fetches the certificate directly from
 *  the DB on render. No client-side JS needed for the verification itself.
 */

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const certificate = await db.certificate.findUnique({
    where: { verifyToken: token },
    select: { studentName: true, courseName: true },
  });
  if (!certificate) return { title: "Certificate Not Found" };
  return {
    title: `${certificate.studentName} — ${certificate.courseName} Certificate`,
    description: `Verified certificate for ${certificate.studentName} in ${certificate.courseName}.`,
  };
}

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token || token.length < 32) {
    notFound();
  }

  const certificate = await db.certificate.findUnique({
    where: { verifyToken: token },
  });

  if (!certificate) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Verification banner */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Verified Certificate
          </span>
        </div>

        {/* Certificate card */}
        <div className="bg-card border-2 border-primary/30 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6 text-center border-b border-border">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-3">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Certificate of Completion</h1>
            <p className="text-sm text-muted-foreground mt-1">This certifies that</p>
          </div>

          {/* Student name */}
          <div className="p-6 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-1">{certificate.studentName}</h2>
            <p className="text-sm text-muted-foreground">has successfully completed</p>
          </div>

          {/* Course + grade */}
          <div className="px-6 pb-6 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
              <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Course</p>
                <p className="text-sm font-medium text-foreground">{certificate.courseName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Award className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Grade</p>
                  <p className={`text-2xl font-bold ${gradeColor(certificate.grade)}`}>{certificate.grade}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Award className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-2xl font-bold text-foreground">{certificate.score}%</p>
                </div>
              </div>
            </div>

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
          </div>

          {/* Footer */}
          <div className="bg-muted/30 border-t border-border p-4 text-center">
            <p className="text-[10px] text-muted-foreground">
              Certificate ID: {certificate.id} · Verify at /verify/{certificate.verifyToken.slice(0, 8)}…
            </p>
          </div>
        </div>

        {/* Verification timestamp */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Verified on {new Date().toLocaleString()} · This certificate was issued by TraineesAI
        </p>
      </div>
    </div>
  );
}
