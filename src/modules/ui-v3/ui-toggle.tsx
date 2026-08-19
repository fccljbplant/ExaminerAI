"use client";

// src/modules/ui-v3/ui-toggle.tsx — Toggle switch between v2 and v3 UI.
// Shows directly ON the home page content (not in the shell topbar).
// Any authenticated user can toggle — it's a UI preference.

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
        // Reload so the layout picks up the flag change
        setTimeout(() => window.location.reload(), 500);
      } else {
        const err = await res.json().catch(() => ({}));
        alert("Failed to toggle UI: " + (err.error || "Unknown error"));
      }
    } catch (e) {
      alert("Network error: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setSwitching(false);
    }
  }, [v3]);

  if (loading) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: 12,
        border: "1px solid #e7eaf0",
        background: v3 ? "#eeeeff" : "#f8fafc",
        cursor: switching ? "wait" : "pointer",
        opacity: switching ? 0.6 : 1,
        transition: "all 0.2s",
        fontSize: 14,
        fontWeight: 600,
        color: "#182230",
        userSelect: "none",
      }}
      onClick={toggle}
      role="button"
      aria-label="Toggle v3 UI"
    >
      <span style={{ fontSize: 13 }}>Interface:</span>

      {/* Toggle switch visual */}
      <span
        style={{
          position: "relative",
          width: 40,
          height: 22,
          borderRadius: 11,
          background: v3 ? "#5b5ce2" : "#ccc",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: v3 ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </span>

      <span style={{ color: v3 ? "#5b5ce2" : "#718096" }}>
        {v3 ? "v3" : "v2"}
      </span>
    </div>
  );
}
