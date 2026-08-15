"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "@/modules/learner-portal/use-api";
import { DEFAULT_BRAND_OKLCH, deriveBrandPalette, oklchToHex } from "@/modules/theme";
import { ThemePackPicker } from "@/modules/theme";

/**
 * modules/org-portal — O4 Control Center (REDESIGN-P3 §O4, W7)
 *
 * Branding: brand-color input → LIVE derived palette preview via
 * deriveBrandPalette (WCAG-guaranteed by construction — the AA badge
 * comes from the derivation math) + save (persists org-theme:<orgId>,
 * audited).
 *
 * Portal rollout flags are PLATFORM-level controls (2026-08-15 audit
 * 9.2): an org admin flipping them would toggle the portal for every
 * org. They live in Platform Admin → Features only.
 */

interface SettingsData {
  branding: { brandHex: string; mode: string; derivedAt: string } | null;
}

export function OrgControl() {
  const { data, error, isLoading, retry } = useApi<SettingsData>("/api/v2/org/settings");

  const [brandHex, setBrandHex] = useState(oklchToHex(DEFAULT_BRAND_OKLCH));
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // Render-phase hydrate (no setState in effects — react-hooks rule).
  const [prevData, setPrevData] = useState<SettingsData | null | undefined>(undefined);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setBrandHex(data.branding?.brandHex ?? oklchToHex(DEFAULT_BRAND_OKLCH));
      setHydrated(true);
    }
  }

  const palette = useMemo(() => {
    try {
      return deriveBrandPalette(brandHex);
    } catch {
      return null;
    }
  }, [brandHex]);

  const previewColor = palette?.light?.brand ?? brandHex;

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/v2/org/settings", {
        branding: { brandHex },
      });
      toast.success("Settings saved", {
        description: "Branding is live (30s cache).",
      });
    } catch (e) {
      toast.error("Couldn't save settings", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <ControlSkeleton />;
  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fg">Couldn&apos;t load settings</p>
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
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-lg font-semibold text-fg md:text-xl">Control center</h1>

      {/* theme pack (W15) */}
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Theme pack</h2>
        <p className="text-xs text-fg-muted">
          The packs your team sees in the mode switch. Each member can still pick their own —
          this is the default gallery shipped with the platform.
        </p>
        <ThemePackPicker />
      </section>

      {/* branding */}
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Branding</h2>
        <p className="text-xs text-fg-muted">
          One brand color derives the full accessible palette (OKLCH math, WCAG AA guaranteed by
          construction — the badge below reflects the validator contract).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={brandHex}
            onChange={(e) => setBrandHex(e.target.value)}
            aria-label="Brand color"
            className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface"
          />
          <input
            type="text"
            value={brandHex}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{6}$/.test(v)) setBrandHex(v.toLowerCase());
            }}
            aria-label="Brand color hex"
            className="h-11 w-28 rounded-lg border border-line bg-surface px-3 font-mono text-sm text-fg focus:border-brand focus:outline-none"
          />
          <span className="inline-flex items-center gap-1 rounded-md bg-success-subtle px-2 py-1 text-xs font-medium text-success-on">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            AA guaranteed
          </span>
        </div>

        {/* live preview card */}
        <div
          className="rounded-xl border border-line p-4"
          style={{ backgroundColor: previewColor }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: palette?.light?.onBrand ?? "var(--text-inverse)" }}
          >
            {data.branding?.mode ?? "light"} preview
          </p>
          <div
            className="mt-2 inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium"
            style={{
              backgroundColor: palette?.light?.brand ?? "var(--brand)",
              color: palette?.light?.onBrand ?? "var(--text-inverse)",
            }}
          >
            Primary button
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={saving || !hydrated || !palette}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50 md:w-auto md:px-8"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <BadgeCheck className="h-4 w-4" aria-hidden />
        )}
        Save settings
      </button>
    </div>
  );
}

function ControlSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="h-7 w-40 rounded-md bg-bg-subtle" />
      <div className="h-48 rounded-xl bg-bg-subtle" />
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}
