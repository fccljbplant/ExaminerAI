"use client";

// src/modules/ui-v3/org-control.tsx — V3 Org Control Center (full restyle).
// Reimplements v2 OrgControl (org-portal/control.tsx, 534 lines) with
// v3 design tokens. Same /api/v2/org/settings + /api/v2/org/catalog
// endpoints, same business logic (brand-color picker with WCAG-AA
// derived palette preview, org profile form, logo upload, slug
// availability check, public catalog management).

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, Globe, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApi } from "./use-api";
import { DEFAULT_BRAND_OKLCH, deriveBrandPalette, oklchToHex } from "@/modules/theme";
import { ThemePackPicker } from "@/modules/theme";
import { V3PageHeader, V3Card, V3Badge } from "./v3-shell";
import { StateError, StateSkeleton, StateSkeletonHero } from "./states";

interface SettingsData {
  branding: { brandHex: string; mode: string; derivedAt: string } | null;
  organization: {
    name: string; slug: string; logoUrl: string | null;
    description: string | null; address: string | null; website: string | null;
  } | null;
}

const LOGO_MAX_BYTES = 300_000;

export function V3OrgControl() {
  const { data, error, loading, retry } = useApi<SettingsData>("/api/v2/org/settings");

  const [brandHex, setBrandHex] = useState(oklchToHex(DEFAULT_BRAND_OKLCH));
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  const [slugState, setSlugState] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slugReason, setSlugReason] = useState<string | null>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        .catch(() => { setSlugState("idle"); setSlugReason(null); });
    }, 450);
    return () => { if (slugTimer.current) clearTimeout(slugTimer.current); };
  }, [slug, hydrated]);

  const palette = useMemo(() => {
    try { return deriveBrandPalette(brandHex); } catch { return null; }
  }, [brandHex]);

  const previewColor = palette?.light?.brand ?? brandHex;

  async function onLogoPick(file: File | undefined) {
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo too large", { description: "Keep it under 300KB (a 512px PNG/JPEG is plenty)." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setLogoUrl(typeof reader.result === "string" ? reader.result : null); };
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/v2/org/settings", {
        branding: { brandHex },
        organization: { name, slug, logoUrl, description: description || null, address: address || null, website: website || null },
      });
      toast.success("Settings saved", { description: "Branding and organization profile are live (30s cache)." });
      window.dispatchEvent(new Event("org-profile-updated"));
    } catch (e) {
      toast.error("Couldn't save settings", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <StateSkeletonHero />
        <StateSkeleton cards={2} />
      </>
    );
  }
  if (error || !data) return <StateError message={error ?? "Settings not found."} onRetry={retry} />;

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--p-type-sm)", fontWeight: 500, color: "var(--text-secondary)",
    display: "block", marginBottom: "var(--p-space-1)",
  };

  return (
    <>
      <V3PageHeader
        title="Control center"
        subtitle="Branding (brand color, logo, theme), organization profile, and storefront settings."
      />

      {/* Organization profile */}
      <V3Card style={{ marginBottom: "var(--p-space-5)" }}>
        <h3>Organization profile</h3>
        <p>This powers your public page — every organization gets its own address on the marketplace, and your logo appears on member certificates.</p>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-3)", marginTop: "var(--p-space-4)" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Organization logo" style={{ height: 56, width: 56, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", objectFit: "cover" }} />
          ) : (
            <span style={{ height: 56, width: 56, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-md)", border: "1px dashed var(--border)", color: "var(--text-muted)", fontSize: 20 }}>🖼️</span>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--p-space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-2)" }}>
              <label className="v3-btn" style={{ fontSize: "var(--p-type-xs)", cursor: "pointer" }}>
                {logoUrl ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={(e) => void onLogoPick(e.target.files?.[0])} />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  aria-label="Remove logo"
                  className="v3-btn"
                  style={{ padding: "var(--p-space-2)", minHeight: 36, minWidth: 36 }}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              )}
            </div>
            <p style={{ fontSize: "var(--p-type-xs)", color: "var(--text-muted)" }}>PNG / JPEG / WebP up to 300KB — shown on certificates too.</p>
          </div>
        </div>

        {/* Name + Slug */}
        <div style={{ display: "grid", gap: "var(--p-space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "var(--p-space-4)" }}>
          <label>
            <span style={labelStyle}>Organization name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Inzet Enterprises" className="v3-input" style={{ width: "100%" }} />
          </label>
          <label>
            <span style={labelStyle}>Public address</span>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--p-space-1)" }}>
              <span style={{ fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>trainees.ai/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="inzetenterprises"
                aria-label="Organization slug"
                className="v3-input"
                style={{ flex: 1, minWidth: 0 }}
              />
            </span>
            {slugState === "checking" && (
              <p style={{ display: "flex", alignItems: "center", gap: "var(--p-space-1)", fontSize: "var(--p-type-xs)", color: "var(--text-muted)", marginTop: "var(--p-space-1)" }}>
                <Loader2 size={12} className="animate-spin" aria-hidden /> Checking availability…
              </p>
            )}
            {slugState === "available" && (
              <p style={{ display: "flex", alignItems: "center", gap: "var(--p-space-1)", fontSize: "var(--p-type-xs)", color: "var(--success-on)", marginTop: "var(--p-space-1)" }}>
                <BadgeCheck size={14} aria-hidden /> Available
              </p>
            )}
            {slugState === "taken" && (
              <p style={{ display: "flex", alignItems: "center", gap: "var(--p-space-1)", fontSize: "var(--p-type-xs)", color: "var(--danger-on)", marginTop: "var(--p-space-1)" }}>
                <X size={14} aria-hidden /> {slugReason ?? "Unavailable"}
              </p>
            )}
          </label>
        </div>

        <label style={{ display: "block", marginTop: "var(--p-space-3)" }}>
          <span style={labelStyle}>Short description</span>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Engineering training for power-plant teams" className="v3-input" style={{ width: "100%" }} />
        </label>

        <div style={{ display: "grid", gap: "var(--p-space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "var(--p-space-3)" }}>
          <label>
            <span style={labelStyle}>Address</span>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Lahore, Pakistan" className="v3-input" style={{ width: "100%" }} />
          </label>
          <label>
            <span style={labelStyle}>Website</span>
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://inzet.pk" className="v3-input" style={{ width: "100%" }} />
          </label>
        </div>

        <p style={{ display: "flex", alignItems: "center", gap: "var(--p-space-1)", fontSize: "var(--p-type-sm)", color: "var(--text-muted)", marginTop: "var(--p-space-3)" }}>
          <Globe size={14} aria-hidden />
          Your public page:{" "}
          <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", fontWeight: 500 }}>/{slug}</a>
        </p>
      </V3Card>

      {/* Public catalog */}
      <OrgCatalogSection />

      {/* Theme pack */}
      <V3Card style={{ marginBottom: "var(--p-space-5)" }}>
        <h3>Theme pack</h3>
        <p>The packs your team sees in the mode switch. Each member can still pick their own — this is the default gallery shipped with the platform.</p>
        <div style={{ marginTop: "var(--p-space-3)" }}>
          <ThemePackPicker />
        </div>
      </V3Card>

      {/* Branding */}
      <V3Card style={{ marginBottom: "var(--p-space-5)" }}>
        <h3>Branding</h3>
        <p>One brand color derives the full accessible palette (OKLCH math, WCAG AA guaranteed by construction — the badge below reflects the validator contract).</p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--p-space-3)", marginTop: "var(--p-space-4)" }}>
          <input
            type="color"
            value={brandHex}
            onChange={(e) => setBrandHex(e.target.value)}
            aria-label="Brand color"
            style={{ height: 44, width: 56, cursor: "pointer", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--surface)" }}
          />
          <input
            type="text"
            value={brandHex}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{6}$/.test(v)) setBrandHex(v.toLowerCase());
            }}
            aria-label="Brand color hex"
            className="v3-input"
            style={{ width: 112, fontFamily: "var(--font-mono, monospace)" }}
          />
          <V3Badge variant="success"><BadgeCheck size={12} aria-hidden /> AA guaranteed</V3Badge>
        </div>

        {/* Live preview */}
        <div style={{
          marginTop: "var(--p-space-4)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          padding: "var(--p-space-4)",
          background: previewColor,
        }}>
          <p style={{ fontSize: "var(--p-type-sm)", fontWeight: 600, color: palette?.light?.onBrand ?? "var(--text-inverse)" }}>
            {data.branding?.mode ?? "light"} preview
          </p>
          <div style={{
            marginTop: "var(--p-space-2)", display: "inline-flex",
            height: 36, alignItems: "center", borderRadius: "var(--radius-md)",
            paddingInline: "var(--p-space-4)",
            background: palette?.light?.brand ?? "var(--brand)",
            color: palette?.light?.onBrand ?? "var(--text-inverse)",
            fontSize: "var(--p-type-sm)", fontWeight: 500,
          }}>
            Primary button
          </div>
        </div>
      </V3Card>

      {/* Save button */}
      <button
        type="button"
        onClick={save}
        disabled={saving || !hydrated || !palette}
        className="v3-btn v3-btn-primary"
        style={{ width: "100%" }}
      >
        {saving ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <BadgeCheck size={14} aria-hidden />
        )}
        Save settings
      </button>
    </>
  );
}

