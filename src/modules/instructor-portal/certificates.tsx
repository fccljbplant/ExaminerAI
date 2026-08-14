"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Award,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/instructor-portal — Certificate management (V1
 * CertificateApprovals re-homed, W10 audit)
 *
 * Issue certificates to your students (grade + score) and list issued
 * ones with public verify links. IDOR-guarded server-side.
 */

interface CertData {
  students: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string }>;
  certificates: Array<{
    id: string;
    studentName: string;
    courseName: string;
    grade: string;
    score: number;
    signedBy: string;
    issuedAt: string;
    verifyUrl: string;
  }>;
}

export function CertificatesPanel() {
  const { data, error, isLoading, retry } = useApi<CertData>("/api/v2/instructor/certificates");

  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [grade, setGrade] = useState("A");
  const [score, setScore] = useState(85);
  const [issuing, setIssuing] = useState(false);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setIssuing(true);
    try {
      await api.post("/api/v2/instructor/certificates", { studentId, courseId, grade, score });
      toast.success("Certificate issued", { description: "The student has been notified." });
      setStudentId("");
      retry();
    } catch (err) {
      toast.error("Couldn't issue certificate", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-fg md:text-xl">Certificates</h1>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-subtle px-2 py-1 text-xs font-medium text-fg">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Issued by you
        </span>
      </div>

      {/* issue form */}
      <form onSubmit={issue} className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Award className="h-4 w-4 text-fg-muted" aria-hidden />
          Issue certificate
        </h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            aria-label="Student"
            className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
          >
            <option value="">Select student…</option>
            {data?.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
            aria-label="Course"
            className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
          >
            <option value="">Select course…</option>
            {data?.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            aria-label="Grade"
            className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
          >
            {["A", "B", "C", "D", "F"].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              aria-label="Score"
              className="h-11 w-20 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={issuing || !studentId || !courseId}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {issuing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Award className="h-4 w-4" aria-hidden />}
              Issue
            </button>
          </div>
        </div>
      </form>

      {isLoading ? (
        <CertSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load certificates</p>
          <p className="mt-1 text-xs text-fg-muted">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      ) : !data || data.certificates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-bg-subtle px-4 py-10 text-center">
          <Award className="h-6 w-6 text-fg-muted" aria-hidden />
          <p className="text-sm font-medium text-fg">No certificates issued yet</p>
          <p className="max-w-sm text-xs text-fg-muted">
            Issue your students&apos; certificates above — each gets a public verify link.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.certificates.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-fg">
                <UserRound className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  {c.studentName} · {c.courseName}
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {c.grade} · {c.score} · {new Date(c.issuedAt).toLocaleDateString()}
                </p>
              </div>
              <a
                href={c.verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md border border-line bg-bg-subtle px-2 py-1 text-xs font-medium text-fg hover:border-line-strong"
              >
                Verify
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CertSkeleton() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 rounded-lg bg-bg-subtle" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-bg-subtle" />
            <div className="h-3 w-1/2 rounded bg-bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
