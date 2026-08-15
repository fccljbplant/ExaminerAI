"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, Globe, ImageIcon, Loader2, RefreshCw, Trash2, X } from "lucide-react";
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
 * Organization profile (2026-08-15): name, public storefront address
 * (/<slug>) with live availability check, logo (shown on certificates +
 * the org's public page), description, address and website — the same
 * PUT, audited.
 *
 * Portal rollout flags are PLATFORM-level controls (audit 9.2): they
 * live in Platform Admin → Features only.
 */

interface SettingsData {
  branding: { brandHex: string; mode: string; derivedAt: string } | null;
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
    description: string | null;
    address: string | null;
    website: string | null;
  } | null;
}

const LOGO_MAX_BYTES = 300_000;

export function OrgControl() {
  const { data, error, isLoading, retry } = useApi<SettingsData>("/api/v2/org/settings");

  const [brandHex, setBrandHex] = useState(oklchToHex(DEFAULT_BRAND_OKLCH));
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // Slug availability (debounced, checked against the org's own slug)
  const [slugState, setSlugState] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slugReason, setSlugReason] = useState<string | null>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render-phase hydrate (no setState in effects — react-hooks rule).
  const [prevData, setPrevData] = useState<SettingsData | null | undefined>(undefined);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setBrandHex(data.branding?.brandHex ?? oklchToHex(DEFAULT_BRAND_OKLCH));
      setName(data.organization?.name ?? "");
      setSlug(data.organization?.slug ?? "");
      setLogoUrl(data.organization?.logoUrl ?? null);
      setDescription(data.organization?.description ?? "");
      setAddress(data.organization?.address ?? "");
      setWebsite(data.organization?.website ?? "");
      setSlugState("idle");
      setHydrated(true);
    }
  }

  useEffect(() => {
    if (slugTimer.current) clearTimeout(slugTimer.current);
    if (!hydrated || !slug) {
      setSlugState("idle");
      setSlugReason(null);
      return;
    }
    setSlugState("checking");
    slugTimer.current = setTimeout(() => {
      void api
        .get<{ ok: boolean; data: { available: boolean; slug: string; reason?: string } }>(
          `/api/v2/org/check-name?slug=${encodeURIComponent(slug)}`,
        )
        .then((res) => {
          setSlugState(res.data?.available ? "available" : "taken");
          setSlugReason(res.data?.available ? null : (res.data?.reason ?? "Unavailable"));
          if (res.data?.available && res.data.slug) setSlug(res.data.slug);
        })
        .catch(() => {
          setSlugState("idle");
          setSlugReason(null);
        });
    }, 450);
    return () => {
      if (slugTimer.current) clearTimeout(slugTimer.current);
    };
  }, [slug, hydrated]);

  const palette = useMemo(() => {
    try {
      return deriveBrandPalette(brandHex);
    } catch {
      return null;
    }
  }, [brandHex]);

  const previewColor = palette?.light?.brand ?? brandHex;

  async function onLogoPick(file: File | undefined) {
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo too large", { description: "Keep it under 300KB (a 512px PNG/JPEG is plenty)." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/v2/org/settings", {
        branding: { brandHex },
        organization: {
          name,
          slug,
          logoUrl,
          description: description || null,
          address: address || null,
          website: website || null,
        },
      });
      toast.success("Settings saved", {
        description: "Branding and organization profile are live (30s cache).",
      });
      // The shell header shows the org logo + name — refresh it in place.
      window.dispatchEvent(new Event("org-profile-updated"));
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

      {/* organization profile (2026-08-15) */}
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Organization profile</h2>
        <p className="text-xs text-fg-muted">
          This powers your public page — every organization gets its own address on the
          marketplace, and your logo appears on member certificates.
        </p>

        {/* logo */}
        <div className="flex items-center gap-3">
          {logoUrl ? (
             
            <img
              src={logoUrl}
              alt="Organization logo"
              className="h-14 w-14 rounded-xl border border-line object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-line text-fg-muted">
              <ImageIcon className="h-5 w-5" aria-hidden />
            </span>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <label className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-fg transition-colors hover:bg-bg-subtle">
                {logoUrl ? "Change logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => void onLogoPick(e.target.files?.[0])}
                />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  aria-label="Remove logo"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-muted transition-colors hover:bg-bg-subtle hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            <p className="text-[10px] text-fg-muted">PNG / JPEG / WebP up to 300KB — shown on certificates too.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-fg">Organization name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Inzet Enterprises"
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-fg">Public address</span>
            <span className="flex items-center gap-1">
              <span className="text-sm text-fg-muted">trainees.ai/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="inzetenterprises"
                aria-label="Organization slug"
                className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
              />
            </span>
            {slugState === "checking" && (
              <p className="flex items-center gap-1 text-xs text-fg-muted">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking availability…
              </p>
            )}
            {slugState === "available" && (
              <p className="flex items-center gap-1 text-xs text-success">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Available
              </p>
            )}
            {slugState === "taken" && (
              <p className="flex items-center gap-1 text-xs text-danger">
                <X className="h-3.5 w-3.5" aria-hidden /> {slugReason ?? "Unavailable"}
              </p>
            )}
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-fg">Short description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Engineering training for power-plant teams"
            className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-fg">Address</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Lahore, Pakistan"
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-fg">Website</span>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://inzet.pk"
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
          <Globe className="h-3.5 w-3.5" aria-hidden />
          Your public page:{" "}
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand hover:underline"
          >
            /{slug}
          </a>
        </p>
      </section>

      {/* public catalog (2026-08-15) */}
      <OrgCatalogSection />

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
      <div className="h-64 rounded-xl bg-bg-subtle" />
      <div className="h-48 rounded-xl bg-bg-subtle" />
      <div className="h-64 rounded-xl bg-bg-subtle" />
    </div>
  );
}

/** Public catalog — courses shown on the org's storefront page. */
function OrgCatalogSection() {
  const { data, error, retry } = useApi<{
    linked: Array<{ id: string; name: string; subtitle: string | null; thumbnailUrl: string | null }>;
    available: Array<{ id: string; name: string; subtitle: string | null }>;
  }>("/api/v2/org/catalog");

  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState("");

  async function add() {
    if (!selected) return;
    setAdding(true);
    try {
      await api.post("/api/v2/org/catalog", { courseId: selected });
      setSelected("");
      toast.success("Added to your public catalog");
      retry();
    } catch (e) {
      toast.error("Couldn't add course", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setAdding(false);
    }
  }

  async function remove(courseId: string) {
    try {
      await api.delete(`/api/v2/org/catalog?courseId=${encodeURIComponent(courseId)}`);
      toast.success("Removed from your public catalog");
      retry();
    } catch (e) {
      toast.error("Couldn't remove course", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    }
  }

  if (!data && !error) {
    return <div className="h-24 animate-pulse rounded-xl bg-bg-subtle" aria-busy="true" />;
  }
  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-fg">
        <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
        Couldn&apos;t load your catalog
        <button
          type="button"
          onClick={retry}
          className="ml-auto inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-xs font-semibold hover:bg-bg-subtle"
        >
          Retry
        </button>
      </div>
    );
  }

  const linked = data?.linked ?? [];
  const available = data?.available ?? [];

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Public catalog</h2>
      <p className="text-xs text-fg-muted">
        Courses listed on your public storefront page — learners can enroll directly from there.
      </p>

      {linked.length === 0 ? (
        <p className="rounded-md border border-dashed border-line p-3 text-center text-xs text-fg-muted">
          No courses in your catalog yet — add one below.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {linked.map((c) => (
            <li key={c.id} className="flex min-h-12 items-center gap-2 py-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                {c.subtitle && (
                  <span className="block truncate text-xs text-fg-muted">{c.subtitle}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => void remove(c.id)}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Add a course to your catalog"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
          >
            <option value="">Add a published course…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void add()}
            disabled={adding || !selected}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Add to catalog"}
          </button>
        </div>
      )}
    </section>
  );
}
