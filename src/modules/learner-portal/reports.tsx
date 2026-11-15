"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Award,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

/**
 * modules/learner-portal — PrivateReports (W11 audit: V1
 * ComprehensiveReportView + GrowthReportPanel restored)
 *
 * The learner's private AI reports (comprehensive + growth) on the v2
 * progress page, over the surviving guarded v1 routes. The reports are
 * heavy AI calls, so they load lazily on demand — never on page load —
 * and the wait always keeps a way out (cancel).
 */

interface MeShape {
  user: { id: string } | null;
}

export interface ComprehensiveReportShape {
  executiveSummary?: string;
  sections?: { title?: string; content?: string }[];
}

export interface GrowthReportShape {
  overview?: string;
  strengths?: string[];
  growthAreas?: string[];
  recommendations?: string[];
}

export function PrivateReports() {
  const [meId, setMeId] = useState<string | null>(null);
  const [comprehensive, setComprehensive] = useState<ComprehensiveReportShape | null>(null);
  const [growth, setGrowth] = useState<GrowthReportShape | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MeShape | null) => {
        if (!cancelled && d?.user?.id) setMeId(d.user.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(async () => {
    if (!meId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const [c, g] = await Promise.all([
        fetch(`/api/students/${meId}/comprehensive-report?forceRegenerate=true`, { signal: controller.signal }).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch(`/api/growth-reports/${meId}`, { signal: controller.signal }).then((r) => (r.ok ? r.json() : null),
        ),
      ]);
      setComprehensive(c?.report ?? null);
      setGrowth(g?.report ?? null);
      if (!c?.report && !g?.report) throw new Error("Reports could not be generated");
      toast.success("Private reports ready");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return; // user cancelled — not an error
      setError(e instanceof Error ? e.message : "Report generation failed");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  }, [meId]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const hasAny = Boolean(comprehensive || growth);

  return (
    <section aria-label="Private reports" className="rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <FileText className="h-3.5 w-3.5" aria-hidden />
        Private reports
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">
        Your comprehensive + growth reports are private by default — generated on demand and
        visible only to you and your instructors.
      </p>

      {!hasAny && !busy && (
        <button
          type="button"
          onClick={() => void generate()}
          disabled={!meId}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Generate my reports
        </button>
      )}

      {busy && (
        <div className="mt-3 flex flex-wrap items-center gap-3" aria-busy="true">
          <p className="flex items-center gap-2 text-xs text-fg-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            The AI is writing your reports — this can take a minute…
          </p>
          <button
            type="button"
            onClick={cancel}
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-xs font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-xs font-medium text-danger">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
          <button type="button" onClick={() => void generate()} className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-2 text-xs font-semibold text-fg hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
            <RefreshCw className="h-3 w-3" aria-hidden /> Retry
          </button>
        </p>
      )}

      {comprehensive && <ComprehensiveReportView report={comprehensive} />}
      {growth && <GrowthReportView report={growth} />}
    </section>
  );
}

/** Comprehensive report card. Curates the first 4 sections, full set one tap away (rule 5). */
export function ComprehensiveReportView({ report }: { report: ComprehensiveReportShape }) {
  const [showAll, setShowAll] = useState(false);
  const sections = report.sections ?? [];
  const visible = showAll ? sections : sections.slice(0, 4);

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-bg p-3">
      <p className="text-xs font-semibold text-fg">Comprehensive report</p>
      {report.executiveSummary && (
        <p className="text-sm leading-relaxed text-fg">{report.executiveSummary}</p>
      )}
      {visible.map((sec, i) => (
        <div key={i}>
          <p className="mt-2 text-xs font-semibold text-fg-secondary">
            {sec.title ?? `Section ${i + 1}`}
          </p>
          <p className="text-sm leading-relaxed text-fg">{sec.content}</p>
        </div>
      ))}
      {sections.length > 4 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-xs font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          {showAll ? "Show first 4 sections" : `Show all ${sections.length} sections`}
        </button>
      )}
    </div>
  );
}

/** Growth report card: overview leads, lists as scannable bullets. */
export function GrowthReportView({ report }: { report: GrowthReportShape }) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-bg p-3">
      <p className="text-xs font-semibold text-fg">Growth report</p>
      {report.overview && <p className="text-sm leading-relaxed text-fg">{report.overview}</p>}
      {report.strengths && report.strengths.length > 0 && (
        <div>
          <p className="mt-2 text-xs font-semibold text-fg-secondary">Strengths</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-fg">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {report.growthAreas && report.growthAreas.length > 0 && (
        <div>
          <p className="mt-2 text-xs font-semibold text-fg-secondary">Growth areas</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-fg">
            {report.growthAreas.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {report.recommendations && report.recommendations.length > 0 && (
        <div>
          <p className="mt-2 text-xs font-semibold text-fg-secondary">Recommendations</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-fg">
            {report.recommendations.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * ClaimCertificate — the v1 "Claim Your Certificate" flow restored.
 * GET /api/student/check-completion auto-issues when eligible and
 * returns the certificate + verify URL otherwise explains eligibility.
 */
export function ClaimCertificate({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [busy, setBusy] = useState(false);

  async function claim() {
    setBusy(true);
    try {
      const res = await fetch(`/api/student/check-completion?courseId=${courseId}`);
      const payload = (await res.json().catch(() => ({}))) as {
        certificate?: { verifyUrl?: string };
        issued?: boolean;
        eligible?: boolean;
        reason?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not check eligibility");
      if (payload.issued) {
        toast.success("Certificate issued 🎉", {
          description: payload.certificate?.verifyUrl
            ? "Refresh this page to see it under Credentials."
            : "It will appear under Credentials.",
        });
        window.location.reload();
      } else if (payload.eligible === false && payload.reason) {
        toast.error(payload.reason);
      } else {
        toast.error("Not eligible yet — finish all weekly tests first.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void claim()}
      disabled={busy}
      className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-bg-subtle px-3 text-xs font-semibold text-fg transition-colors hover:border-brand focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Award className="h-3.5 w-3.5" aria-hidden />}
      Claim certificate · {courseName}
    </button>
  );
}
