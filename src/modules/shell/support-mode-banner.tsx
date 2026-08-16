"use client";

import { useEffect, useState } from "react";
import { LifeBuoy, X } from "lucide-react";

/**
 * modules/shell — SupportModeBanner (2026-08-17)
 *
 * Shown whenever the active session token carries the `sup` claim
 * (platform-admin impersonation). Warns the operator and offers a
 * one-tap exit back to the admin session. Rendered by AppShellV2 so it
 * appears in every portal while support mode is active.
 */

export function SupportModeBanner() {
  const [sup, setSup] = useState<{ email: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { email?: string; sup?: boolean } } | null) => {
        if (!cancelled && d?.user?.sup) setSup({ email: d.user.email ?? "user" });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function exit() {
    await fetch("/api/v2/platform/impersonate/exit", { method: "POST" }).catch(() => {});
    window.location.href = "/platform";
  }

  if (!sup) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning-subtle px-4 py-1.5 text-center text-xs font-medium text-warning-on"
    >
      <LifeBuoy className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        SUPPORT MODE — you are acting as <span className="font-semibold">{sup.email}</span>. Every action is
        audited.
      </span>
      <button
        type="button"
        onClick={() => void exit()}
        className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/40 px-2 py-0.5 font-semibold transition-colors hover:bg-warning/20"
      >
        <X className="h-3 w-3" aria-hidden /> Exit
      </button>
    </div>
  );
}
