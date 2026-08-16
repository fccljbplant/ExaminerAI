"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useThemeV2 } from "@/modules/theme";
import { ChevronDown, CircleUserRound, HelpCircle, LogOut, Settings, Monitor, Moon, BedDouble, Library, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/dropdown-menu";

/**
 * modules/shell — UserMenu (W11 audit: identity + sign-out)
 *
 * The avatar in the TopNav trailing slot is a real menu now: name,
 * email, role badge, role-scoped Profile/Dashboard link, Help link and
 * Sign out (POST /api/auth/logout → /login). Each portal shell passes
 * its own profileHref so the menu stays role-correct.
 *
 * Identity comes from GET /api/auth/me; `userName` (server-passed) is
 * the render fallback while that loads.
 */

export interface MeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarData?: string | null;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function roleLabel(role?: string): string {
  switch (role) {
    case "learner":
    case "student":
      return "Learner";
    case "instructor":
      return "Instructor";
    case "org_admin":
      return "Org admin";
    case "platform_admin":
    case "admin":
      return "Platform admin";
    case "demo":
      return "Demo";
    default:
      return role || "Member";
  }
}

export function UserMenu({
  userName,
  profileHref,
  profileLabel = "Profile",
  helpHref = "/support",
  settingsHref,
}: {
  userName: string;
  profileHref: string;
  profileLabel?: string;
  helpHref?: string;
  /** User settings page (avatar, password, appearance). Hidden when omitted. */
  settingsHref?: string;
}) {
  const router = useRouter();
  const { mode: themeMode, mounted: themeMounted, setMode } = useThemeV2();
  const [me, setMe] = useState<MeUser | null>(null);
  const [badgeIcon, setBadgeIcon] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user: MeUser | null } | null) => {
        if (!cancelled && d?.user) setMe(d.user);
      })
      .catch(() => {
        // Non-blocking: the avatar still renders from userName.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Badge icon for the DP overlay (learners only; guarded fetch).
  useEffect(() => {
    if (me?.role !== "learner" && me?.role !== "student") return;
    let cancelled = false;
    fetch("/api/learner/badges")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { earned?: Array<{ icon?: string }>; latestBadge?: { icon?: string } } | null) => {
        if (cancelled) return;
        const icon =
          d?.earned?.[0]?.icon ?? d?.latestBadge?.icon ?? null;
        setBadgeIcon(icon);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me?.role]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Cookie is set locally by the route; proceed even if the
      // request failed so the user is never trapped in the portal.
    }
    router.push("/login");
    router.refresh();
  }

  const displayName = me?.name || userName;
  const displayEmail = me?.email;
  // Classic mode renders the Star Admin profile chip (avatar + name +
  // role + chevron) instead of the bare avatar — read AFTER hydration
  // so the shell never flashes the wrong variant.
  const classic = themeMounted && themeMode === "classic";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {classic ? (
          <button
            type="button"
            aria-label={`Account menu for ${displayName}`}
            title={displayName}
            className="flex h-10 shrink-0 items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <AvatarCircle avatar={me?.avatarData ?? null} name={displayName} badgeIcon={badgeIcon} size="sm" />
            <span className="hidden min-w-0 text-left md:block">
              <span className="block max-w-36 truncate text-sm font-semibold text-fg">
                {displayName}
              </span>
              <span className="block text-[11px] font-medium text-fg-muted">
                {roleLabel(me?.role)}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-fg-muted" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Account menu for ${displayName}`}
            title={displayName}
            className="rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <AvatarCircle avatar={me?.avatarData ?? null} name={displayName} badgeIcon={badgeIcon} size="icon" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-fg">{displayName}</span>
            {displayEmail && (
              <span className="truncate text-xs text-fg-muted">{displayEmail}</span>
            )}
            <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-medium text-fg-muted">
              {roleLabel(me?.role)}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <CircleUserRound className="h-4 w-4" aria-hidden />
            <span>{profileLabel}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={helpHref}>
            <HelpCircle className="h-4 w-4" aria-hidden />
            <span>Help &amp; support</span>
          </Link>
        </DropdownMenuItem>
        {settingsHref && (
          <DropdownMenuItem asChild>
            <Link href={settingsHref}>
              <Settings className="h-4 w-4" aria-hidden />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />

        {/* Theme — every portal, every breakpoint (2026-08-15): the old
            ModeToggle was desktop-only, so phone/tablet users had no
            theme control at all. */}
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Theme
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1 px-2 pb-2">
          {(
            [
              { mode: "light", label: "Light", icon: Monitor },
              { mode: "dark", label: "Dark", icon: Moon },
              { mode: "bed", label: "Bed", icon: BedDouble },
              { mode: "classic", label: "Classic", icon: Library },
              { mode: "ocean", label: "Ocean", icon: Palette },
              { mode: "forest", label: "Forest", icon: Palette },
              { mode: "sunset", label: "Sunset", icon: Palette },
            ] as const
          ).map((t) => (
            <button
              key={t.mode}
              type="button"
              onClick={() => setMode(t.mode)}
              aria-pressed={themeMounted && themeMode === t.mode}
              className={
                themeMounted && themeMode === t.mode
                  ? "flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-2 text-xs font-semibold text-on-brand"
                  : "flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-fg"
              }
            >
              <t.icon className="h-3.5 w-3.5" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AvatarCircle({
  avatar,
  name,
  badgeIcon,
  size,
}: {
  avatar: string | null | undefined;
  name: string;
  badgeIcon: string | null;
  size: "icon" | "sm";
}) {
  const cls =
    size === "icon"
      ? "h-10 w-10 shrink-0 rounded-full text-xs ring-1 ring-inset ring-line"
      : "h-8 w-8 shrink-0 rounded-full text-xs";
  return (
    <span className="relative inline-flex">
      {avatar ? (
        <img src={avatar} alt="" className={`${cls} object-cover`} />
      ) : (
        <span
          className={`flex items-center justify-center bg-brand-subtle font-semibold text-fg ${cls}`}
        >
          {initialsOf(name) || "?"}
        </span>
      )}
      {badgeIcon && (
        <span
          title="Latest badge"
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-surface bg-brand-subtle text-[10px] leading-none"
        >
          {badgeIcon}
        </span>
      )}
    </span>
  );
}
