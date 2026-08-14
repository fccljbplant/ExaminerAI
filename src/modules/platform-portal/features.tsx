"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/modules/learner-portal/use-api";
import { Switch } from "@/modules/ui/switch";

/**
 * modules/platform-portal — Features (W11 audit: V1 FeaturesPanel restored)
 *
 * Global feature toggles (ai, tutor, weekly test, signup, messages) +
 * the portal rollout flags, on the v2 stack. PATCH /api/v2/platform/features.
 */

interface FeaturesData {
  feature: { key: string; enabled: boolean }[];
  portals: { key: string; enabled: boolean }[];
}

const FEATURE_LABELS: Record<string, string> = {
  ai_enabled: "AI features",
  ai_tutor_enabled: "AI tutor",
  weekly_test_enabled: "Weekly tests",
  signup_enabled: "Open signup",
  messages_enabled: "Messages",
};

const PORTAL_LABELS: Record<string, string> = {
  learner: "Learner portal (v2)",
  study_flow: "Study flow (v2)",
  submissions: "Submissions (v2)",
  exams: "Exams (v2)",
  instructor: "Instructor portal (v2)",
  org: "Org portal (v2)",
  platform: "Platform portal (v2)",
};

export function PlatformFeatures() {
  const { data, error, isLoading, retry } = useApi<FeaturesData>("/api/v2/platform/features");

  async function toggle(key: string, enabled: boolean) {
    try {
      const res = await fetch("/api/v2/platform/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: enabled }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Toggle failed");
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
      retry();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toggle failed");
      retry();
    }
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />;
  if (error || !data) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
        <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
        {error}
        <button type="button" onClick={retry} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Features</h1>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Global features</h2>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.feature.map((f) => (
            <ToggleRow
              key={f.key}
              label={FEATURE_LABELS[f.key] ?? f.key}
              hint={`feature_${f.key}`}
              enabled={f.enabled}
              onToggle={(v) => void toggle(f.key, v)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Portal rollout (v2)</h2>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.portals.map((p) => (
            <ToggleRow
              key={p.key}
              label={PORTAL_LABELS[p.key] ?? p.key}
              hint={`feature_portal_${p.key}_v2`}
              enabled={p.enabled}
              onToggle={(v) => void toggle(p.key, v)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  enabled,
  onToggle,
}: {
  label: string;
  hint: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="truncate font-mono text-[11px] text-fg-muted">{hint}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        aria-label={`Toggle ${label}`}
      />
    </div>
  );
}
