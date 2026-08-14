"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NavItem, ShellBrand } from "./types";

/**
 * modules/shell — TopNav (xl full · lg condensed + More overflow)
 * Height 56px, sticky, hairline border — no shadow.
 */

function isActive(pathname: string, item: NavItem): boolean {
  const prefix = item.match ?? item.href;
  return pathname === item.href || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 min-w-11 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors",
        active
          ? "bg-brand-subtle font-medium text-fg"
          : "text-fg-secondary hover:bg-bg-subtle hover:text-fg"
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="whitespace-nowrap">{item.label}</span>
      {typeof item.badge === "number" && item.badge > 0 && (
        <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold tabular-nums text-on-brand">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function MoreMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-bg-subtle hover:text-fg"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);
          return (
            <DropdownMenuItem key={item.id} asChild className={cn(active && "bg-brand-subtle")}>
              <Link href={item.href}>
                {Icon && <Icon className="h-4 w-4" aria-hidden />}
                <span>{item.label}</span>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="ml-auto rounded-full bg-brand px-1.5 text-[10px] font-semibold tabular-nums text-on-brand">
                    {item.badge}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface TopNavProps {
  nav: NavItem[];
  brand?: ShellBrand;
  /** Right-side slot: mode toggle, user menu, etc. */
  trailing?: ReactNode;
  /** When set (lg), only this many items show inline; rest → More. */
  visibleCount?: number;
}

export function TopNav({ nav, brand, trailing, visibleCount }: TopNavProps) {
  const pathname = usePathname();
  const condensed = typeof visibleCount === "number" && nav.length > visibleCount;
  const inline = condensed ? nav.slice(0, visibleCount) : nav;
  const overflow = condensed ? nav.slice(visibleCount) : [];

  return (
    <nav
      data-slot="top-nav"
      aria-label="Primary"
      className="sticky top-0 z-[var(--p-z-sticky)] border-b border-nav-border bg-nav-bg"
    >
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-2 px-4 lg:px-6">
        {brand && (
          <Link
            href={brand.href ?? "/"}
            className="mr-2 flex min-w-0 items-center gap-2 text-sm font-semibold text-fg"
          >
            {brand.logo && <span className="flex h-7 items-center">{brand.logo}</span>}
            <span className="hidden truncate lg:inline">{brand.name}</span>
          </Link>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {inline.map((item) => (
            <NavLink key={item.id} item={item} pathname={pathname} />
          ))}
          {overflow.length > 0 && <MoreMenu items={overflow} pathname={pathname} />}
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
      </div>
    </nav>
  );
}
