"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Award, ShieldCheck, ExternalLink, Download, Sparkles, Loader2, Star,
  Code2, GitBranch, Rocket, TrendingUp, TrendingDown, Minus, Trophy,
  CheckCircle2, Target, Calendar, GraduationCap, Users,
  ExternalLink as ExtLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { gradeColor } from "@/lib/constants";

// ============================================================
// Types — mirror the /api/student/credentials response shape
// ============================================================
interface CertificateCourse {
  id: string;
  name: string;
  category: string;
  level: string;
  durationWeeks: number;
  instructorName: string | null;
}

interface Certificate {
  id: string;
  credentialId: string | null;
  courseName: string;
  studentName: string;
  grade: string;
  score: number;
  issuedAt: string;
  signedBy: string;
  distinction: boolean;
  capstonePassed: boolean;
  skillsVerified: string[];
  verifyUrl: string;
  course: CertificateCourse | null;
}

interface Milestone {
  id: string;
  type: string;
  courseId: string | null;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  earnedAt: string;
}

interface SkillMastery {
  id: string;
  topic: string;
  pillar: string;
  masteryLevel: string;
  evidenceCount: number;
  lastAssessedWeek: number | null;
  trend: string;
}

interface CapstoneInfo {
  projectName: string | null;
  projectDescription: string | null;
  githubUrl: string | null;
  liveDemoUrl: string | null;
}

interface CredentialsResponse {
  certificates: Certificate[];
  milestones: Milestone[];
  skillMastery: SkillMastery[];
  capstone: CapstoneInfo;
}

// ============================================================
// Milestone type metadata — icon + label per milestone type
// ============================================================
const MILESTONE_META: Record<string, { icon: typeof Trophy; label: string; color: string }> = {
  course_completion: { icon: GraduationCap, label: "Course Completion", color: "text-blue-500" },
  distinction: { icon: Star, label: "With Distinction", color: "text-amber-500" },
  capstone_certified: { icon: Code2, label: "Capstone Certified", color: "text-emerald-500" },
  skill_mastery: { icon: ShieldCheck, label: "Skill Mastery", color: "text-purple-500" },
  consistent_performer: { icon: TrendingUp, label: "Consistent Performer", color: "text-cyan-500" },
  peer_recognized: { icon: Users, label: "Peer Recognized", color: "text-pink-500" },
  mentor_endorsed: { icon: Trophy, label: "Mentor Endorsed", color: "text-orange-500" },
};

const MASTERY_META: Record<string, { label: string; pct: number; color: string }> = {
  mastered: { label: "Mastered", pct: 100, color: "text-emerald-500" },
  proficient: { label: "Proficient", pct: 80, color: "text-lime-500" },
  developing: { label: "Developing", pct: 50, color: "text-amber-500" },
  "not-started": { label: "Not Started", pct: 10, color: "text-muted-foreground" },
};