/** Public catalog — courses shown on the org's storefront page. */
function OrgCatalogSection() {
  const { data, error, loading, retry } = useApi<{
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
      toast.error("Couldn't add course", { description: e instanceof Error ? e.message : "Try again." });
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
      toast.error("Couldn't remove course", { description: e instanceof Error ? e.message : "Try again." });
    }
  }

  if (loading) {
    return <V3Card style={{ marginBottom: "var(--p-space-5)", height: 96 }}><StateSkeleton cards={1} /></V3Card>;
  }
  if (error) {
    return (
      <V3Card className="v3-empty" role="alert" style={{ marginBottom: "var(--p-space-5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-3)" }}>
          <AlertTriangle size={16} aria-hidden style={{ color: "var(--danger-on)" }} />
          <span style={{ color: "var(--text)", fontSize: "var(--p-type-sm)" }}>Couldn&apos;t load your catalog</span>
          <button type="button" onClick={retry} className="v3-btn" style={{ marginLeft: "auto", fontSize: "var(--p-type-xs)" }}>
            <RefreshCw size={12} aria-hidden /> Retry
          </button>
        </div>
      </V3Card>
    );
  }

  const linked = data?.linked ?? [];
  const available = data?.available ?? [];

  return (
    <V3Card style={{ marginBottom: "var(--p-space-5)" }}>
      <h3>Public catalog</h3>
      <p>Courses listed on your public storefront page — learners can enroll directly from there.</p>

      {linked.length === 0 ? (
        <p style={{ marginTop: "var(--p-space-3)", padding: "var(--p-space-3)", border: "1px dashed var(--border)", borderRadius: "var(--radius-md)", textAlign: "center", fontSize: "var(--p-type-sm)", color: "var(--text-muted)" }}>
          No courses in your catalog yet — add one below.
        </p>
      ) : (
        <div style={{ marginTop: "var(--p-space-3)" }}>
          {linked.map((c) => (
            <div key={c.id} className="v3-course-row">
              <div className="v3-course-info">
                <strong>{c.name}</strong>
                {c.subtitle && <small>{c.subtitle}</small>}
              </div>
              <button
                type="button"
                onClick={() => void remove(c.id)}
                className="v3-btn"
                style={{ fontSize: "var(--p-type-xs)" }}
              >
                <Trash2 size={12} aria-hidden /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--p-space-2)", marginTop: "var(--p-space-3)" }}>
          <div style={{ display: "flex", gap: "var(--p-space-2)", flexWrap: "wrap" }}>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              aria-label="Add a course to your catalog"
              className="v3-select"
              style={{ flex: 1, minWidth: 200 }}
            >
              <option value="">Add a published course…</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void add()}
              disabled={adding || !selected}
              className="v3-btn v3-btn-primary"
              style={{ flexShrink: 0 }}
            >
              {adding ? <Loader2 size={14} className="animate-spin" aria-hidden /> : "Add to catalog"}
            </button>
          </div>
        </div>
      )}
    </V3Card>
  );
}
