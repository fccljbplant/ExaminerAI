"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useThemeV2 } from "@/modules/theme";
import { ChevronDown, CircleUserRound, HelpCircle, LogOut } from "lucide-react";
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
}: {
  userName: string;
  profileHref: string;
  profileLabel?: string;
  helpHref?: string;
}) {
  const router = useRouter();
  const { mode: themeMode, mounted: themeMounted } = useThemeV2();
  const [me, setMe] = useState<MeUser | null>(null);

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
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-on-brand">
              {initialsOf(displayName) || "?"}
            </span>
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-fg ring-1 ring-inset ring-line transition-colors hover:bg-brand-subtle/80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            {initialsOf(displayName) || "?"}
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
