"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Inbox,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";

/**
 * modules/instructor-portal — Certificate management (V1
 * CertificateApprovals re-homed, W10 audit + W11 request queue)
 *
 * Issue certificates to your students (grade + score), review pending
 * student requests with eligibility computed server-side (approve /
 * reject), and list issued ones with public verify links.
 * IDOR-guarded server-side.
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

interface PendingRequest {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  requestedAt: string;
  completedTests: number;
  totalWeeks: number;
  avgScore: number | null;
  eligible: boolean;
  ineligibleReason?: string;
}

export function CertificatesPanel() {
  const { data, error, isLoading, retry } = useApi<CertData>("/api/v2/instructor/certificates");
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);
  const [busyReq, setBusyReq] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/certificates/pending");
      if (!res.ok) return;
      const payload = (await res.json()) as { requests: PendingRequest[] };
      setRequests(payload.requests);
    } catch {
      // Non-blocking — the issued list still renders.
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function decide(userId: string, reject: boolean) {
    setBusyReq(userId);
    try {
      if (reject) {
        const reason = window.prompt("Reason for rejection (shown in the audit log):") ?? "Rejected by staff";
        await api.post(`/api/certificates/generate?userId=${userId}&reject=true`, { reason });
        toast.success("Request rejected");
      } else {
        await api.post(`/api/certificates/generate?userId=${userId}`, {});
        toast.success("Certificate issued", { description: "The student has been notified." });
        retry();
      }
      void loadRequests();
    } catch (e) {
      toast.error(reject ? "Couldn't reject request" : "Couldn't approve request", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setBusyReq(null);
      setRejectingId(null);
    }
  }

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

      {/* pending requests (v1 CertificateApprovals queue) */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Student requests
        </h2>
        {requests === null ? (
          <div className="h-20 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />
        ) : requests.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface px-4 py-3">
            <Inbox className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
            <p className="text-sm text-fg-muted">No pending certificate requests.</p>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {requests.map((r) => (
              <div key={r.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{r.studentName}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {r.courseName} · requested {new Date(r.requestedAt).toLocaleDateString()} ·{" "}
                    {r.completedTests}/{r.totalWeeks} tests
                    {r.avgScore != null ? ` · avg ${r.avgScore}%` : ""}
                  </p>
                  {r.eligible ? (
                    <p className="mt-0.5 text-xs text-success-on">Eligible for issue</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-warning-on">
                      Not eligible yet — {r.ineligibleReason ?? "requirements not met"}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void decide(r.userId, false)}
                    disabled={busyReq === r.userId || !r.eligible}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
                  >
                    {busyReq === r.userId && rejectingId !== r.userId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(r.userId);
                      void decide(r.userId, true);
                    }}
                    disabled={busyReq === r.userId}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fg-secondary hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
