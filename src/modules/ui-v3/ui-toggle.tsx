"use client";

// src/modules/ui-v3/ui-toggle.tsx — Toggle switch between v2 and v3 UI.
// Shows on both v2 and v3 home screens. Calls /api/admin/ui-v3 to flip the flag.

import { useEffect, useState, useCallback } from "react";

export function UIToggle() {
  const [v3, setV3] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Check current state on mount
  useEffect(() => {
    fetch("/api/admin/ui-v3", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setV3(d.enabled === true); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggle = useCallback(async () => {
    setSwitching(true);
    const next = !v3;
    try {
      const res = await fetch("/api/admin/ui-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: next }),
        credentials: "include",
      });
      if (res.ok) {
        setV3(next);
        // Reload after a short delay so the layout picks up the flag change
        setTimeout(() => window.location.reload(), 500);
      }
    } catch {
      // Silently fail — only platform_admin can toggle
    } finally {
      setSwitching(false);
    }
  }, [v3]);

  if (loading) return null;

  return (
    <button
      onClick={toggle}
      disabled={switching}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.15)",
        background: v3 ? "rgba(91,92,226,0.15)" : "rgba(255,255,255,0.06)",
        color: "inherit",
        fontSize: 12,
        fontWeight: 600,
        cursor: switching ? "wait" : "pointer",
        opacity: switching ? 0.6 : 1,
        transition: "all 0.2s",
      }}
      title="Switch between v2 and v3 interface"
    >
      {/* Toggle switch visual */}
      <span
        style={{
          position: "relative",
          width: 36,
          height: 20,
          borderRadius: 10,
          background: v3 ? "#5b5ce2" : "#3a3a4a",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: v3 ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </span>
      <span>v3 UI</span>
    </button>
  );
}
