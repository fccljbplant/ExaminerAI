"use client";

// src/modules/ui-v3/ui-toggle.tsx — Floating v2/v3 interface toggle.
//
// Always visible (fixed bottom-right corner) so the user can switch
// between v2 and v3 interfaces on any page, in any mode, on desktop
// or mobile. Self-contained: mounts itself via a portal so it floats
// above both the v2 PortalShell and v3 V3Shell.

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

type Mode = "v2" | "v3";

export function UIToggle() {
  const [mode, setMode] = useState<Mode | null>(null); // null = loading
  const [switching, setSwitching] = useState(false);
  const [mounted, setMounted] = useState(false);

  // SSR-safe: only render the portal after mount
  useEffect(() => setMounted(true), []);

  // Read current state on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/ui-v3", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setMode(d.enabled === true ? "v3" : "v2"); })
      .catch(() => { if (!cancelled) setMode("v2"); }); // fail-closed to v2
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(async () => {
    if (!mode || switching) return;
    const next: Mode = mode === "v3" ? "v2" : "v3";
    setSwitching(true);
    try {
      const res = await fetch("/api/admin/ui-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: next === "v3" }),
        credentials: "include",
      });
      if (res.ok) {
        setMode(next);
        toast.success(`Switched to ${next.toUpperCase()} interface`, {
          duration: 3000,
        });
        // Reload so the layout picks up the flag change
        setTimeout(() => window.location.reload(), 350);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error("Failed to toggle UI", {
          description: err.error || "Unknown error",
          duration: 5000,
        });
      }
    } catch (e) {
      toast.error("Network error", {
        description: e instanceof Error ? e.message : "Unknown",
        duration: 5000,
      });
    } finally {
      setSwitching(false);
    }
  }, [mode, switching]);

  // Don't render anything until we know the current mode
  if (!mounted || !mode) return null;

  const isV3 = mode === "v3";

  // Floating chip — fixed bottom-right, works on desktop + mobile
  return createPortal(
    <button
      type="button"
      onClick={toggle}
      disabled={switching}
      aria-label={`Switch to ${isV3 ? "v2" : "v3"} interface. Currently on ${mode}.`}
      title={`Interface: ${mode} (click to switch to ${isV3 ? "v2" : "v3"})`}
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 9999,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px 9px 12px",
        borderRadius: 99,
        border: "1px solid rgba(255,255,255,.18)",
        background: isV3
          ? "linear-gradient(135deg, #5b5ce2, #7778ff)"
          : "linear-gradient(135deg, #1f2937, #374151)",
        color: "white",
        cursor: switching ? "wait" : "pointer",
        opacity: switching ? 0.65 : 1,
        transition: "all 0.18s ease",
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: 0.2,
        boxShadow: isV3
          ? "0 10px 28px rgba(91,92,226,.42)"
          : "0 8px 24px rgba(0,0,0,.30)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Small icon */}
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "rgba(255,255,255,.22)",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          lineHeight: 1,
        }}
      >
        ⇄
      </span>

      <span>UI: {mode.toUpperCase()}</span>

      {/* Switching spinner */}
      {switching && (
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,.35)",
            borderTopColor: "white",
            animation: "uit-spin 0.7s linear infinite",
          }}
        />
      )}

      {/* Keyframes — injected once */}
      <style>{`@keyframes uit-spin { to { transform: rotate(360deg); } }`}</style>
    </button>,
    document.body,
  );
}