// ============================================================
// Main component
// ============================================================
export function CredentialsView() {
  const [data, setData] = useState<CredentialsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<CredentialsResponse>("/api/student/credentials")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load credentials"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading your credentials…</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <p className="text-sm text-destructive">{error || "Unable to load credentials."}</p>
        </CardContent>
      </Card>
    );
  }

  const hasCertificates = data.certificates.length > 0;
  const hasMilestones = data.milestones.length > 0;
  const hasMastery = data.skillMastery.length > 0;
  const hasCapstone = Boolean(data.capstone.projectName);

  if (!hasCertificates && !hasMilestones && !hasMastery && !hasCapstone) {
    return (
      <Card className="border-border">
        <CardContent className="p-8 text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold">No credentials yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Complete weekly tests and your capstone project to earn your first verified
            credential. Skill mastery will appear here once you&apos;ve practiced a few topics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Earned certificates */}
      {hasCertificates && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Verified credentials
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.certificates.map((cert) => (
              <CertificateCard key={cert.id} cert={cert} />
            ))}
          </div>
        </section>
      )}

      {/* Capstone project info */}
      {hasCapstone && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" /> Capstone project
          </h2>
          <CapstoneCard capstone={data.capstone} />
        </section>
      )}

      {/* Skill mastery */}
      {hasMastery && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Skill verifications
          </h2>
          <Card>
            <CardHeader>
              <CardDescription>
                Each skill below is graded from your Socratic test interactions. Verified mastery
                requires ≥ 75% average correctness across multiple assessments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.skillMastery.map((sm) => {
                const meta = MASTERY_META[sm.masteryLevel] ?? MASTERY_META["not-started"];
                const TrendIcon = sm.trend === "improving" ? TrendingUp : sm.trend === "declining" ? TrendingDown : Minus;
                return (
                  <div key={sm.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{sm.topic}</span>
                        <Badge variant="outline" className="text-[10px]">{sm.pillar}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium", meta.color)}>{meta.label}</span>
                        <TrendIcon className={cn("h-3.5 w-3.5", sm.trend === "improving" ? "text-emerald-500" : sm.trend === "declining" ? "text-destructive" : "text-muted-foreground")} />
                      </div>
                    </div>
                    <Progress value={meta.pct} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">
                      {sm.evidenceCount} assessment{sm.evidenceCount === 1 ? "" : "s"}
                      {sm.lastAssessedWeek !== null && ` · last at week ${sm.lastAssessedWeek}`}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Professional milestones */}
      {hasMilestones && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Professional milestones
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.milestones.map((m) => {
              const meta = MILESTONE_META[m.type] ?? { icon: Target, label: m.type, color: "text-muted-foreground" };
              const Icon = meta.icon;
              return (
                <Card key={m.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={cn("mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10", meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{m.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] capitalize">{meta.label}</Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(m.earnedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function CertificateCard({ cert }: { cert: Certificate }) {
  const certIdForLinkedIn = cert.credentialId ?? cert.id;
  const certUrl = typeof window !== "undefined"
    ? `${window.location.origin}${cert.verifyUrl}`
    : `https://examiner-ai-tau.vercel.app${cert.verifyUrl}`;

  const linkedInUrl =
    `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME` +
    `&name=${encodeURIComponent(cert.courseName)}` +
    `&organizationName=TraineesAI` +
    `&issueYear=${new Date(cert.issuedAt).getFullYear()}` +
    `&issueMonth=${new Date(cert.issuedAt).getMonth() + 1}` +
    `&certUrl=${encodeURIComponent(certUrl)}` +
    `&certId=${encodeURIComponent(certIdForLinkedIn)}`;

  return (
    <Card className={cn("overflow-hidden", cert.distinction && "border-amber-500/40 ring-1 ring-amber-500/20")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="truncate">{cert.courseName}</span>
            </CardTitle>
            <CardDescription className="mt-1">
              Issued {new Date(cert.issuedAt).toLocaleDateString()} · Signed by {cert.signedBy}
            </CardDescription>
          </div>
          {cert.distinction && (
            <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30 flex-shrink-0">
              <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" /> Distinction
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Score + grade */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Grade</p>
            <p className={cn("text-xl font-bold", gradeColor(cert.grade))}>{cert.grade}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
            <p className="text-xl font-bold text-foreground">{cert.score}%</p>
          </div>
        </div>

        {/* Capstone */}
        {cert.capstonePassed && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Capstone defended
          </div>
        )}

        {/* Skills verified */}
        {cert.skillsVerified.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Skills verified</p>
            <div className="flex flex-wrap gap-1">
              {cert.skillsVerified.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">
                  <ShieldCheck className="h-2.5 w-2.5 mr-1 text-emerald-500" />
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" className="flex-1">
            <Link href={cert.verifyUrl} target="_blank">
              <ExtLink className="h-3.5 w-3.5" /> Verify
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="flex-1">
            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CapstoneCard({ capstone }: { capstone: CapstoneInfo }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base">{capstone.projectName}</h3>
            {capstone.projectDescription && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                {capstone.projectDescription}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {capstone.githubUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={capstone.githubUrl} target="_blank" rel="noopener noreferrer">
                <GitBranch className="h-3.5 w-3.5" /> GitHub repo
              </a>
            </Button>
          )}
          {capstone.liveDemoUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={capstone.liveDemoUrl} target="_blank" rel="noopener noreferrer">
                <Rocket className="h-3.5 w-3.5" /> Live demo
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
