"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bell, Search } from "lucide-react";

/**
 * modules/shell — ClassicTopbar (W15: Star Admin chrome for Classic mode)
 *
 * The Star Admin topbar rendered right of the classic sidebar:
 *   - Search trigger (opens the global ⌘K command palette)
 *   - Notification bell → the role-appropriate inbox (badge = unread)
 *   - Portal trailing (mode toggle, user menu) — the user menu renders
 *     its Star-style name+role chip in classic mode
 */

interface MeShape {
  user: { role: string } | null;
}

function bellHrefFor(role?: string): string {
  switch (role) {
    case "learner":
    case "student":
      return "/learner/messages";
    case "instructor":
      return "/instructor";
    case "org_admin":
      return "/org";
    case "platform_admin":
    case "admin":
      return "/platform";
    default:
      return "/learner/messages";
  }
}

export function ClassicTopbar({ trailing }: { trailing?: ReactNode }) {
  const [me, setMe] = useState<MeShape["user"]>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MeShape | null) => {
        if (!cancelled) setMe(d?.user ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (me?.role !== "learner" && me?.role !== "student") return;
    let cancelled = false;
    fetch("/api/messages?box=unread&pageSize=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { pagination?: { total?: number } } | null) => {
        if (!cancelled) setUnread(d?.pagination?.total ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me?.role]);

  function openPalette() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
    );
  }

  return (
    <header
      data-slot="classic-topbar"
      className="fixed inset-x-0 top-0 z-[var(--p-z-sticky)] flex h-16 items-center gap-2 border-b border-line bg-surface pl-[236px] pr-6"
    >
      {/* search — Star Admin style trigger */}
      <button
        type="button"
        onClick={openPalette}
        className="mr-auto flex h-10 min-w-48 max-w-md flex-1 items-center gap-2 rounded-lg border border-line bg-bg px-3 text-sm text-fg-muted transition-colors hover:border-line-strong"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">Search…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted sm:inline">
          Ctrl K
        </kbd>
      </button>

      {/* notifications */}
      <Link
        href={bellHrefFor(me?.role)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-fg"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold tabular-nums text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>

      <div className="h-6 w-px bg-line" aria-hidden />

      {trailing}
    </header>
  );
}
